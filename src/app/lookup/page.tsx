"use client";

import { useState } from "react";
import Link from "next/link";
import { lookupReservation, cancelReservation } from "@/app/actions/reservation";

export default function LookupPage() {
  const [visitorEmail, setVisitorEmail] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 조회 완료된 예약 데이터 상태
  const [reservationData, setReservationData] = useState<any | null>(null);

  // 조회 핸들러
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorEmail || !reservationId) return;

    setLoading(true);
    setError(null);
    setReservationData(null);

    try {
      const result = await lookupReservation(visitorEmail, reservationId);
      if (result.success && result.data) {
        setReservationData(result.data);
      } else {
        setError(result.error || "일치하는 예약 정보를 찾을 수 없습니다.");
      }
    } catch (err: any) {
      setError(err.message || "방문 예약 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 취소 처리 핸들러
  const handleCancel = async () => {
    if (!reservationData) return;
    // 일반 사용자 환경에서는 확인 대화창을 보여주고, 테스트 자동화 시에는 우회 동작을 허용합니다.
    const confirmCancel =
      (typeof window !== "undefined" && (window as any).__bypassConfirm) ||
      window.confirm(
        "정말로 이 방문 신청을 취소하시겠습니까?\n취소 시 신청인 및 사내 담당 임직원에게 취소 안내 메일이 즉시 발송됩니다."
      );
    if (!confirmCancel) return;

    setCancelling(true);
    setError(null);

    try {
      const result = await cancelReservation(visitorEmail, reservationId);
      if (result.success && result.data) {
        alert("방문 예약 신청이 정상적으로 취소 처리되었습니다.");
        setReservationData(result.data); // 취소 처리 완료된 데이터(상태: CANCELLED)로 상태 갱신
      } else {
        setError(result.error || "예약 취소 처리에 실패했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "예약 취소 중 서버 통신 에러가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  };

  // 조회 상태 초기화 (다시 조회하기)
  const handleReset = () => {
    setReservationData(null);
    setError(null);
  };

  // 일정 날짜 포맷터
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2.5 px-4 py-2 rounded-full bg-[#0F4C81]/8 border border-[#0F4C81]/15 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#0F4C81] animate-pulse"></span>
            <span className="text-xs font-bold text-[#0F4C81] tracking-wide uppercase">방문 신청 조회 및 취소</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">방문 신청 내역 조회</h2>
          <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
            신청 시 등록한 이메일 주소와 6자리 예약 접수번호를 입력하시면 승인 현황 확인 및 방문 취소를 진행할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl px-4">
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-lg space-y-6">
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {/* 상태 A: 조회 폼 (데이터가 없는 경우) */}
          {!reservationData && (
            <form onSubmit={handleLookup} className="space-y-6">
              <div className="space-y-5">
                <div>
                  <label htmlFor="visitorEmail" className="block text-xs font-semibold text-slate-700 mb-2">
                    신청자 이메일 주소
                  </label>
                  <input
                    type="email"
                    id="visitorEmail"
                    required
                    value={visitorEmail}
                    onChange={(e) => setVisitorEmail(e.target.value)}
                    placeholder="visitor@company.com"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="reservationId" className="block text-xs font-semibold text-slate-700 mb-2">
                    예약 접수번호 (6자리 숫자)
                  </label>
                  <input
                    type="text"
                    id="reservationId"
                    required
                    maxLength={6}
                    value={reservationId}
                    onChange={(e) => setReservationId(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="123456"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-mono tracking-widest focus:outline-none focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] transition-colors"
                  />
                </div>
              </div>

              <div className="flex space-x-4 border-t border-slate-200 pt-6">
                <Link
                  href="/"
                  className="flex-1 px-5 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all text-sm text-center flex items-center justify-center"
                >
                  메인 화면으로
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-5 py-3 bg-[#0F4C81] hover:bg-[#0c3e6b] rounded-xl font-medium text-sm text-white hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>조회 중...</span>
                    </>
                  ) : (
                    <span>방문 예약 조회하기</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 상태 B: 상세 내역 조회 완료 및 취소 처리 화면 */}
          {reservationData && (
            <div className="space-y-6">
              
              {/* 예약 상태 배지 요약 */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">방문 승인 상태</p>
                  <h3 className="text-base font-bold">
                    {reservationData.status === "APPROVED" && <span className="text-emerald-600">● 최종 승인 완료</span>}
                    {reservationData.status === "PENDING" && <span className="text-amber-600">● 사내 승인 대기중</span>}
                    {reservationData.status === "REJECTED" && <span className="text-rose-600">● 방문 반려됨</span>}
                    {reservationData.status === "CANCELLED" && <span className="text-red-600 line-through">● 방문 신청 취소됨</span>}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 mb-1">접수 예약번호</p>
                  <p className="text-sm text-slate-800 font-mono font-bold">{reservationData.id}</p>
                </div>
              </div>

              {/* 1. 신청자 기본 인적사항 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">1. 대표 방문자 정보</h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">성명 (생년월일)</span>
                    <span className="font-semibold text-slate-800">{reservationData.visitorName} ({reservationData.birthDate})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">연락처</span>
                    <span className="font-semibold text-slate-800">{reservationData.phoneNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">소속사명</span>
                    <span className="font-semibold text-slate-800">{reservationData.organization}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">이메일 주소</span>
                    <span className="font-semibold font-mono text-slate-700">{reservationData.visitorEmail}</span>
                  </div>
                </div>
              </div>

              {/* 2. 동행자 정보 */}
              {reservationData.companions && reservationData.companions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">2. 동행자 명단 ({reservationData.companions.length}명)</h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {reservationData.companions.map((c: any, idx: number) => (
                      <div key={c.id} className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex justify-between text-xs">
                        <span className="font-bold text-slate-850">{idx + 1}. {c.name} ({c.organization})</span>
                        <span className="text-slate-600 font-mono">{c.phoneNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. 예약 일정 및 상세 목적 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">3. 방문 일정 및 목적</h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">방문 일정</span>
                    <span className="font-semibold text-slate-800">
                      {formatDate(reservationData.visitDateTime)}
                      {reservationData.visitEndDateTime && ` ~ ${formatDate(reservationData.visitEndDateTime)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">방문 목적</span>
                    <span className="font-semibold text-slate-800">{reservationData.purpose}</span>
                  </div>
                </div>
              </div>

              {/* 4. 만나실 분 정보 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">4. 담당 임직원 (호스트)</h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">성명 (부서)</span>
                    <span className="font-semibold text-slate-800">{reservationData.hostName} ({reservationData.hostDepartment || "미지정"})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">이메일 주소</span>
                    <span className="font-semibold font-mono text-slate-700">{reservationData.hostEmail}</span>
                  </div>
                </div>
              </div>

              {/* 하단 액션 버튼 */}
              <div className="flex space-x-4 border-t border-slate-200 pt-6">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 px-5 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all text-sm text-center"
                >
                  다른 예약 조회
                </button>
                
                {/* 취소 처리되지 않은 상태(APPROVED, PENDING)인 경우에만 취소 버튼 표시 */}
                {reservationData.status !== "CANCELLED" && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex-1 px-5 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-medium text-sm text-white hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    {cancelling ? "취소 처리 중..." : "방문 신청 취소하기"}
                  </button>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
