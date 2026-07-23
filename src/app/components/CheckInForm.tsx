"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkInVisitor, checkOutVisitor } from "@/app/actions/reservation";

interface CheckInFormProps {
  reservation: {
    id: string;
    status: string;
    enteredAt: Date | null;
    exitedAt: Date | null;
    temporaryCardNumber: string | null;
    idCardKept: boolean;
    deviceSealed: boolean;
  };
}

export default function CheckInForm({ reservation }: CheckInFormProps) {
  const router = useRouter();

  // 입력 폼 상태
  const [idCardKept, setIdCardKept] = useState(reservation.idCardKept);
  const [deviceSealed, setDeviceSealed] = useState(reservation.deviceSealed);
  const [temporaryCardNumber, setTemporaryCardNumber] = useState(reservation.temporaryCardNumber || "");

  // 비즈니스 처리 상태
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. 입실 처리 (Check-in)
  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!temporaryCardNumber.trim()) {
      setError("임시출입카드 발급 번호를 반드시 입력해 주십시오.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await checkInVisitor(reservation.id, temporaryCardNumber, idCardKept, deviceSealed);
      if (res.success) {
        alert("성공적으로 방문객 입문(Check-in) 처리가 완료되었습니다.");
        router.refresh(); // 최신 DB 상태 반영을 위해 서버 컴포넌트 강제 리프레시
      } else {
        setError(res.error || "입문 처리 도중 오류가 발생했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "서버 통신 에러가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 2. 퇴실 처리 (Check-out)
  const handleCheckOut = async () => {
    const bypassConfirm = 
      (typeof window !== "undefined" && (window as any).__bypassConfirm) ||
      (typeof window !== "undefined" && window.location.search.includes("bypass=true"));
    if (!bypassConfirm && !confirm("해당 방문객을 퇴실(Check-out) 처리하시겠습니까?\n퇴실 시 보관 중인 신분증을 반납하고 임시출입카드를 회수해 주십시오.")) return;
    setLoading(true);
    setError(null);

    try {
      const res = await checkOutVisitor(reservation.id);
      if (res.success) {
        alert("퇴실(Check-out) 및 신분증/임시카드 회수 완료 처리가 정상 완료되었습니다.");
        router.refresh();
      } else {
        setError(res.error || "퇴실 처리 도중 오류가 발생했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "서버 통신 에러가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 포맷팅 헬퍼
  const formatTime = (dateObj: Date | null) => {
    if (!dateObj) return "-";
    return new Date(dateObj).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 text-left">
      <h4 className="text-sm font-bold text-slate-600 border-l-2 border-[#0F4C81] pl-2">
        🔒 정문 보안출입 관리 통제실 (체크인/아웃)
      </h4>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {/* 상황 A: 대기 중이거나 이미 거절/취소된 경우 */}
      {reservation.status === "PENDING" && (
        <p className="text-xs text-amber-400 leading-relaxed bg-amber-500/5 p-4 rounded-xl border border-amber-500/15">
          ℹ️ 아직 사내 담당자(호스트)의 승인이 완료되지 않은 예약 건입니다. 승인이 완료된 이후에 입문 처리가 가능합니다.
        </p>
      )}
      {(reservation.status === "REJECTED" || reservation.status === "CANCELLED") && (
        <p className="text-xs text-rose-400 leading-relaxed bg-rose-500/5 p-4 rounded-xl border border-rose-500/15">
          ❌ 본 예약은 취소되었거나 반려된 신청 건입니다. 정문 통과 및 보안 카드 발급이 불가합니다.
        </p>
      )}

      {/* 상황 B: 승인 완료 상태 - 입실 체크인 진행 */}
      {reservation.status === "APPROVED" && (
        <form onSubmit={handleCheckIn} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* 신분증 체크 */}
            <label className="flex items-center space-x-3 bg-white border border-slate-200 p-4 rounded-xl cursor-pointer hover:border-slate-300 transition-colors select-none">
              <input
                type="checkbox"
                checked={idCardKept}
                onChange={(e) => setIdCardKept(e.target.checked)}
                className="w-4 h-4 rounded border-slate-200 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950"
              />
              <div className="text-left">
                <span className="text-xs font-bold block text-slate-800">방문자 신분증 보관</span>
                <span className="text-[10px] text-slate-500">실물 신분증 수령 후 경비실 임시 보관</span>
              </div>
            </label>

            {/* 보안 실링 체크 */}
            <label className="flex items-center space-x-3 bg-white border border-slate-200 p-4 rounded-xl cursor-pointer hover:border-slate-300 transition-colors select-none">
              <input
                type="checkbox"
                checked={deviceSealed}
                onChange={(e) => setDeviceSealed(e.target.checked)}
                className="w-4 h-4 rounded border-slate-200 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950"
              />
              <div className="text-left">
                <span className="text-xs font-bold block text-slate-800">카메라 보안 실링</span>
                <span className="text-[10px] text-slate-500">휴대폰/노트북 렌즈 보안 스티커 부착</span>
              </div>
            </label>

          </div>

          {/* 임시출입카드 기입란 */}
          <div>
            <label htmlFor="tempCard" className="block text-xs font-semibold text-[#0F4C81] mb-2">
              임시출입카드 발급 번호 (실물 보안카드 식별자)
            </label>
            <input
              type="text"
              id="tempCard"
              required
              value={temporaryCardNumber}
              onChange={(e) => setTemporaryCardNumber(e.target.value)}
              placeholder="예: No. 102"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-lg hover:shadow-emerald-500/10 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>입문 등록 처리 중...</span>
            ) : (
              <>
                <span>🚪</span>
                <span>정문 입문 완료 등록 (Check-in)</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* 상황 C: 입실 완료 상태 - 퇴실 체크아웃 진행 */}
      {reservation.status === "ENTERED" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[#0F4C81] block mb-0.5">배정된 임시출입카드</span>
              <span className="font-bold text-emerald-400">Card No. {reservation.temporaryCardNumber}</span>
            </div>
            <div>
              <span className="text-[#0F4C81] block mb-0.5">신분증 보관 여부</span>
              <span className="font-bold text-amber-400">{idCardKept ? "실물 보관 중" : "수령 안 함"}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[#0F4C81] block mb-0.5">정문 통과(입실) 시각</span>
              <span className="font-semibold text-slate-700 font-mono">{reservation.enteredAt ? new Date(reservation.enteredAt).toLocaleString("ko-KR") : "-"}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckOut}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-rose-500 to-red-600 hover:shadow-lg hover:shadow-rose-500/10 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>출문 등록 처리 중...</span>
            ) : (
              <>
                <span>🔑</span>
                <span>신분증/카드 회수 및 출문 완료 등록 (Check-out)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 상황 D: 퇴실 완료 상태 - 이력 완료 안내 */}
      {reservation.status === "EXITED" && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs leading-relaxed text-slate-600">
          <p className="text-emerald-600 font-bold flex items-center gap-1.5">
            <span>✓</span> 방문객 출입 절차가 최종 완료된 내역입니다.
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200">
            <div>
              <span className="text-indigo-500 block">입실 시각</span>
              <span className="text-slate-700 font-mono">{reservation.enteredAt ? new Date(reservation.enteredAt).toLocaleString("ko-KR") : "-"}</span>
            </div>
            <div>
              <span className="text-indigo-500 block">퇴실 시각</span>
              <span className="text-slate-700 font-mono">{reservation.exitedAt ? new Date(reservation.exitedAt).toLocaleString("ko-KR") : "-"}</span>
            </div>
            <div className="col-span-2">
              <span className="text-indigo-500 block">회수된 카드 식별자</span>
              <span className="text-slate-700 font-bold">Card No. {reservation.temporaryCardNumber} (회수 완료)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
