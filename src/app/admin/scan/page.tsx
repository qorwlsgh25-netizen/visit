import prisma from "@/lib/prisma";
import Link from "next/link";
import CheckInForm from "@/app/components/CheckInForm";
import { cookies } from "next/headers";

interface ScanPageProps {
  searchParams: Promise<{ id?: string; bypass?: string }>;
}

export default async function ScanPage({ searchParams }: ScanPageProps) {
  const { id } = await searchParams;

  // 보안협력사 및 최고관리자 세션 검증
  let isAuthorized = false;
  const cookieStore = await cookies();
  const securityEmail = cookieStore.get("security_email")?.value;
  
  if (securityEmail) {
    const cleanEmail = securityEmail.trim().toLowerCase();
    // 등록된 경비원인지 체크
    const staff = await prisma.securityStaff.findUnique({
      where: { email: cleanEmail }
    });
    if (staff) {
      isAuthorized = true;
    }
    
    // 최고관리자 이메일인 경우에도 권한 허용
    if (!isAuthorized) {
      const adminConfig = await prisma.adminConfig.findUnique({
        where: { id: "singleton" }
      });
      if (adminConfig && adminConfig.adminEmail.toLowerCase().trim() === cleanEmail) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-slate-800 font-sans">
        <div className="bg-red-950/20 border border-red-900/40 p-8 rounded-2xl max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 text-red-500 text-3xl font-bold flex items-center justify-center">🔒</div>
          <h2 className="text-xl font-bold text-red-400">보안 접근 권한이 없습니다.</h2>
          <p className="text-sm text-slate-600">
            정문 경비원 보안 로그인이 필요한 영역입니다.<br />
            경비원 이메일 보안접속 완료 후 다시 시도해 주십시오.
          </p>
          <div className="pt-4">
            <Link href="/admin/dashboard" className="inline-block px-5 py-2.5 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-lg text-xs font-bold transition-all">
              경비실 대시보드로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 1. 예약 ID가 전달되지 않은 경우 에러 화면 노출
  if (!id) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-slate-800 font-sans">
        <div className="bg-red-950/20 border border-red-900/40 p-8 rounded-2xl max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 text-red-500 text-3xl font-bold">!</div>
          <h2 className="text-xl font-bold text-red-400">QR코드 인식 실패</h2>
          <p className="text-sm text-slate-600">조회할 예약 번호(ID) 정보가 누락되었습니다. 올바른 QR코드인지 다시 확인해 주십시오.</p>
          <div className="pt-4">
            <Link href="/request" className="inline-block px-5 py-2.5 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-lg text-xs font-bold transition-all">
              방문 신청 페이지로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. 6자리 ID로 예약 조회
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      companions: true,
    },
  });

  // 3. 일치하는 예약이 없는 경우 에러 화면 노출
  if (!reservation) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-slate-800 font-sans">
        <div className="bg-red-950/20 border border-red-900/40 p-8 rounded-2xl max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 text-red-500 text-3xl font-bold">?</div>
          <h2 className="text-xl font-bold text-red-400">예약 내역 없음</h2>
          <p className="text-sm text-slate-600">예약번호 <code className="bg-white px-2 py-1 rounded text-red-300 font-mono text-xs">{id}</code>에 해당하는 신청 내역이 존재하지 않거나 이미 만료되었습니다.</p>
          <div className="pt-4">
            <Link href="/request" className="inline-block px-5 py-2.5 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-lg text-xs font-bold transition-all">
              방문 신청 페이지로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 일시 포맷팅
  const startStr = new Date(reservation.visitDateTime).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endStr = reservation.visitEndDateTime 
    ? new Date(reservation.visitEndDateTime).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl backdrop-blur-md shadow-2xl overflow-hidden">
        
        {/* 상단 헤더 */}
        <div className="bg-slate-500 border-b border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-sm font-bold text-slate-600 tracking-wider uppercase">보안담당자용 방문객 확인창</span>
          </div>
          <div className="flex items-center space-x-3">
            <Link 
              href="/admin/dashboard" 
              className="px-3.5 py-1.5 bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/50 rounded-lg text-xs font-semibold text-slate-500 hover:text-white transition-colors"
            >
              Dashboard 이동
            </Link>
            <span className="text-xs bg-indigo-500/10 border border-[#0F4C81]/20 px-3 py-1.5 rounded-lg text-slate-600 font-mono font-bold">
              예약 번호: {reservation.id}
            </span>
          </div>
        </div>

        {/* 바디 상세 내용 */}
        <div className="p-6 sm:p-8 space-y-6 text-white">
          
          {/* 승인 상태 알림판 */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-5">
            <div>
              <p className="text-xs text-[#0F4C81] mb-1">방문 승인 상태</p>
              <h3 className="text-lg font-bold">
                {reservation.status === "APPROVED" && <span className="text-emerald-400">● 최종 승인됨 (입문 대기)</span>}
                {reservation.status === "PENDING" && <span className="text-amber-400">● 승인 대기중</span>}
                {reservation.status === "REJECTED" && <span className="text-red-400">● 방문 반려됨</span>}
                {reservation.status === "CANCELLED" && <span className="text-rose-500 line-through">● 방문 신청 취소됨 (신청자 취소)</span>}
                {reservation.status === "ENTERED" && <span className="text-sky-400">● 건물 입실완료 (사내 미팅중)</span>}
                {reservation.status === "EXITED" && <span className="text-slate-600">● 출문 회수완료 (퇴실)</span>}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#0F4C81] mb-1">신청 일자</p>
              <p className="text-xs text-slate-700 font-mono">
                {new Date(reservation.createdAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* 1. 방문객 정보 */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-600 border-l-2 border-[#0F4C81] pl-2">1. 대표 방문자 인적사항</h4>
            <div className="bg-[#F8F9FA] border border-slate-200 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-[#0F4C81] block mb-1">성명 (생년월일)</span>
                <span className="font-semibold">{reservation.visitorName} ({reservation.birthDate})</span>
              </div>
              <div>
                <span className="text-xs text-[#0F4C81] block mb-1">연락처</span>
                <span className="font-semibold">{reservation.phoneNumber}</span>
              </div>
              <div>
                <span className="text-xs text-[#0F4C81] block mb-1">소속 회사</span>
                <span className="font-semibold">{reservation.organization}</span>
              </div>
              <div>
                <span className="text-xs text-[#0F4C81] block mb-1">이메일 주소</span>
                <span className="font-semibold text-slate-700 font-mono">{reservation.visitorEmail}</span>
              </div>
              {reservation.carNumber && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-[#0F4C81] block mb-1">차량 번호 / 차종</span>
                  <span className="font-semibold">{reservation.carNumber} ({reservation.carType || "미지정"})</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. 동행자 리스트 (있는 경우에만 노출) */}
          {reservation.companions && reservation.companions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-600 border-l-2 border-[#0F4C81] pl-2">
                2. 동행자 명단 ({reservation.companions.length}명)
              </h4>
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {reservation.companions.map((comp) => (
                  <div key={comp.id} className="bg-[#F8F9FA] border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-[#0F4C81] block">성명 (소속)</span>
                      <span className="font-bold text-slate-800">{comp.name} ({comp.organization})</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#0F4C81] block">연락처</span>
                      <span className="text-slate-700">{comp.phoneNumber}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#0F4C81] block">이메일</span>
                      <span className="text-slate-700 font-mono">{comp.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. 방문 내용 */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-600 border-l-2 border-[#0F4C81] pl-2">3. 방문 내용 및 목적</h4>
            <div className="bg-[#F8F9FA] border border-slate-200 rounded-2xl p-5 space-y-3.5 text-sm">
              <div>
                <span className="text-xs text-[#0F4C81] block mb-1">방문 예정 일시</span>
                <span className="font-semibold text-slate-800">
                  {startStr} {endStr ? ` ~ ${endStr}` : " (당일)"}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#0F4C81] block mb-1">방문 목적</span>
                <span className="font-semibold text-slate-800">{reservation.purpose}</span>
              </div>
            </div>
          </div>

          {/* 4. 사내 담당자 정보 */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-600 border-l-2 border-[#0F4C81] pl-2">4. 사내 담당 임직원 (호스트)</h4>
            <div className="bg-[#F8F9FA] border border-slate-200 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-[#0F4C81] block mb-1">부서 / 성명</span>
                <span className="font-semibold">{reservation.hostDepartment || "미기입"} / {reservation.hostName}</span>
              </div>
              <div>
                <span className="text-xs text-[#0F4C81] block mb-1">연락처</span>
                <span className="font-semibold">{reservation.hostPhone}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-xs text-[#0F4C81] block mb-1">담당자 이메일</span>
                <span className="font-semibold text-slate-700 font-mono">{reservation.hostEmail}</span>
              </div>
            </div>
          </div>

          {/* 5. 정문 출입 보안 통제 패널 */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <CheckInForm reservation={reservation} />
          </div>

        </div>

        {/* 하단 푸터 액션 */}
        <div className="bg-slate-500 border-t border-slate-200 p-6 text-center">
          <p className="text-xs text-slate-600/50">
            &copy; {new Date().getFullYear()} 네티젠 테크 통합 보안 출입 관리 시스템
          </p>
        </div>
      </div>
    </div>
  );
}
