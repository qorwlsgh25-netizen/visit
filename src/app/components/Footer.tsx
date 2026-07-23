"use client";

import { useState } from "react";

interface FooterProps {
  privacyContent: string;
  copyrightText?: string;
  isLicenseValid?: boolean;
}

export default function Footer({ privacyContent, copyrightText, isLicenseValid = false }: FooterProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-slate-200 py-8 bg-[#F1F3F5] text-center text-slate-500 text-xs">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p>{copyrightText || "© 2026 Netizen Tech. All Rights Reserved."}</p>
            {!isLicenseValid && (
              <p className="text-[11px] font-semibold text-[#0F4C81]/80 hover:text-[#0F4C81] transition-colors">
                Powered by Visit Framework | Copyright ⓒ <a href="mailto:qorwlsgh25@gmail.com" className="underline font-bold">qorwlsgh25@gmail.com</a> (MIT License)
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <span 
              onClick={() => setIsModalOpen(true)}
              className="hover:text-slate-900 transition-colors cursor-pointer font-semibold underline decoration-slate-300 hover:decoration-slate-900 underline-offset-4"
            >
              Copyright and Privacy Policy
            </span>
          </div>
        </div>
      </footer>

      {/* 개인정보처리방침 모달 팝업 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white border border-slate-200 max-w-3xl w-full rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* 모달 헤더 */}
            <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0F4C81]"></span>
                <span>개인정보처리방침</span>
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-2 rounded-xl transition-colors"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            {/* 모달 바디 (내용 스크롤) */}
            <div className="p-6 md:p-8 overflow-y-auto text-left text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans select-text scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
              {privacyContent || "개인정보처리방침 문서를 불러오는 중입니다..."}
            </div>

            {/* 모달 푸터 */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                동의 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
