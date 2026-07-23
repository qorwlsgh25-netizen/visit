"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  getSecurityReservations, 
  getMonthlyReservations, 
  requestSecurityLoginLink, 
  verifySecurityToken,
  logout
} from "@/app/actions/reservation";

function SecurityDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 보안 로그인 세션 상태
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 대시보드 뷰 및 데이터 상태
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [reservations, setReservations] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [query, setQuery] = useState("");

  // 로그인 입력 폼 상태
  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // 캘린더 전용 상태
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [calendarRes, setCalendarRes] = useState<any[]>([]);
  const [selectedDayRes, setSelectedDayRes] = useState<any[] | null>(null);
  const [selectedDayNum, setSelectedDayNum] = useState<number | null>(null);

  // LPR 실시간 차량 인식 알림 상태
  const [lprAlert, setLprAlert] = useState<any | null>(null);

  // 1. 보안 토큰 검증 및 세션 로드
  useEffect(() => {
    const initSession = async () => {
      const urlEmail = searchParams.get("email");
      const urlToken = searchParams.get("token");

      if (urlEmail && urlToken) {
        setLoading(true);
        try {
          const res = await verifySecurityToken(urlEmail, urlToken);
          if (res.success) {
            // 쿠키 및 세션 저장
            document.cookie = `security_email=${encodeURIComponent(urlEmail.trim().toLowerCase())}; path=/; max-age=86400`;
            sessionStorage.setItem("security_email", urlEmail.trim().toLowerCase());
            setEmail(urlEmail.trim().toLowerCase());
            
            // 파라미터 소거
            router.replace("/admin/dashboard");
          } else {
            setError(res.error || "인증 토큰 검증에 실패했습니다.");
          }
        } catch (err) {
          setError("인증 처리 중 서버 통신 에러가 발생했습니다.");
        } finally {
          setLoading(false);
        }
        return;
      }

      // 쿠키에서 세션 복구 시도
      const savedEmail = sessionStorage.getItem("security_email") || getCookie("security_email");
      if (savedEmail) {
        setEmail(savedEmail);
        loadListData(query);
      } else {
        setLoading(false);
      }
    };

    initSession();
  }, [searchParams]);

  // 쿠키 파싱 헬퍼
  const getCookie = (name: string) => {
    if (typeof document === "undefined") return "";
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(";").shift() || "");
    return "";
  };

  // 2. 실시간 오늘 리스트 로딩
  const loadListData = async (searchQuery: string) => {
    if (viewMode !== "list") return;
    try {
      const res = await getSecurityReservations(searchQuery);
      if (res.success && res.data) {
        setReservations(res.data);
      }
    } catch (err) {
      console.error("실시간 리스트 로드 오류:", err);
    }
  };

  // 3. 월간 캘린더 데이터 로딩
  const loadCalendarData = async (year: number, month: number) => {
    try {
      const res = await getMonthlyReservations(year, month);
      if (res.success && res.data) {
        setCalendarRes(res.data);
      }
    } catch (err) {
      console.error("캘린더 데이터 로드 오류:", err);
    }
  };

  // 자동 리프레시 및 보기 모드별 데이터 로드
  useEffect(() => {
    if (!email) return;

    if (viewMode === "list") {
      loadListData(query);
      if (!autoRefresh) return;
      const interval = setInterval(() => {
        loadListData(query);
      }, 30000);
      return () => clearInterval(interval);
    } else {
      loadCalendarData(currentYear, currentMonth);
    }
  }, [email, viewMode, query, autoRefresh, currentYear, currentMonth]);

  // 3-2. LPR 실시간 이벤트 알림 폴링 (3초 주기) 및 TTS 음성 경보 연동
  useEffect(() => {
    if (!email) return;

    const pollLprEvents = async () => {
      try {
        const res = await fetch("/api/lpr/events");
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const latestEvent = json.data[json.data.length - 1];
          setLprAlert(latestEvent);

          // 브라우저 내장 TTS 음성 알림 출력
          const speakText = latestEvent.eventType === "VISITOR"
            ? "예약된 방문객 차량이 확인 되었습니다."
            : "오부제 위반 차량이 감지되었습니다.";
          const speak = new SpeechSynthesisUtterance(speakText);
          speak.lang = "ko-KR";
          window.speechSynthesis.speak(speak);

          // 실시간 목록 갱신 트리거
          if (viewMode === "list") {
            loadListData(query);
          }
        }
      } catch (err) {
        console.error("LPR 이벤트 폴링 에러:", err);
      }
    };

    const interval = setInterval(pollLprEvents, 3000);
    return () => clearInterval(interval);
  }, [email, viewMode, query]);

  // 3-3. USB 바코드/QR코드 리더기 글로벌 키보드 에뮬레이션 인터셉터
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      const currentTime = Date.now();
      
      // 스캐너 장비의 연타 속도는 30ms 미만입니다. 사람이 직접 입력하는 경우는 100ms 이상 소요되므로
      // 입력 간격이 100ms를 초과하면 버퍼를 비워 일반 키보드 입력을 방해하지 않게 합니다.
      if (currentTime - lastKeyTime > 100) {
        buffer = "";
      }
      
      lastKeyTime = currentTime;

      // 엔터키(Enter)가 들어오면 전산 바코드 스캐너의 입력 마침 신호로 식별합니다.
      if (e.key === "Enter") {
        if (buffer.length > 0) {
          // 1. URL 형태인 경우 파라미터에서 ID 추출 및 강제 바인딩
          if (buffer.includes("/admin/scan?id=")) {
            try {
              const securePrefix = buffer.startsWith("http") ? buffer : `http://${buffer}`;
              const urlObj = new URL(securePrefix);
              const reservationId = urlObj.searchParams.get("id");
              if (reservationId) {
                if (isInputFocused && "value" in activeEl) {
                  (activeEl as any).value = "";
                }
                router.push(`/admin/scan?id=${reservationId}`);
              }
            } catch (err) {
              console.error("스캐너 QR URL 파싱 실패:", err);
            }
            buffer = "";
            return;
          } 
          // 2. 순수 6자리 숫자로 구성된 예약번호만 스캔된 경우
          else if (/^\d{6}$/.test(buffer)) {
            if (isInputFocused && "value" in activeEl) {
              (activeEl as any).value = "";
            }
            router.push(`/admin/scan?id=${buffer}`);
            buffer = "";
            return;
          }
        }
        
        // 검색 필터 등 일반 폼 타이핑 중 엔터인 경우 가로채지 않고 정상 패스
        if (isInputFocused) {
          buffer = "";
          return;
        }
        buffer = "";
      } else {
        // 기능 제어 키(Shift, Control, Alt 등)를 제외한 단문 문자열만 누적합니다.
        if (e.key.length === 1) {
          buffer += e.key;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [router]);

  // 4. 보안 로그인 메일 요청
  const handleRequestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;
    setLoginLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await requestSecurityLoginLink(loginEmail);
      if (res.success) {
        setSuccessMsg(res.message || "이메일로 로그인 링크가 전송되었습니다.");
      } else {
        setError(res.error || "로그인 링크 요청에 실패했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "서버 통신 중 에러가 발생했습니다.");
    } finally {
      setLoginLoading(false);
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    await logout();
    document.cookie = "security_email=; path=/; max-age=0";
    sessionStorage.removeItem("security_email");
    setEmail(null);
    setReservations([]);
    setCalendarRes([]);
    setSelectedDayRes(null);
    setError(null);
    setSuccessMsg(null);
  };

  // 달력 이전달/다음달 이동
  const handlePrevMonth = () => {
    setSelectedDayRes(null);
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedDayRes(null);
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 캘린더 생성 알고리즘
  const renderCalendarDays = () => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const startDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0: Sunday, 6: Saturday
    
    const days = [];
    // 1. 공백 날짜 채우기 (이전 달 날짜 영역)
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="bg-slate-50 border border-slate-200/20 opacity-30 min-h-[90px] p-2"></div>);
    }

    // 2. 이달의 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
      // 해당 일자의 예약 리스트 추출
      const dayRes = calendarRes.filter(res => {
        const startDate = new Date(res.visitDateTime);
        const endDate = res.visitEndDateTime ? new Date(res.visitEndDateTime) : null;
        
        const cellDateStart = new Date(currentYear, currentMonth - 1, day, 0, 0, 0);
        const cellDateEnd = new Date(currentYear, currentMonth - 1, day, 23, 59, 59, 999);

        if (endDate) {
          return startDate <= cellDateEnd && endDate >= cellDateStart;
        } else {
          return startDate >= cellDateStart && startDate <= cellDateEnd;
        }
      });

      const hasApproved = dayRes.some(r => r.status === "APPROVED");
      const hasEntered = dayRes.some(r => r.status === "ENTERED");

      days.push(
        <div 
          key={`day-${day}`}
          onClick={() => {
            if (dayRes.length > 0) {
              setSelectedDayRes(dayRes);
              setSelectedDayNum(day);
            } else {
              setSelectedDayRes(null);
              setSelectedDayNum(null);
            }
          }}
          className={`min-h-[90px] border border-slate-200 p-2 cursor-pointer transition-all hover:bg-slate-50 relative flex flex-col justify-between ${
            dayRes.length > 0 ? "bg-white" : "bg-[#F8F9FA]"
          } ${
            selectedDayNum === day ? "border-[#0F4C81] bg-white shadow-inner" : ""
          }`}
        >
          {/* 일자 */}
          <div className="flex justify-between items-center">
            <span className={`text-xs font-bold ${
              new Date(currentYear, currentMonth - 1, day).getDay() === 0 ? "text-rose-400" :
              new Date(currentYear, currentMonth - 1, day).getDay() === 6 ? "text-sky-400" : "text-slate-700"
            }`}>
              {day}
            </span>
            {dayRes.length > 0 && (
              <span className="text-[9px] bg-[#0F4C81] px-1.5 py-0.5 rounded text-white font-bold">
                {dayRes.length}건
              </span>
            )}
          </div>

          {/* 목록 정보 요약 */}
          <div className="space-y-1 mt-1 flex-1 flex flex-col justify-end">
            {dayRes.slice(0, 2).map((r, index) => (
              <div 
                key={r.id}
                className={`text-[9px] truncate px-1 rounded border ${
                  r.status === "ENTERED" ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                  r.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  "bg-slate-800 text-slate-600 border-slate-700"
                }`}
              >
                {r.visitorName}
              </div>
            ))}
            {dayRes.length > 2 && (
              <div className="text-[8px] text-[#0F4C81] font-bold text-center">
                외 {dayRes.length - 2}명 더 있음
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  // 날짜/시간 포맷터
  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- 화면 1: 로그인하지 않은 상태 (보안협력사 이메일 인증) ---
  if (!email) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <span className="px-4 py-2 rounded-full bg-indigo-500/10 border border-[#0F4C81]/20 text-xs font-bold text-slate-600 mb-6 inline-block">
              SECURITY CONSOLE
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">경비실 보안 콘솔</h2>
            <p className="mt-2 text-sm text-slate-500/60">
              보안협력사 전산 전용 이메일 주소를 입력하시면 출입 통제 대시보드로 즉시 입장하는 로그인 메일을 전송합니다.
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
          <div className="bg-white border border-slate-200 p-8 rounded-3xl backdrop-blur-md shadow-2xl space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium">
                ⚠️ {error}
              </div>
            )}
            {successMsg && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-medium">
                📬 {successMsg}
              </div>
            )}

            <form onSubmit={handleRequestLogin} className="space-y-6">
              <div>
                <label htmlFor="loginEmail" className="block text-xs font-semibold text-[#0F4C81] mb-2">
                  경비원 보안 이메일 주소
                </label>
                <input
                  type="email"
                  id="loginEmail"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="security@company.com"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full px-5 py-3 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-xl font-bold text-sm text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center"
              >
                {loginLoading ? "로그인 링크 전송 중..." : "대시보드 로그인 링크 전송"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- 화면 2: 로그인 상태 (실시간 목록 & 월간 캘린더 통합 뷰) ---
  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans">
      
      {/* 탑 바 */}
      <header className="border-b border-slate-200 bg-white backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse border-2 border-slate-950"></span>
          <div>
            <span className="font-bold text-sm tracking-tight text-slate-900">네티젠 테크 아산(본사)</span>
            <span className="block text-[10px] text-[#0F4C81] font-bold uppercase tracking-wider">정문 경비실 출입 모니터링</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {/* 리스트 vs 캘린더 토글 */}
          <div className="flex bg-white border border-slate-200 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "list" ? "bg-[#0F4C81] text-white" : "text-[#0F4C81]"
              }`}
            >
              실시간 현황
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "calendar" ? "bg-[#0F4C81] text-white" : "text-[#0F4C81]"
              }`}
            >
              월간 캘린더
            </button>
          </div>

          <Link
            href="/admin/webcam"
            className="px-3.5 py-1.5 bg-indigo-950 hover:bg-indigo-900 border border-slate-200 rounded-lg text-xs font-semibold text-emerald-400 hover:text-white transition-colors"
          >
            LPR 카메라 PoC
          </Link>

          <Link
            href="/admin/fiveday"
            className="px-3.5 py-1.5 bg-indigo-950 hover:bg-indigo-900 border border-slate-200 rounded-lg text-xs font-semibold text-[#0F4C81] hover:text-white transition-colors"
          >
            5부제 관리 센터
          </Link>

          <span className="text-xs font-mono text-slate-600/80 hidden sm:inline">{email} 님</span>
          <button 
            onClick={handleLogout}
            className="px-3.5 py-1.5 border border-slate-200 hover:border-[#0F4C81]/50 rounded-lg text-xs font-semibold text-[#0F4C81] hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-6xl w-full mx-auto px-4 py-8 flex-1 flex flex-col space-y-6">
        
        {/* 모드 A: 실시간 리스트 뷰 */}
        {viewMode === "list" && (
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 rounded-2xl p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">오늘의 방문객 실시간 모니터</h2>
                <p className="text-xs text-slate-600/60 mt-1">오늘 날짜의 입/출실 대기자 현황판입니다. 방문객 성명, 접수번호, 소속명으로 검색하십시오.</p>
              </div>
              <div className="w-full md:w-80 flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="예약번호, 성명, 소속사 검색..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-200/50 rounded-xl text-xs text-slate-800 placeholder-slate-500 focus:outline-none focus:border-[#0F4C81] transition-colors"
                />
                <button
                  onClick={() => loadListData(query)}
                  className="px-3 py-2 bg-[#0F4C81] hover:bg-[#0c3e6b] rounded-xl text-xs font-bold text-slate-900 transition-all shrink-0"
                >
                  조회
                </button>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reservations.length === 0 ? (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-[#0F4C81]/40 space-y-2">
                  <span>📭</span>
                  <span className="text-xs">오늘의 예약 방문 신청건이 존재하지 않습니다.</span>
                </div>
              ) : (
                reservations.map((res) => (
                  <Link 
                    href={`/admin/scan?id=${res.id}`}
                    key={res.id}
                    className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#0F4C81]/40 hover:bg-white transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 shadow-md hover:shadow-indigo-500/5"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-mono font-bold text-[#0F4C81]">{res.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          res.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          res.status === "ENTERED" ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" :
                          res.status === "EXITED" ? "bg-slate-500/10 text-slate-600 border border-slate-500/20" :
                          "bg-slate-800 text-slate-600"
                        }`}>
                          {res.status === "APPROVED" && "입문 대기"}
                          {res.status === "ENTERED" && "입실 완료"}
                          {res.status === "EXITED" && "퇴실 완료"}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-800 group-hover:text-slate-900 transition-colors">{res.visitorName}</h4>
                      <p className="text-[11px] text-slate-600/70 mt-0.5">{res.organization} ({res.phoneNumber})</p>
                      
                      {res.companions && res.companions.length > 0 && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] text-slate-600">
                          동행자 {res.companions.length}명 포함
                        </span>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-[10px] text-slate-600">
                      <div className="flex justify-between">
                        <span>방문 예정</span>
                        <span className="font-semibold text-slate-600">{formatDateTime(res.visitDateTime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>담당 직원</span>
                        <span className="text-slate-700">{res.hostName} ({res.hostDepartment || "호스트"})</span>
                      </div>
                      {res.temporaryCardNumber && (
                        <div className="flex justify-between font-bold text-emerald-400">
                          <span>출입 카드</span>
                          <span>Card No. {res.temporaryCardNumber}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </>
        )}

        {/* 모드 B: 월간 캘린더 뷰 */}
        {viewMode === "calendar" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* 달력 격자판 (8/12 영역) */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              
              {/* 연/월 네비게이터 */}
              <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{currentYear}년 {currentMonth}월</h3>
                  <p className="text-[10px] text-[#0F4C81]">월간 사전 예약 분포 현황</p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={handlePrevMonth}
                    className="p-2 border border-slate-200 hover:border-[#0F4C81] rounded-lg text-xs font-bold text-slate-600 transition-colors"
                  >
                    ◀ 이전달
                  </button>
                  <button 
                    onClick={handleNextMonth}
                    className="p-2 border border-slate-200 hover:border-[#0F4C81] rounded-lg text-xs font-bold text-slate-600 transition-colors"
                  >
                    다음달 ▶
                  </button>
                </div>
              </div>

              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-600 border-b border-slate-200 pb-2">
                <div className="text-rose-400">일</div>
                <div>월</div>
                <div>화</div>
                <div>수</div>
                <div>목</div>
                <div>금</div>
                <div className="text-sky-400">토</div>
              </div>

              {/* 달력 격자 */}
              <div className="grid grid-cols-7 gap-1 bg-white p-1 rounded-xl">
                {renderCalendarDays()}
              </div>

            </div>

            {/* 일자별 디테일 목록 (4/12 영역) */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 min-h-[400px]">
              {selectedDayRes && selectedDayNum ? (
                <div className="space-y-4">
                  <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{currentMonth}월 {selectedDayNum}일 방문자 명단</h4>
                      <p className="text-[9px] text-[#0F4C81]">총 {selectedDayRes.length}건의 예약이 탐지되었습니다.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedDayRes(null);
                        setSelectedDayNum(null);
                      }}
                      className="text-xs text-[#0F4C81] hover:text-white"
                    >
                      닫기
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {selectedDayRes.map((res) => (
                      <Link
                        href={`/admin/scan?id=${res.id}`}
                        key={res.id}
                        className="block p-3 bg-white border border-slate-200 hover:border-[#0F4C81]/50 rounded-xl transition-all"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-mono text-[#0F4C81]">{res.id}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            res.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400" :
                            res.status === "ENTERED" ? "bg-sky-500/10 text-sky-400" :
                            res.status === "EXITED" ? "bg-slate-500/10 text-slate-600" :
                            "bg-slate-800 text-slate-600"
                          }`}>
                            {res.status === "APPROVED" && "승인됨"}
                            {res.status === "ENTERED" && "입실중"}
                            {res.status === "EXITED" && "퇴실완료"}
                          </span>
                        </div>
                        <h5 className="font-bold text-xs text-slate-800">{res.visitorName} ({res.organization})</h5>
                        <p className="text-[10px] text-slate-500 mt-1">담당: {res.hostName} ({res.hostDepartment || "호스트"})</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[350px] flex flex-col items-center justify-center text-[#0F4C81]/30 text-center space-y-2">
                  <span>📅</span>
                  <span className="text-xs leading-relaxed">
                    달력에서 날짜를 클릭하시면<br />당일 방문 신청자 상세 정보를 보실 수 있습니다.
                  </span>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      <footer className="border-t border-slate-200 py-6 bg-white text-center text-[#0F4C81]/30 text-[10px]">
        &copy; {new Date().getFullYear()} 네티젠 테크 통합 보안 출입 관리 시스템
      </footer>

      {/* LPR 실시간 차량 감지 및 5부제 위반 토스트 경고창 */}
      {lprAlert && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center p-6 z-[9999]">
          <div className={`p-8 rounded-3xl max-w-lg w-full text-center space-y-6 border shadow-2xl transition-all scale-100 ${
            lprAlert.eventType === "VIOLATION" 
              ? "bg-red-950/90 border-red-500/30 text-red-100" 
              : "bg-white border-emerald-500/30 text-emerald-100"
          }`}>
            
            {/* 아이콘 */}
            <div className="flex justify-center">
              {lprAlert.eventType === "VIOLATION" ? (
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30 text-red-400 text-3xl font-bold animate-bounce">
                  ⚠️
                </div>
              ) : (
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 text-emerald-400 text-3xl font-bold animate-pulse">
                  🚗
                </div>
              )}
            </div>

            {/* 타이틀 */}
            <div className="space-y-1">
              <h3 className={`text-xl font-extrabold tracking-tight ${
                lprAlert.eventType === "VIOLATION" ? "text-red-400" : "text-emerald-400"
              }`}>
                {lprAlert.message}
              </h3>
              <p className="text-[10px] text-slate-600">정문 실시간 LPR 카메라 판독 결과</p>
            </div>

            {/* 디테일 테이블 */}
            <div className="bg-white/80 border border-slate-200/60 rounded-2xl p-4 text-left space-y-2.5">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-600 text-xs">인식 차량 번호</span>
                <span className="font-mono font-bold text-xs text-slate-800">{lprAlert.carNumber}</span>
              </div>

              {lprAlert.eventType === "VISITOR" ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">방문객 성명</span>
                    <span className="font-bold text-slate-800">{lprAlert.visitorName} 님</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">담당 임직원</span>
                    <span className="text-slate-700">{lprAlert.hostName}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">위반 사원명</span>
                    <span className="font-bold text-red-400">{lprAlert.employeeName} 님</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">소속 부서</span>
                    <span className="text-slate-700">{lprAlert.department}</span>
                  </div>
                </>
              )}
            </div>

            {/* 차량 촬영 이미지 */}
            {lprAlert.imageUrl && (
              <div className="border border-slate-200/80 rounded-2xl overflow-hidden aspect-video bg-white flex items-center justify-center">
                <img 
                  src={lprAlert.imageUrl} 
                  alt="LPR Captured plate" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* 버튼 */}
            <button
              onClick={() => setLprAlert(null)}
              className={`w-full py-3 rounded-xl font-bold text-xs text-white transition-all shadow-md ${
                lprAlert.eventType === "VIOLATION"
                  ? "bg-red-600 hover:bg-red-500 shadow-red-600/10"
                  : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10"
              }`}
            >
              알림 확인 및 무선 열림 제어
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default function SecurityDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-600 font-sans text-sm">
        로딩 중...
      </div>
    }>
      <SecurityDashboardContent />
    </Suspense>
  );
}
