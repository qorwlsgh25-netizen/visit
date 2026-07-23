import Link from "next/link";
import fs from "fs";
import path from "path";
import Footer from "./components/Footer";
import GuideCard from "./components/GuideCard";
import { getBrandConfig } from "@/app/actions/brand";

export default async function Home() {
  // 개인정보처리방침 마크다운 파일 내용 로드
  let privacyContent = "";
  try {
    const privacyPath = path.join(process.cwd(), "info", "개인정보처리방침.md");
    if (fs.existsSync(privacyPath)) {
      privacyContent = fs.readFileSync(privacyPath, "utf-8");
    }
  } catch (error) {
    console.error("개인정보처리방침 파일을 읽어오지 못했습니다:", error);
  }

  // 브랜드 동적 설정 로드
  const brandRes = await getBrandConfig();
  const brand = brandRes.data || {
    companyName: "네티젠 테크",
    locationName: "본사",
    logoUrl: null,
    copyrightText: "© 2026 Netizen Tech. All Rights Reserved."
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans flex flex-col justify-between">
      {/* 상단 헤더 */}
      <header className="border-b border-slate-200/80 backdrop-blur-md sticky top-0 z-50 bg-white/90">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 flex items-center justify-center">
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt={`${brand.companyName} 로고`} className="w-full h-full object-contain bg-transparent" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-[#0F4C81] text-white flex items-center justify-center text-sm font-extrabold shadow-sm">
                  {brand.companyName.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900">
                {brand.companyName}
              </span>
              <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                VISITOR SYSTEM
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-6 text-sm text-slate-600">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs border border-emerald-200/60 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              시스템 정상 작동 중 (정밀 모니터링)
            </span>
          </div>
        </div>
      </header>

      {/* 중앙 메인 컨텐츠 */}
      <main className="max-w-6xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center items-center w-full">
        {/* 히어로 영역 */}
        <div className="text-center max-w-2xl mb-16">
          <span className="text-[#0F4C81] text-sm sm:text-base font-bold uppercase tracking-widest inline-block mb-3">
            {brand.companyName} ({brand.locationName})
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 text-slate-900 leading-tight">
            누구나 쉽고 편리한<br/>사전 방문 예약
          </h1>
          <p className="text-slate-600 text-base md:text-lg font-normal leading-relaxed">
            {brand.companyName} 연구소 및 사업장 방문을 위한 사전 예약 신청 페이지입니다.<br/>
            미리 방문 신청과 약관 서명을 완료하시면 신속한 입문 처리가 가능합니다.
          </p>
        </div>

        {/* 핵심 네비게이션 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {/* 카드 1: 방문 신청 */}
          <div className="group relative rounded-2xl bg-white border border-slate-200/80 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#0F4C81]/30 hover:shadow-lg hover:shadow-slate-200">
            <div className="w-12 h-12 rounded-xl bg-[#0F4C81]/8 border border-[#0F4C81]/15 flex items-center justify-center text-[#0F4C81] mb-6 transition-all duration-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">방문 예약 신청</h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              방문 정보(일시, 목적, 소속 등)를 등록하고 서약서 및 약관 동의를 진행합니다.
            </p>
            <Link href="/request" className="inline-flex items-center text-sm font-semibold text-[#0F4C81] hover:text-[#0c3e6b] transition-colors">
              신청하러 가기 &gt;
            </Link>
          </div>

          {/* 카드 2: 신청 내역 조회 */}
          <div className="group relative rounded-2xl bg-white border border-slate-200/80 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#0F4C81]/30 hover:shadow-lg hover:shadow-slate-200">
            <div className="w-12 h-12 rounded-xl bg-[#0F4C81]/8 border border-[#0F4C81]/15 flex items-center justify-center text-[#0F4C81] mb-6 transition-all duration-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">예약 결과 조회</h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              이전에 신청한 방문 예약의 승인 여부와 상세 예약 정보를 확인합니다.
            </p>
            <Link href="/lookup" className="inline-flex items-center text-sm font-semibold text-[#0F4C81] hover:text-[#0c3e6b] transition-colors">
              예약 조회하기 &gt;
            </Link>
          </div>

          {/* 카드 3: 안전수칙 및 보안서약서 */}
          <GuideCard />
        </div>
      </main>

      {/* 하단 푸터 */}
      <Footer privacyContent={privacyContent} copyrightText={brand.copyrightText} isLicenseValid={brandRes.isLicenseValid} />
    </div>
  );
}
