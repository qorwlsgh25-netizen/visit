"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBrandConfigForAdmin, updateBrandConfig } from "@/app/actions/brand";
import { getAdminEmail, requestAdminSecurityToken, validateSecurityToken } from "@/app/actions/smtp";

function BrandConfigContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [mode, setMode] = useState<"verify" | "request" | "form" | "error">("verify");
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [adminEmailInput, setAdminEmailInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("네티젠 테크");
  const [locationName, setLocationName] = useState("본사");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [faviconUrl, setFaviconUrl] = useState<string>("");
  const [copyrightText, setCopyrightText] = useState("© 2026 Netizen Tech. All Rights Reserved.");
  const [licenseKey, setLicenseKey] = useState<string>("");
  const [isLicenseValid, setIsLicenseValid] = useState<boolean>(false);
  const [hardwareId, setHardwareId] = useState<string>("");
  const [copiedHw, setCopiedHw] = useState<boolean>(false);

  useEffect(() => {
    async function initAuth() {
      setLoading(true);
      setError(null);

      // 1. 보안 인증 토큰이 존재하는 경우
      if (token) {
        setMode("verify");
        try {
          const valRes = await validateSecurityToken(token);
          if (valRes.success) {
            const res = await getBrandConfigForAdmin(token);
            if (res.success && "data" in res && res.data) {
              setCompanyName(res.data.companyName);
              setLocationName(res.data.locationName);
              setLogoUrl(res.data.logoUrl || "");
              setFaviconUrl(res.data.faviconUrl || "");
              setCopyrightText(res.data.copyrightText);
              setLicenseKey(res.data.licenseKey || "");
              if ("hardwareId" in res && typeof res.hardwareId === "string") {
                setHardwareId(res.hardwareId);
              }
              if ("isLicenseValid" in res) {
                setIsLicenseValid(!!res.isLicenseValid);
              }
              setMode("form");
            } else {
              setError("error" in res ? res.error : "브랜드 설정을 불러오는 중 오류가 발생했습니다.");
              setMode("error");
            }
          } else {
            setError(valRes.error || "만료되었거나 유효하지 않은 보안 로그인 토큰입니다.");
            setMode("error");
          }
        } catch (err: any) {
          setError(err.message || "보안 검증 에러가 발생했습니다.");
          setMode("error");
        } finally {
          setLoading(false);
        }
        return;
      }

      // 2. 토큰 없이 직접 접근한 경우 -> 이메일 보안 매직링크 요청 화면으로 전환
      try {
        const emailRes = await getAdminEmail();
        if (emailRes.success) {
          setRegisteredEmail(emailRes.adminEmail || null);
          setMode("request");
        } else {
          setError(emailRes.error || "최고 관리자 정보를 조회하지 못했습니다.");
          setMode("error");
        }
      } catch (err: any) {
        setError(err.message || "관리자 인증 정보 조회 에러");
        setMode("error");
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, [token]);

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    setDevLink(null);

    try {
      const res = await requestAdminSecurityToken(adminEmailInput);
      if (res.success) {
        setRegisteredEmail(adminEmailInput);
        if (res.isSmtpNotConfigured) {
          setSuccessMsg("SMTP 미설정 상태(부트스트랩)입니다. 아래 1회성 매직링크로 즉시 진입해 주십시오.");
          setDevLink(res.link || null);
        } else {
          setSuccessMsg(`보안인증 링크가 등록된 최고관리자 이메일(${adminEmailInput})로 전송되었습니다. 이메일에서 1-Click 인증 링크를 눌러 진입해 주십시오.`);
        }
      } else {
        setError(res.error || "보안 토큰 생성 실패");
      }
    } catch (err: any) {
      setError("서버 통신 중 에러가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("이미지 용량은 최대 2MB까지 업로드 가능합니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setter(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await updateBrandConfig({
        companyName,
        locationName,
        logoUrl: logoUrl || null,
        faviconUrl: faviconUrl || null,
        copyrightText,
        licenseKey: licenseKey || null,
      }, token || undefined);

      if (res.success) {
        if ("hardwareId" in res && typeof res.hardwareId === "string") {
          setHardwareId(res.hardwareId);
        }
        if ("isLicenseValid" in res) {
          setIsLicenseValid(!!res.isLicenseValid);
        }
        setSuccessMsg(
          res.isLicenseValid
            ? "브랜드 설정 및 1대1 PC 전용 저작권 해제 라이선스 키 인증이 성공적으로 완료되었습니다! 🎉"
            : "브랜드 정보가 저장되었습니다. (현재 PC의 Hardware ID와 불일치하거나 입력된 키가 없어 하단 저작권 표시가 유지됩니다.)"
        );
      } else {
        setError(res.error || "브랜드 설정 업데이트 실패");
      }
    } catch (err: any) {
      setError("서버 통신 에러가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-600">
        🔒 보안 세션 및 인증 토큰을 검증하는 중입니다...
      </div>
    );
  }

  // 이메일 보안 인증 요구 화면 (직접 접속 차단)
  if (mode === "request") {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#0F4C81]/10 text-[#0F4C81] flex items-center justify-center mx-auto text-2xl font-bold">
              🔒
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">최고 관리자 이중 보안 인증</h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                민감한 브랜드 및 CI/파비콘 설정 페이지입니다.<br />
                등록된 최고 관리자 이메일 주소를 입력하시면 이메일로 1회성 1-Click 로그인 링크가 발송됩니다.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                ⚠️ {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium space-y-2">
                <div>✅ {successMsg}</div>
                {devLink && (
                  <div className="pt-2 border-t border-emerald-200/60">
                    <a href={devLink} className="inline-block px-4 py-2 bg-[#0F4C81] text-white rounded-lg text-xs font-bold hover:bg-[#0c3e6b]">
                      🔑 부트스트랩 보안 1-Click 인증 진입하기
                    </a>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleRequestToken} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">최고 관리자 이메일 주소</label>
                <input
                  type="email"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  placeholder={registeredEmail ? `등록 이메일: ${registeredEmail}` : "예: admin@netizentech.com"}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50"
              >
                {saving ? "보안링크 생성 중..." : "이메일 보안 1-Click 링크 발송"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 상단 네비게이션 헤더 */}
        <div className="flex justify-between items-center border-b border-slate-200 pb-5">
          <div>
            <span className="text-[#0F4C81] text-xs font-bold uppercase tracking-widest">Master Admin</span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">브랜딩 & CI/파비콘 관리 콘솔</h1>
          </div>
          <Link
            href="/admin/dashboard"
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
          >
            ← 대시보드로 돌아가기
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
            ✅ {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm">
          
          {/* Section 1: 회사명 및 사업장 정보 */}
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C81]"></span>
              기본 기업 정보
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">회사명 (상호명)</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예: 네티젠 테크"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">사업장 / 지점명</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="예: 서울 본사"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">하단 푸터 카피라이트 (Copyright)</label>
              <input
                type="text"
                value={copyrightText}
                onChange={(e) => setCopyrightText(e.target.value)}
                placeholder="예: © 2026 Netizen Tech. All Rights Reserved."
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] text-sm font-mono"
              />
            </div>
          </div>

          {/* Section 2: 로고 CI 업로드 & 실시간 프리뷰 */}
          <div className="space-y-6 pt-4">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C81]"></span>
              CI 로고 이미지 업로드
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">로고 이미지 파일 선택 (PNG, SVG, JPG / 최대 2MB)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setLogoUrl)}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0F4C81]/10 file:text-[#0F4C81] hover:file:bg-[#0F4C81]/20 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 mt-2">투명 배경의 PNG 또는 SVG 이미지를 권장합니다.</p>
              </div>

              {/* 프리뷰 */}
              <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-2 min-h-[120px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">헤더 로고 미리보기</span>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo Preview" className="max-h-12 object-contain" />
                ) : (
                  <div className="flex items-center space-x-2 text-slate-700 font-bold text-sm">
                    <div className="w-8 h-8 rounded-lg bg-[#0F4C81] text-white flex items-center justify-center text-xs font-extrabold">N</div>
                    <span>{companyName || "회사명"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: 파비콘 업로드 */}
          <div className="space-y-6 pt-4">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C81]"></span>
              웹 파비콘 (Favicon) 아이콘 업로드
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">파비콘 아이콘 선택 (.png, .ico / 32x32 권장)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setFaviconUrl)}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0F4C81]/10 file:text-[#0F4C81] hover:file:bg-[#0F4C81]/20 cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-2 min-h-[100px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">파비콘 미리보기</span>
                {faviconUrl ? (
                  <img src={faviconUrl} alt="Favicon Preview" className="w-8 h-8 object-contain rounded-md" />
                ) : (
                  <div className="w-8 h-8 bg-[#0F4C81] text-white rounded-md flex items-center justify-center text-xs font-bold">N</div>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: 1대1 PC/서버 바인딩 저작권 해제 라이선스 키 설정 (MIT License) */}
          <div className="space-y-6 pt-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C81]"></span>
                저작권 표시 해제 라이선스 키 (1대1 PC 바인딩)
              </h2>
              {isLicenseValid ? (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-300">
                  ✅ 1대1 하드웨어 인가 완료 (이 PC/서버 전용 정품 등록됨)
                </span>
              ) : (
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium border border-slate-300">
                  🔒 기본 모드 (qorwlsgh25@gmail.com 저작권 표시 하단 강제 고정)
                </span>
              )}
            </div>

            {/* 내 서버 고유 식별 코드 (Hardware ID) 박스 */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>🖥️ 내 서버 고유 식별 코드 (Hardware ID)</span>
                  <span className="text-[10px] text-slate-400 font-normal">(이 PC 전용 식별값)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (hardwareId) {
                      navigator.clipboard.writeText(hardwareId);
                      setCopiedHw(true);
                      setTimeout(() => setCopiedHw(false), 2000);
                    }
                  }}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-xs"
                >
                  {copiedHw ? "✅ 복사 완료!" : "📋 Hardware ID 복사"}
                </button>
              </div>
              <div className="font-mono text-sm font-bold text-[#0F4C81] bg-white px-4 py-2 rounded-xl border border-slate-200 tracking-wider">
                {hardwareId || "하드웨어 식별 코드를 불러오는 중..."}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                💡 해제 코드 신청 시 위 <strong>Hardware ID</strong>를 저작권자(<code className="bg-slate-200/60 px-1 py-0.5 rounded">qorwlsgh25@gmail.com</code>)에게 전달해 주시면 이 컴퓨터 전용 1대1 해제 코드가 발급됩니다.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                발급받은 1대1 해제 코드 입력 (예: VISIT-XXXX-XXXX-XXXX)
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="예: VISIT-1252-7281-7B3A"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] text-sm font-mono tracking-wider"
              />
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                ⚠️ <strong>무단 복제 방지 안내</strong>: 발급된 해제 코드는 지정된 Hardware ID(이 PC)에서만 작동하며, 다른 컴퓨터로 소스코드를 복사할 경우 해제 코드가 즉시 무효화됩니다.
              </p>
            </div>
          </div>

          {/* 제출 버튼 */}
          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-50"
            >
              {saving ? "저장 중..." : "브랜드 설정 저장하기"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

export default function AdminBrandPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">로딩 중...</div>}>
      <BrandConfigContent />
    </Suspense>
  );
}
