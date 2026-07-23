"use client";

export default function GuideCard() {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    alert("준비 중입니다.");
  };

  return (
    <div 
      onClick={handleClick}
      className="group relative rounded-2xl bg-white border border-slate-200/80 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#0F4C81]/30 hover:shadow-lg hover:shadow-slate-200 cursor-pointer"
    >
      <div className="w-12 h-12 rounded-xl bg-[#0F4C81]/8 border border-[#0F4C81]/15 flex items-center justify-center text-[#0F4C81] mb-6 transition-all duration-300">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
        </svg>
      </div>
      <h3 className="text-xl font-bold mb-3 text-slate-900">방문 가이드라인</h3>
      <p className="text-slate-600 text-sm leading-relaxed mb-6">
        사업장 방문 시 준수해야 하는 정보보안, 안전수칙 및 필요 서류를 안내합니다.
      </p>
      <span className="inline-flex items-center text-sm font-semibold text-[#0F4C81] hover:text-[#0c3e6b] transition-colors">
        안내 문서 보기 &gt;
      </span>
    </div>
  );
}
