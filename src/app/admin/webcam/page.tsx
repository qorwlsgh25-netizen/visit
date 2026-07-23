"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createWorker } from "tesseract.js";
import { getEmployeeVehicles } from "@/app/actions/lpr";
import { getSecurityReservations } from "@/app/actions/reservation";

export default function LprWebcamPocPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 웹캠 제어 상태
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // 시뮬레이터 제어 상태
  const [carNumber, setCarNumber] = useState("37로1235");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI OCR 디버깅 및 장치 제어 상태
  const [isMirrored, setIsMirrored] = useState(true);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>("");
  const [ocrProgress, setOcrProgress] = useState<string>("");

  // DB 데이터 상태 (에러 보정 대조용)
  const [employeeVehicles, setEmployeeVehicles] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);

  // 1-2. 퍼지 대조용 데이터 로드
  useEffect(() => {
    const loadDbData = async () => {
      try {
        const [empRes, visitorRes] = await Promise.all([
          getEmployeeVehicles(),
          getSecurityReservations("")
        ]);
        if (empRes.success && empRes.data) {
          setEmployeeVehicles(empRes.data);
        }
        if (visitorRes.success && visitorRes.data) {
          setReservations(visitorRes.data);
        }
      } catch (err) {
        console.error("퍼지 대조용 데이터 로드 실패:", err);
      }
    };
    loadDbData();
  }, []);

  // 1. 카메라 장치 검색
  useEffect(() => {
    const getDevices = async () => {
      try {
        // 카메라 권한 사전 요청
        await navigator.mediaDevices.getUserMedia({ video: true });
        
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter((device) => device.kind === "videoinput");
        setDevices(videoDevices);
        
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error("카메라 장치 조회 실패:", err);
        setErrorMsg("카메라 권한을 획득하지 못했거나 연결된 비디오 장치가 없습니다.");
      }
    };

    getDevices();
  }, []);

  // 2. 웹캠 가동/정지 토글
  const startWebcam = async () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints = {
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setWebcamActive(true);
      setErrorMsg(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("웹캠 시작 오류:", err);
      setErrorMsg(`웹캠을 가동할 수 없습니다: ${err.message}`);
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setWebcamActive(false);
    setCapturedSnapshot(null);
  };

  // 2-2. 캡처 이미지 화질 개선 필터 (명암 대비 향상)
  const preprocessImage = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    // 명암 대비 1.7배 강화 (종이 번호판 식별 극대화)
    const factor = (259 * (125 + 255)) / (255 * (259 - 125));
    
    for (let i = 0; i < data.length; i += 4) {
      // 1. 그레이스케일 변환
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      
      // 2. 명암 대비 확장 공식
      let contrastVal = factor * (gray - 128) + 128;
      
      if (contrastVal < 0) contrastVal = 0;
      if (contrastVal > 255) contrastVal = 255;
      
      data[i] = contrastVal;
      data[i + 1] = contrastVal;
      data[i + 2] = contrastVal;
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // 3. 차량 인식 및 웹훅 전송 (실시간 이미지 OCR 탑재)
  const handleCaptureAndScan = async () => {
    setSending(true);
    setResult(null);
    setErrorMsg(null);
    setRawOcrText("");
    setOcrProgress("");

    let base64Image = "";

    // 웹캠이 켜져 있으면 현재 프레임을 캡처
    if (webcamActive && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // 웹캠의 실제 비디오 입력 해상도 확인
      const videoW = video.videoWidth || 640;
      const videoH = video.videoHeight || 480;

      // 1) 전체 화면을 임시 캔버스에 그리기 (좌우 반전 대응 포함)
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = videoW;
      tempCanvas.height = videoH;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        if (isMirrored) {
          tempCtx.translate(videoW, 0);
          tempCtx.scale(-1, 1);
        }
        tempCtx.drawImage(video, 0, 0, videoW, videoH);
      }

      // 2) 가이드라인(LPR 검출 구역) 비율에 맞춰서 중앙 영역만 도려내기(Crop)
      // 가로 140~500 (너비 360, 약 56%), 세로 180~330 (높이 150, 약 31%)
      // 인식 획을 보다 풍부히 얻기 위해 60% 가로, 35% 세로 비율로 여유 있게 도려냅니다.
      const cropW = Math.round(videoW * 0.60);
      const cropH = Math.round(videoH * 0.35);
      const cropX = Math.round((videoW - cropW) / 2);
      const cropY = Math.round((videoH - cropH) / 2) + 15; // 실제 초점의 살짝 하단부 타겟

      canvas.width = cropW;
      canvas.height = cropH;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // 임시 캔버스에서 핵심 문자 구역만 복사해 오기
        ctx.drawImage(tempCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // 이미지 전처리 (흑백 고대비 변환)
        preprocessImage(canvas);
        
        base64Image = canvas.toDataURL("image/jpeg", 0.95);
        setCapturedSnapshot(base64Image);
      }
    } else {
      // 카메라 미작동 / 기기 점유 시 동적으로 실제 한국 번호판 그래픽 캔버스 렌더링
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // 1) SF 감성 다크 배경 채우기
          const grad = ctx.createLinearGradient(0, 0, 640, 480);
          grad.addColorStop(0, "#0b0f19");
          grad.addColorStop(1, "#181f32");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 640, 480);

          // 2) 가이드라인 테두리 그리기
          ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
          ctx.lineWidth = 2;
          ctx.strokeRect(40, 40, 560, 400);

          // HUD 데이터 텍스트
          ctx.fillStyle = "#10b981";
          ctx.font = "bold 13px monospace";
          ctx.textAlign = "left";
          ctx.fillText("[H&E RUJA 정문 LPR CAM SIMULATOR]", 60, 75);

          ctx.fillStyle = "#64748b";
          ctx.font = "11px monospace";
          ctx.fillText(`SYSTEM TIME: ${new Date().toLocaleString()}`, 60, 100);
          ctx.fillText("STATUS: DEVICE IN USE FALLBACK (VIRTUAL)", 60, 120);

          // 3) 번호판 하얀 플레이트 본체 그리기
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.roundRect(140, 180, 360, 150, 12);
          ctx.fill();

          // 플레이트 테두리
          ctx.strokeStyle = "#1e293b";
          ctx.lineWidth = 5;
          ctx.stroke();

          // 4) 차량번호 텍스트 렌더링 (가독성 높은 간격 배치)
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 46px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          
          const cleanText = carNumber.trim();
          const displayNum = cleanText.replace(/(\d{2,3}[가-힣])(\d{4})/, "$1 $2");
          ctx.fillText(displayNum, 320, 255);

          // 번호판 하단 로고 문자
          ctx.fillStyle = "#3b82f6";
          ctx.font = "bold 11px sans-serif";
          ctx.fillText("KOREA / H&E RUJA", 320, 305);

          base64Image = canvas.toDataURL("image/jpeg", 0.9);
        }
      } else {
        base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      }
    }

    let finalCarNumber = carNumber.trim();
    let ocrMatched = false;

    // 웹캠 활성화 시 인공지능 번호판 OCR 문자 감지 분석 시도
    if (webcamActive && base64Image) {
      try {
        console.log("Analyzing captured frame using Tesseract.js eng+kor OCR...");
        setOcrProgress("인공지능 분석 중...");
        
        const worker = await createWorker("eng+kor", 1, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setOcrProgress(`판독 진행률: ${Math.round(m.progress * 100)}%`);
            }
          }
        });

        // Tesseract 세부 파라미터 제어 (화이트리스트 및 단일 행 파라미터 주입)
        await worker.setParameters({
          tessedit_pageseg_mode: "7" as any, // 7: 단일 텍스트 행으로 취급하여 오독 방지
          tessedit_char_whitelist: "0123456789가나다라마거너더러머버서어저고노도로모보소오조구누두루무부수우주바사아자하허호배"
        });

        const ocrRes = await worker.recognize(base64Image);
        await worker.terminate(); // 분석 후 워커 완전 인스턴스 소멸
        
        const rawText = (ocrRes.data.text || "").normalize("NFC").trim();
        setRawOcrText(rawText);
        console.log("OCR Detected Raw Text:", rawText);

        // 1단계: 유연한 패턴 매칭 (숫자 2~3개 + 임의의 비숫자 문자 1~2개 + 숫자 4개)
        const flexibleRegex = /(\d{2,3})\s*([^\d\s]{1,2})\s*(\d{4})/;
        const match = rawText.match(flexibleRegex);
        
        if (match) {
          const prefix = match[1];
          const middle = match[2];
          const suffix = match[3];
          const detectedTemp = `${prefix}${middle}${suffix}`;
          
          console.log(`Matched flexible regex: prefix=${prefix}, middle=${middle}, suffix=${suffix}`);
          
          // 2단계: DB 데이터와 대조하여 퍼지 에러 교정 시도 (예: '로'가 'E'나 'ㄹ'로 오인식된 경우 교정)
          let fuzzyCorrected = "";
          
          // 임직원 차량 검색
          const matchedEmp = employeeVehicles.find(v => {
            const cleanVal = v.carNumber.replace(/\s+/g, "");
            return cleanVal.startsWith(prefix) && cleanVal.endsWith(suffix);
          });
          
          // 방문객 예약 검색
          const matchedVisitor = reservations.find(r => {
            if (!r.carNumber) return false;
            const cleanVal = r.carNumber.replace(/\s+/g, "");
            return cleanVal.startsWith(prefix) && cleanVal.endsWith(suffix);
          });

          if (matchedEmp) {
            fuzzyCorrected = matchedEmp.carNumber;
            console.log("Fuzzy corrected to employee vehicle:", fuzzyCorrected);
          } else if (matchedVisitor) {
            fuzzyCorrected = matchedVisitor.carNumber;
            console.log("Fuzzy corrected to visitor vehicle:", fuzzyCorrected);
          }

          if (fuzzyCorrected) {
            finalCarNumber = fuzzyCorrected;
            setCarNumber(finalCarNumber);
            setOcrProgress("AI 퍼지 분석 성공!");
            ocrMatched = true;
          } else {
            // 매치되는 DB 등록 차량이 없을 경우, 인식된 그대로 사용 (한글 자모음 정상 결합인 경우 등)
            const cleanDetected = detectedTemp.replace(/[^ㄱ-ㅎㅏ-ㅣ가-힣0-9a-zA-Z]/g, "");
            if (cleanDetected) {
              finalCarNumber = cleanDetected;
              setCarNumber(finalCarNumber);
              setOcrProgress("AI 문자 판독 성공!");
              ocrMatched = true;
            }
          }
        }

        if (!ocrMatched) {
          // 3단계: 만약 정규식으로 감지가 안 되었을 경우, 전체 문자열에서 숫자만 추출하는 등의 백업 시도
          // 예: Tesseract가 한글을 아예 무시하고 '37 1235'로 읽었을 경우
          const digitMatch = rawText.replace(/[^0-9]/g, "");
          if (digitMatch.length >= 6) {
            const prefixLen = digitMatch.length - 4;
            const prefix = digitMatch.substring(0, prefixLen);
            const suffix = digitMatch.substring(prefixLen);
            
            const matchedEmp = employeeVehicles.find(v => {
              const cleanVal = v.carNumber.replace(/[^0-9]/g, "");
              return cleanVal.startsWith(prefix) && cleanVal.endsWith(suffix);
            });
            const matchedVisitor = reservations.find(r => {
              if (!r.carNumber) return false;
              const cleanVal = r.carNumber.replace(/[^0-9]/g, "");
              return cleanVal.startsWith(prefix) && cleanVal.endsWith(suffix);
            });

            if (matchedEmp) {
              finalCarNumber = matchedEmp.carNumber;
              setCarNumber(finalCarNumber);
              setOcrProgress("AI 디지털 번호 대조 성공!");
              ocrMatched = true;
            } else if (matchedVisitor) {
              finalCarNumber = matchedVisitor.carNumber;
              setCarNumber(finalCarNumber);
              setOcrProgress("AI 디지털 번호 대조 성공!");
              ocrMatched = true;
            }
          }
        }

        if (!ocrMatched) {
          // 4단계: 초간단 4자리 숫자 대조 (최후의 보루)
          // 텍스트 내에서 4자리 숫자 연속 배열을 찾고, DB에 이 번호로 끝나는 등록 차량이 존재하면 자동 복원!
          const fourDigitMatch = rawText.match(/\d{4}/);
          if (fourDigitMatch) {
            const suffix = fourDigitMatch[0];
            const matchedEmp = employeeVehicles.find(v => {
              const cleanVal = v.carNumber.replace(/[^0-9]/g, "");
              return cleanVal.endsWith(suffix);
            });
            const matchedVisitor = reservations.find(r => {
              if (!r.carNumber) return false;
              const cleanVal = r.carNumber.replace(/[^0-9]/g, "");
              return cleanVal.endsWith(suffix);
            });

            if (matchedEmp) {
              finalCarNumber = matchedEmp.carNumber;
              setCarNumber(finalCarNumber);
              setOcrProgress("AI 4자리 대조 복원 성공!");
              ocrMatched = true;
            } else if (matchedVisitor) {
              finalCarNumber = matchedVisitor.carNumber;
              setCarNumber(finalCarNumber);
              setOcrProgress("AI 4자리 대조 복원 성공!");
              ocrMatched = true;
            }
          }
        }

        if (!ocrMatched) {
          setOcrProgress("번호판 검출 실패");
          alert("카메라 촬영본에서 번호판(한글+숫자 조합)을 자동 검출하지 못했습니다. 수동 입력된 차량번호로 전송합니다.");
        }
      } catch (ocrErr) {
        console.error("OCR 분석 에러:", ocrErr);
        setOcrProgress("판독 에러 발생");
      }
    }

    if (!finalCarNumber) {
      alert("차량 번호를 지정해 주십시오.");
      setSending(false);
      return;
    }

    try {
      const response = await fetch("/api/lpr/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carNumber: finalCarNumber,
          image: base64Image
        })
      });

      const json = await response.json();
      if (json.success) {
        setResult(json);
      } else {
        setErrorMsg(json.error || "웹훅 전송에 실패했습니다.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "서버 통신 중 에러가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans">
      
      {/* 상단 바 */}
      <header className="border-b border-slate-200 bg-white backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-slate-950"></span>
          <div>
            <span className="font-bold text-sm tracking-tight text-slate-900">네티젠 테크 아산(본사)</span>
            <span className="block text-[10px] text-[#0F4C81] font-bold uppercase tracking-wider">LPR 로지텍 웹캠 PoC 시뮬레이션</span>
          </div>
        </div>
        <Link 
          href="/admin/dashboard"
          className="px-4 py-2 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-xl text-xs font-bold transition-all shadow-md"
        >
          경비실 대시보드로 복귀
        </Link>
      </header>

      {/* 메인 작업 대 */}
      <main className="max-w-6xl w-full mx-auto px-4 py-8 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* 좌측: 로지텍 웹캠 스트리밍 카드 */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900">📹 LPR 카메라 웹캠 비디오 피드</h3>
              <p className="text-[11px] text-slate-600/60 mt-1">로지텍 카메라 피드를 연결하여 정문 번호판 인식 카메라를 시뮬레이션합니다.</p>
            </div>
            
            {/* 웹캠 온오프 스위치 */}
            <button
              onClick={webcamActive ? stopWebcam : startWebcam}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                webcamActive 
                  ? "bg-rose-600 hover:bg-rose-500 text-white" 
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {webcamActive ? "카메라 전원 끄기" : "카메라 전원 켜기"}
            </button>
          </div>

          {/* 비디오 뷰포트 */}
          <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden aspect-video flex items-center justify-center relative shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isMirrored ? "transform -scale-x-100" : ""} ${webcamActive ? "block" : "hidden"}`}
            />
            {!webcamActive && (
              <div className="text-center text-slate-600 space-y-3 p-6 text-xs max-w-sm">
                <span className="text-4xl block animate-pulse">📷</span>
                <p className="font-bold text-slate-800">가상 카메라 시뮬레이터 대기 중</p>
                <p className="text-slate-500 leading-relaxed">
                  카메라가 꺼져 있거나 다른 프로그램에 의해 장치가 사용 중(Device in use)인 경우에도, 우측 전송을 누르면 번호판 그래픽이 자동 동적 생성되어 웹훅 및 실시간 대시보드 데모가 완벽하게 연동됩니다.
                </p>
              </div>
            )}
            
            {/* LPR 가이드라인 오버레이 */}
            {webcamActive && (
              <div className="absolute inset-0 pointer-events-none border-4 border-[#0F4C81]/20 flex flex-col justify-between p-6">
                <div className="flex justify-between">
                  <span className="w-6 h-6 border-t-2 border-l-2 border-emerald-400"></span>
                  <span className="w-6 h-6 border-t-2 border-r-2 border-emerald-400"></span>
                </div>
                <div className="self-center bg-white/70 border border-emerald-500/30 px-4 py-1.5 rounded text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
                  LPR 번호판 검출 구역
                </div>
                <div className="flex justify-between">
                  <span className="w-6 h-6 border-b-2 border-l-2 border-emerald-400"></span>
                  <span className="w-6 h-6 border-b-2 border-r-2 border-emerald-400"></span>
                </div>
              </div>
            )}
          </div>

          {/* 장치 선택 및 옵션 제어 컨트롤 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold text-[#0F4C81]">영상 캡처 비디오 장치 선택</label>
              <select
                disabled={webcamActive}
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `카메라 장치 ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 flex flex-col justify-end">
              <button
                type="button"
                onClick={() => setIsMirrored(!isMirrored)}
                className={`w-full py-2 border rounded-xl text-xs font-bold transition-all ${
                  isMirrored 
                    ? "bg-white border-[#0F4C81]/30 text-slate-600 hover:bg-slate-50" 
                    : "bg-white border-slate-800 text-slate-600 hover:bg-white"
                }`}
              >
                좌우 반전: {isMirrored ? "활성 (거울모드)" : "비활성 (정방향)"}
              </button>
            </div>
          </div>

          {/* AI 전처리 미리보기 뷰 */}
          {capturedSnapshot && (
            <div className="space-y-2 border-t border-slate-200 pt-4">
              <label className="block text-[10px] font-bold text-[#0F4C81]">🔍 AI 판독용 전처리 프레임 스냅샷 (흑백 명암비 강화)</label>
              <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
                <img 
                  src={capturedSnapshot} 
                  alt="AI Preprocessed view" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </section>

        {/* 우측: 인식 시뮬레이션 및 웹훅 상태 */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">⚙️ LPR 인식 전송 및 시뮬레이터</h3>
            <p className="text-[11px] text-slate-600/60 mt-1">차량 번호를 입력하고 전송 버튼을 누르면 정문 카메라 검지 웹훅이 즉시 구동됩니다.</p>
          </div>

          {/* 입력 폼 */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-[#0F4C81] mb-1">인식시킬 가상 차량번호 (공백 없이)</label>
              <input
                type="text"
                required
                value={carNumber}
                onChange={(e) => setCarNumber(e.target.value)}
                placeholder="예: 77나7777"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0F4C81] font-mono text-center text-lg font-bold tracking-widest"
              />
            </div>

            <button
              onClick={handleCaptureAndScan}
              disabled={sending}
              className="w-full py-3 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white hover:from-indigo-600 hover:to-purple-700 rounded-xl font-bold text-xs text-white transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2"
            >
              {sending ? (
                "인식 및 캡처 전송 중..."
              ) : (
                <>
                  <span>📸</span>
                  <span>차량 통과 및 LPR 웹훅 전송</span>
                </>
              )}
            </button>
          </div>

          {/* LPR AI 실시간 판독 진행 상태창 (상시 노출) */}
          {(ocrProgress || rawOcrText) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 font-mono text-xs">
              <span className="text-[10px] font-bold text-[#0F4C81] block border-b border-slate-200/60 pb-1">📊 AI OCR 실시간 판독 디버거</span>
              
              {ocrProgress && (
                <div className="flex justify-between text-slate-600 font-bold">
                  <span>분석 진행 상황</span>
                  <span className="animate-pulse">{ocrProgress}</span>
                </div>
              )}

              {rawOcrText && (
                <div className="flex flex-col space-y-1 pt-2 border-t border-slate-200">
                  <span className="text-slate-500 text-[10px]">AI가 인식해 낸 원시 텍스트 (Raw Text)</span>
                  <span className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 text-[10px] break-all max-h-16 overflow-y-auto block">
                    {rawOcrText}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 단속/검지 테스트 결과 보드 */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-600">웹훅 API 수신 피드백</span>
            
            {errorMsg && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium">
                ⚠️ 전송 오류: {errorMsg}
              </div>
            )}

            {result ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 font-mono text-xs">
                
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-600">결과 상태</span>
                  <span className={result.success ? "text-emerald-600 font-bold" : "text-rose-400"}>
                    {result.success ? "SUCCESS" : "FAILED"}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-600">인식 타입</span>
                  <span className="text-[#0F4C81] font-bold uppercase">{result.type}</span>
                </div>

                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-600">안내 메시지</span>
                  <span className="text-slate-800">{result.message}</span>
                </div>

                {result.data && (
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-[11px] space-y-1.5 text-left text-slate-700">
                    <p>🚗 <b>차량번호</b>: {result.data.carNumber}</p>
                    {result.type === "visitor" ? (
                      <>
                        <p>👤 <b>방문객</b>: {result.data.visitorName} 님</p>
                        <p>🏢 <b>소속</b>: {result.data.organization}</p>
                        <p>🔑 <b>카드키 번호</b>: {result.data.temporaryCardNumber}</p>
                      </>
                    ) : (
                      <>
                        <p>👤 <b>소유 임직원</b>: {result.data.employeeName} 님</p>
                        <p>🏢 <b>소속부서</b>: {result.data.department}</p>
                        <p>🕒 <b>단속일시</b>: {new Date(result.data.violatedAt).toLocaleString()}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-slate-600 text-center text-xs border border-slate-200 rounded-2xl bg-[#F8F9FA]">
                <span>⚡</span>
                <span className="mt-1">인식 발송 대기 중...</span>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* 숨겨진 캡처 캔버스 */}
      <canvas ref={canvasRef} className="hidden" />

      <footer className="border-t border-slate-200 py-6 bg-white text-center text-[#0F4C81]/30 text-[10px] mt-8">
        &copy; {new Date().getFullYear()} 네티젠 테크 통합 보안 출입 관리 시스템
      </footer>

    </div>
  );
}
