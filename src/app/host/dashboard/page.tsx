"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  verifyHostToken, 
  requestHostLoginLink, 
  getHostReservations, 
  updateReservationStatus,
  logout
} from "@/app/actions/reservation";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 사용자 세션 및 상태
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 대시보드 데이터 상태
  const [reservations, setReservations] = useState<any[]>([]);
  const [selectedRes, setSelectedRes] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "completed">("pending");
  
  // 로그인 인풋 상태
  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // 1. 토큰 및 세션 로그인 검증
  useEffect(() => {
    const initSession = async () => {
      const urlEmail = searchParams.get("email");
      const urlToken = searchParams.get("token");

      if (urlEmail && urlToken) {
        setLoading(true);
        try {
          const res = await verifyHostToken(urlEmail, urlToken);
          if (res.success) {
            sessionStorage.setItem("host_email", urlEmail.trim().toLowerCase());
            setEmail(urlEmail.trim().toLowerCase());
            
            // 깔끔한 URL 정리를 위해 파라미터 소거
            router.replace("/host/dashboard");
          } else {
            setError(res.error || "인증 토큰 검증에 실패했습니다.");
          }
        } catch (err) {
          setError("인증 과정에서 시스템 오류가 발생했습니다.");
        } finally {
          setLoading(false);
        }
        return;
      }

      // 기존 세션 복구
      const savedEmail = sessionStorage.getItem("host_email");
      if (savedEmail) {
        setEmail(savedEmail);
        loadReservations(savedEmail);
      } else {
        setLoading(false);
      }
    };

    initSession();
  }, [searchParams]);

  // 2. 예약 신청 내역 로드
  const loadReservations = async (hostEmail: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getHostReservations(hostEmail);
      if (res.success && res.data) {
        setReservations(res.data);
        // 기본 선택 예약 설정 및 상세 화면 정보 갱신
        if (res.data.length > 0) {
          setSelectedRes((prev: any) => {
            if (!prev) return res.data[0];
            const updatedSelf = res.data.find(r => r.id === prev.id);
            return updatedSelf || prev;
          });
        }
      } else {
        if (!silent) setError(res.error || "예약 목록을 가져오는 데 실패했습니다.");
      }
    } catch (err) {
      if (!silent) setError("예약 내역 동기화 중 에러가 발생했습니다.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // 2.5 1분(60초) 주기 백그라운드 자동 갱신 제어 타이머
  useEffect(() => {
    if (!email) return;
    const interval = setInterval(() => {
      loadReservations(email, true);
    }, 60000);
    return () => clearInterval(interval);
  }, [email]);

  // 3. 로그인 링크 요청
  const handleRequestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;
    setLoginLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await requestHostLoginLink(loginEmail);
      if (res.success) {
        setSuccessMsg(res.message || "이메일로 보안 로그인 링크가 발송되었습니다.");
      } else {
        setError(res.error || "로그인 요청에 실패했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "서버 통신 중 에러가 발생했습니다.");
    } finally {
      setLoginLoading(false);
    }
  };

  // 4. 승인/반려 상태 처리
  const handleUpdateStatus = async (id: string, nextStatus: "APPROVED" | "REJECTED") => {
    if (!email) return;
    const bypassConfirm = 
      (typeof window !== "undefined" && (window as any).__bypassConfirm) ||
      (typeof window !== "undefined" && window.location.search.includes("bypass=true"));
    if (!bypassConfirm && !confirm(`이 방문 신청을 ${nextStatus === "APPROVED" ? "승인" : "반려"} 처리하시겠습니까?`)) return;

    setLoading(true);
    try {
      const res = await updateReservationStatus(id, nextStatus);
      if (res.success && res.data) {
        alert(`예약이 정상적으로 ${nextStatus === "APPROVED" ? "승인" : "반려"} 처리되었습니다.`);
        // 목록 갱신 및 선택 항목 상세 업데이트
        const updatedList = reservations.map(r => r.id === id ? { ...r, status: nextStatus } : r);
        setReservations(updatedList);
        setSelectedRes({ ...selectedRes, status: nextStatus });
      } else {
        alert(res.error || "상태 변경에 실패했습니다.");
      }
    } catch (err) {
      alert("상태 변경 요청 중 통신 에러가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    await logout();
    sessionStorage.removeItem("host_email");
    setEmail(null);
    setReservations([]);
    setSelectedRes(null);
    setError(null);
    setSuccessMsg(null);
  };

  // 탭 분류 필터
  const filteredList = reservations.filter(res => {
    if (activeTab === "pending") return res.status === "PENDING";
    if (activeTab === "approved") return res.status === "APPROVED" || res.status === "ENTERED";
    return res.status === "REJECTED" || res.status === "CANCELLED" || res.status === "EXITED";
  });

  // 날짜 포맷터
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- 화면 1: 로그인하지 않은 상태 (이메일 매직링크 전송화면) ---
  if (!email) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <span className="px-4 py-2 rounded-full bg-indigo-500/10 border border-[#0F4C81]/20 text-xs font-bold text-slate-600 mb-6 inline-block">
              HOST CONSOLE
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">임직원 승인 콘솔</h2>
            <p className="mt-2 text-sm text-slate-500/60">
              담당 호스트 이메일 주소를 입력하시면 검토 대시보드로 즉시 입장하는 매직링크 메일을 전송합니다.
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
                  사내 이메일 주소
                </label>
                <input
                  type="email"
                  id="loginEmail"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@hniruja.com"
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

  // --- 화면 2: 로그인 상태 (메인 관리 콘솔 대시보드) ---
  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans">
      
      {/* 탑 네비게이션 */}
      <header className="border-b border-slate-200 bg-white backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-[#0F4C81] text-white flex items-center justify-center text-xs font-extrabold shadow-xs">
            N
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-slate-900">네티젠 테크</span>
            <span className="block text-[9px] text-[#0F4C81] font-semibold uppercase tracking-wider">호스트 승인 대시보드</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs font-mono text-slate-600/80">{email} 님</span>
          <button 
            onClick={handleLogout}
            className="px-3.5 py-1.5 border border-slate-200 hover:border-[#0F4C81]/50 rounded-lg text-xs font-semibold text-[#0F4C81] hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">
        
        {/* 좌측 패널: 탭 분류 및 리스트 (5/12 크기) */}
        <div className="lg:col-span-5 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden p-4 space-y-4 max-h-[82vh]">
          {/* 탭 헤더 */}
          <div className="flex bg-white rounded-xl p-1 border border-slate-200">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "pending" 
                  ? "bg-[#0F4C81] text-white shadow-md shadow-indigo-600/10" 
                  : "text-[#0F4C81] hover:text-white"
              }`}
            >
              대기중 ({reservations.filter(r => r.status === "PENDING").length})
            </button>
            <button
              onClick={() => setActiveTab("approved")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "approved" 
                  ? "bg-[#0F4C81] text-white shadow-md shadow-indigo-600/10" 
                  : "text-[#0F4C81] hover:text-white"
              }`}
            >
              승인/입실 ({reservations.filter(r => r.status === "APPROVED" || r.status === "ENTERED").length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "completed" 
                  ? "bg-[#0F4C81] text-white shadow-md shadow-indigo-600/10" 
                  : "text-[#0F4C81] hover:text-white"
              }`}
            >
              종료/반려 ({reservations.filter(r => r.status === "REJECTED" || r.status === "CANCELLED" || r.status === "EXITED").length})
            </button>
          </div>

          {/* 리스트 출력부 */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            {filteredList.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-[#0F4C81]/50">
                해당 조건의 방문 신청 내역이 없습니다.
              </div>
            ) : (
              filteredList.map((res) => (
                <div
                  key={res.id}
                  onClick={() => setSelectedRes(res)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedRes?.id === res.id
                      ? "bg-white border-[#0F4C81]/80 shadow-lg shadow-indigo-500/5"
                      : "bg-[#F8F9FA] border-slate-200 hover:border-slate-200 hover:bg-white/60"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono font-bold text-[#0F4C81]">{res.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      res.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                      res.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      res.status === "ENTERED" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                      res.status === "EXITED" ? "bg-slate-500/10 text-slate-600 border border-slate-500/20" :
                      "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}>
                      {res.status === "PENDING" && "대기중"}
                      {res.status === "APPROVED" && "승인됨"}
                      {res.status === "ENTERED" && "입실함"}
                      {res.status === "EXITED" && "퇴실함"}
                      {res.status === "REJECTED" && "반려됨"}
                      {res.status === "CANCELLED" && "취소됨"}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">{res.visitorName} ({res.organization})</h4>
                  <p className="text-xs text-slate-600/70 mt-1 line-clamp-1">{res.purpose}</p>
                  <p className="text-[10px] text-slate-500 mt-2">{formatDate(res.visitDateTime)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 우측 패널: 세부 정보 및 결재 승인 패널 (7/12 크기) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between max-h-[82vh] overflow-y-auto">
          {selectedRes ? (
            <div className="space-y-6">
              {/* 상세 헤더 */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-[#0F4C81] tracking-wide uppercase">방문 신청 명세서</span>
                  <h3 className="text-xl font-bold mt-1 text-slate-900">{selectedRes.visitorName} 님의 예약</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs block text-[#0F4C81]">접수번호</span>
                  <span className="text-base font-mono font-bold text-slate-600">{selectedRes.id}</span>
                </div>
              </div>

              {/* 1. 기본 신청인 인적사항 */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-600">1. 대표 방문객 인적사항</h5>
                <div className="bg-[#F8F9FA] border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#0F4C81] block mb-0.5">방문자 성명</span>
                    <span className="font-semibold">{selectedRes.visitorName}</span>
                  </div>
                  <div>
                    <span className="text-[#0F4C81] block mb-0.5">생년월일 (신분증 검사용)</span>
                    <span className="font-bold font-mono text-emerald-400 text-sm">{selectedRes.birthDate}</span>
                  </div>
                  <div>
                    <span className="text-[#0F4C81] block mb-0.5">연락처</span>
                    <span className="font-semibold">{selectedRes.phoneNumber}</span>
                  </div>
                  <div>
                    <span className="text-[#0F4C81] block mb-0.5">소속 회사</span>
                    <span className="font-semibold">{selectedRes.organization}</span>
                  </div>
                  <div>
                    <span className="text-[#0F4C81] block mb-0.5">이메일 주소</span>
                    <span className="font-semibold font-mono text-slate-700">{selectedRes.visitorEmail}</span>
                  </div>
                  {selectedRes.carNumber && (
                    <div className="col-span-2">
                      <span className="text-[#0F4C81] block mb-0.5">차량번호 / 차종</span>
                      <span className="font-semibold">{selectedRes.carNumber} ({selectedRes.carType || "미기입"})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. 동행자 상세 정보 명단 */}
              {selectedRes.companions && selectedRes.companions.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-600">2. 동행자 상세 정보 ({selectedRes.companions.length}명)</h5>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {selectedRes.companions.map((c: any, index: number) => (
                      <div key={c.id} className="bg-[#F8F9FA] border border-slate-200 p-3.5 rounded-xl text-[11px] space-y-2">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                          <span className="font-bold text-slate-800">{index + 1}. {c.name} ({c.organization})</span>
                          <span className="text-slate-600 font-mono">{c.phoneNumber}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-700 text-[10px]">
                          <div>
                            <span className="text-[#0F4C81]/80 block mb-0.5">이메일 주소</span>
                            <span className="font-mono">{c.email || "미기입"}</span>
                          </div>
                          <div>
                            <span className="text-[#0F4C81]/80 block mb-0.5">차량 번호</span>
                            <span>{c.carNumber || "차량 없음 (도보)"}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[#0F4C81]/80 block mb-0.5">반입 장비 품목</span>
                            <span className="font-semibold text-slate-500">{c.equipment || "없음"}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[#0F4C81]/80 block mb-0.5 font-medium">기타 특이사항 (비고)</span>
                            <span className="text-slate-700">{c.notes || "없음"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. 예약 정보 */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-600">3. 예약 일정 및 상세 목적</h5>
                <div className="bg-[#F8F9FA] border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                  <div>
                    <span className="text-[#0F4C81] block mb-0.5">방문 일정</span>
                    <span className="font-semibold text-slate-500">
                      {formatDate(selectedRes.visitDateTime)}
                      {selectedRes.visitEndDateTime && ` ~ ${formatDate(selectedRes.visitEndDateTime)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#0F4C81] block mb-0.5">방문 목적</span>
                    <span className="font-semibold">{selectedRes.purpose}</span>
                  </div>
                </div>
              </div>

              {/* 정문 보안처리 현황 (ENTERED, EXITED 상태 시 출력) */}
              {(selectedRes.status === "ENTERED" || selectedRes.status === "EXITED") && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-600">🔒 정문 경비실 보안검증 현황</h5>
                  <div className="bg-white/50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[#0F4C81] block mb-0.5">임시출입카드 발급번호</span>
                      <span className="font-bold text-emerald-400">Card No. {selectedRes.temporaryCardNumber || "미발급"}</span>
                    </div>
                    <div>
                      <span className="text-[#0F4C81] block mb-0.5">디바이스 카메라 실링</span>
                      <span className="font-semibold">{selectedRes.deviceSealed ? "실링 완료" : "대상 없음"}</span>
                    </div>
                    <div>
                      <span className="text-[#0F4C81] block mb-0.5">정문 입실 시간</span>
                      <span className="font-semibold text-slate-700 font-mono">{selectedRes.enteredAt ? formatDate(selectedRes.enteredAt) : "-"}</span>
                    </div>
                    <div>
                      <span className="text-[#0F4C81] block mb-0.5">정문 퇴실 시간</span>
                      <span className="font-semibold text-slate-700 font-mono">{selectedRes.exitedAt ? formatDate(selectedRes.exitedAt) : "건물 내부 잔류"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 결재 액션 버튼 */}
              {selectedRes.status === "PENDING" && (
                <div className="flex space-x-4 border-t border-slate-200 pt-6">
                  <button
                    onClick={() => handleUpdateStatus(selectedRes.id, "REJECTED")}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs hover:bg-red-900/10 transition-colors"
                  >
                    방문 반려
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedRes.id, "APPROVED")}
                    className="flex-1 py-3 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white text-white rounded-xl font-bold text-xs hover:shadow-lg hover:shadow-indigo-500/15 transition-all"
                  >
                    방문 승인 완료
                  </button>
                </div>
              )}

              {selectedRes.status !== "PENDING" && (
                <div className="border-t border-slate-200 pt-6 text-center text-xs text-[#0F4C81]/50">
                  결재 완료된 신청서입니다. (상태: {selectedRes.status})
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#0F4C81]/30 space-y-2">
              <span>🗂️</span>
              <span className="text-xs">상세 명세를 조회할 예약 신청을 선택해 주세요.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function HostDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-800 font-sans text-sm">
        로딩 중...
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
