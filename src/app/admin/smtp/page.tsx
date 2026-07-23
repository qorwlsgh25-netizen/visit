"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAdminEmail,
  getSmtpSetting,
  requestAdminSecurityToken,
  validateSecurityToken,
  upsertSmtpSettingWithToken,
  getSecurityStaffList,
  addSecurityStaff,
  deleteSecurityStaff,
} from "@/app/actions/smtp";

function SmtpConfigurator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // 페이지 상태 모드: "verify_token" (토큰 검증중), "request_link" (보안링크 요청 대기), "edit_form" (설정 수정가능), "error_state" (오류 상태)
  const [mode, setMode] = useState<"verify_token" | "request_link" | "edit_form" | "error_state">("verify_token");
  
  // 등록된 이메일
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  
  // 입력한 관리자 이메일 (로그인용)
  const [adminEmailInput, setAdminEmailInput] = useState("");

  // SMTP 폼 상태
  const [form, setForm] = useState({
    smtpHost: "",
    smtpPort: 465,
    smtpUser: "",
    smtpPassword: "",
    secure: true,
    senderEmail: "",
    senderName: "네티젠 테크",
    newAdminEmail: "", // 관리자 이메일 주소 변경 시 사용
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 보안협력사 관련 상태
  const [securityStaff, setSecurityStaff] = useState<any[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string; link?: string } | null>(null);

  // 초기 렌더링 시 토큰 여부 및 이메일 기등록 여부 판별
  useEffect(() => {
    async function initialize() {
      setMessage(null);
      
      // 1. URL에 토큰이 존재하는 경우
      if (token) {
        setMode("verify_token");
        try {
          const valResult = await validateSecurityToken(token);
          if (valResult.success && valResult.email) {
            // 토큰 유효성 검증 성공 -> SMTP 정보 및 기설정 정보 조회
            const smtpResult = await getSmtpSetting(token);
            if (smtpResult.success && smtpResult.data) {
              setForm({
                smtpHost: smtpResult.data.smtpHost,
                smtpPort: smtpResult.data.smtpPort,
                smtpUser: smtpResult.data.smtpUser,
                smtpPassword: smtpResult.data.smtpPassword,
                secure: smtpResult.data.secure,
                senderEmail: smtpResult.data.senderEmail,
                senderName: smtpResult.data.senderName,
                newAdminEmail: valResult.email,
              });
            } else {
              setForm((prev) => ({ ...prev, newAdminEmail: valResult.email || "" }));
            }

            // 보안협력사 목록 로드
            const staffResult = await getSecurityStaffList(token);
            if (staffResult.success && staffResult.data) {
              setSecurityStaff(staffResult.data);
            }
            setMode("edit_form");
          } else {
            setMessage({ type: "error", text: valResult.error || "보안 토큰 인증에 실패했습니다." });
            setMode("error_state");
          }
        } catch (err: any) {
          setMessage({ type: "error", text: err.message || "보안인증 서버 처리 오류" });
          setMode("error_state");
        } finally {
          setLoading(false);
        }
        return;
      }

      // 2. URL에 토큰이 없는 일반 진입인 경우: 관리자 메일 등록 여부 확인
      try {
        const emailResult = await getAdminEmail();
        if (emailResult.success) {
          setRegisteredEmail(emailResult.adminEmail || null);
          setMode("request_link");
        } else {
          setMessage({ type: "error", text: emailResult.error || "데이터베이스 통신 오류" });
          setMode("error_state");
        }
      } catch (err: any) {
        setMessage({ type: "error", text: err.message || "관리자 이메일 확인 중 오류 발생" });
        setMode("error_state");
      } finally {
        setLoading(false);
      }
    }
    initialize();
  }, [token]);

  // 보안 링크 요청 핸들러
  const handleRequestLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const result = await requestAdminSecurityToken(adminEmailInput);
      if (result.success) {
        setRegisteredEmail(adminEmailInput); // 최초 등록인 경우 메모리 갱신
        
        if (result.isSmtpNotConfigured) {
          // SMTP 미설정(부트스트랩) 상태인 경우 이메일을 못 보내므로 바로 링크 주입
          setMessage({
            type: "info",
            text: "SMTP 서버가 아직 설정되지 않아, 부트스트랩 보안인증용 개발 토큰 링크를 화면에 노출합니다. 아래 링크를 클릭해 최초 설정을 진행해 주십시오.",
            link: result.link,
          });
        } else {
          setMessage({
            type: "success",
            text: `보안인증 링크가 등록된 이메일(${adminEmailInput})로 전송되었습니다. 15분 이내에 이메일의 변경링크를 통해 다시 접속해 주십시오.`,
          });
        }
      } else {
        setMessage({
          type: "error",
          text: result.error || "보안 변경 링크 전송에 실패하였습니다.",
        });
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "메일 전송 중 예외 오류 발생",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? Number(value) : value,
    }));
  };

  // 최종 SMTP 설정 저장 핸들러
  const handleSmtpFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setMessage(null);

    try {
      const result = await upsertSmtpSettingWithToken(token, form);
      if (result.success) {
        // 성공 시 토큰을 지운 일반 admin/smtp로 리다이렉트
        alert("SMTP 설정 및 관리자 정보가 성공적으로 반영되었습니다. 보안 토큰이 해제됩니다.");
        router.push("/admin/smtp");
      } else {
        setMessage({ type: "error", text: result.error || "설정 저장에 실패했습니다." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "설정 처리 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  };

  // 보안협력사 등록 핸들러
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newStaffEmail) return;
    setStaffLoading(true);
    try {
      const res = await addSecurityStaff(token, newStaffEmail, newStaffName);
      if (res.success && res.data) {
        setSecurityStaff((prev) => [res.data, ...prev]);
        setNewStaffEmail("");
        setNewStaffName("");
        alert("보안협력사 담당자 이메일이 성공적으로 등록되었습니다.");
      } else {
        alert(res.error || "등록에 실패했습니다.");
      }
    } catch (err: any) {
      alert(err.message || "등록 처리 중 오류가 발생했습니다.");
    } finally {
      setStaffLoading(false);
    }
  };

  // 보안협력사 삭제 핸들러
  const handleRemoveStaff = async (id: string, staffEmail: string) => {
    if (!token) return;
    if (!confirm(`정말로 ${staffEmail} 계정을 보안협력사 명단에서 삭제하시겠습니까?`)) return;
    setStaffLoading(true);
    try {
      const res = await deleteSecurityStaff(token, id);
      if (res.success) {
        setSecurityStaff((prev) => prev.filter((item) => item.id !== id));
        alert("보안협력사 계정이 성공적으로 해제되었습니다.");
      } else {
        alert(res.error || "삭제에 실패했습니다.");
      }
    } catch (err: any) {
      alert(err.message || "삭제 처리 중 오류가 발생했습니다.");
    } finally {
      setStaffLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-slate-800 font-sans">
        <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm text-slate-600 font-medium">관리자 설정을 구성하는 중입니다...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2.5 px-4 py-2 rounded-full bg-indigo-500/10 border border-[#0F4C81]/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-600 tracking-wide uppercase">시스템 최고 관리자 콘솔</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">SMTP 메일 서버 설정</h2>
          <p className="mt-2.5 text-sm text-slate-500/70 max-w-md mx-auto leading-relaxed">
            비권한자의 메일 서버 설정 조작을 원천 금지합니다. 등록된 관리자 이메일을 통해 전송된 1회용 보안인증 링크로 접근해야 수정 권한이 활성화됩니다.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl px-4">
        <div className="bg-white border border-slate-200 p-8 rounded-2xl backdrop-blur-md shadow-2xl space-y-6">
          
          {message && (
            <div
              className={`p-5 rounded-xl border text-sm font-medium transition-all ${
                message.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : message.type === "info"
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <p className="leading-relaxed">{message.text}</p>
              {message.link && (
                <div className="mt-4">
                  <a
                    href={message.link}
                    className="inline-flex items-center px-4 py-2 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-500/10"
                  >
                    최초 인증 및 수정 권한 획득하기
                  </a>
                </div>
              )}
            </div>
          )}

          {/* 모드 A: 보안 변경 링크 요청 화면 */}
          {mode === "request_link" && (
            <form onSubmit={handleRequestLinkSubmit} className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span>🔒 최고 관리자 이메일 인증</span>
                  {!registeredEmail && (
                    <span className="text-[10px] bg-[#0F4C81] px-2 py-0.5 rounded text-white font-semibold">최초 등록 필요</span>
                  )}
                </h4>
                
                {registeredEmail ? (
                  <p className="text-xs text-slate-600">
                    현재 등록된 관리자 계정 이메일로 보안 변경 일회용 인증 링크를 발송합니다.
                  </p>
                ) : (
                  <p className="text-xs text-amber-300">
                    최초 기동 상태입니다. 입력하시는 이메일이 최고 관리자 공식 이메일 주소로 신규 설정됩니다.
                  </p>
                )}

                <div>
                  <label htmlFor="adminEmailInput" className="block text-xs font-semibold text-[#0F4C81] mb-2">
                    관리자 이메일 주소
                  </label>
                  <input
                    type="email"
                    id="adminEmailInput"
                    required
                    value={adminEmailInput}
                    onChange={(e) => setAdminEmailInput(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                  />
                </div>
              </div>

              <div className="flex space-x-4 border-t border-slate-200 pt-6">
                <button
                  type="button"
                  onClick={() => router.push("/request")}
                  className="flex-1 px-5 py-3 border border-slate-200 text-[#0F4C81] rounded-xl font-medium hover:bg-white hover:text-slate-800 transition-all text-sm text-center"
                >
                  방문 신청 화면으로
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-5 py-3 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-xl font-medium text-sm text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2"
                >
                  {saving ? "전송 중..." : registeredEmail ? "보안 변경 링크 전송" : "이메일 최초 등록"}
                </button>
              </div>
            </form>
          )}

          {/* 모드 B: 메일 서버 설정 수정 폼 (보안토큰 인증 통과 상태) */}
          {mode === "edit_form" && token && (
            <form onSubmit={handleSmtpFormSubmit} className="space-y-6">
              
              {/* 최고 관리자 계정 정보 변경 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-emerald-400">🔓 보안인증 승인 상태 (수정 가능)</h4>
                <div>
                  <label htmlFor="newAdminEmail" className="block text-xs font-semibold text-slate-600 mb-2">
                    최고 관리자 이메일 주소 <span className="text-[10px] text-[#0F4C81]">(변경 가능)</span>
                  </label>
                  <input
                    type="email"
                    id="newAdminEmail"
                    name="newAdminEmail"
                    required
                    value={form.newAdminEmail}
                    onChange={handleInputChange}
                    placeholder="admin@company.com"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                  />
                </div>
              </div>

              {/* SMTP 설정 항목들 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="smtpHost" className="block text-xs font-semibold text-slate-600 mb-2">
                    SMTP 서버 호스트 <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    id="smtpHost"
                    name="smtpHost"
                    required
                    value={form.smtpHost}
                    onChange={handleInputChange}
                    placeholder="예: smtp.gmail.com"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="smtpPort" className="block text-xs font-semibold text-slate-600 mb-2">
                    포트 번호 <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="number"
                    id="smtpPort"
                    name="smtpPort"
                    required
                    value={form.smtpPort}
                    onChange={handleInputChange}
                    placeholder="예: 465"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="smtpUser" className="block text-xs font-semibold text-slate-600 mb-2">
                    SMTP 사용자 계정(아이디/이메일) <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    id="smtpUser"
                    name="smtpUser"
                    required
                    value={form.smtpUser}
                    onChange={handleInputChange}
                    placeholder="예: your-id@gmail.com"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                  />
                </div>

                <div className="flex items-end pb-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="secure"
                      name="secure"
                      checked={form.secure}
                      onChange={handleInputChange}
                      className="w-4 h-4 rounded border-slate-200 bg-white text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="secure" className="ml-2.5 text-xs font-semibold text-slate-600 cursor-pointer">
                      SSL/TLS 보안 전송 사용 (465번 등)
                    </label>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label htmlFor="smtpPassword" className="block text-xs font-semibold text-slate-600 mb-2">
                    SMTP 비밀번호 또는 앱 비밀번호 <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="password"
                    id="smtpPassword"
                    name="smtpPassword"
                    required
                    value={form.smtpPassword}
                    onChange={handleInputChange}
                    placeholder="••••••••••••••••"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="senderEmail" className="block text-xs font-semibold text-slate-600 mb-2">
                    발신인 대표 이메일 주소 <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="email"
                    id="senderEmail"
                    name="senderEmail"
                    required
                    value={form.senderEmail}
                    onChange={handleInputChange}
                    placeholder="예: noreply@luza.com"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="senderName" className="block text-xs font-semibold text-slate-600 mb-2">
                    발신인 표시명 <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    id="senderName"
                    name="senderName"
                    required
                    value={form.senderName}
                    onChange={handleInputChange}
                    placeholder="예: 네티젠 테크"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                  />
                </div>
              </div>

              {/* 구분선 */}
              <div className="border-t border-slate-200 my-8"></div>

              {/* 보안협력사 담당자 계정 관리 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-left">
                <h4 className="text-sm font-bold text-slate-600 flex items-center space-x-2">
                  <span>🏢 보안협력사(정문 경비실) 담당자 계정 관리</span>
                </h4>
                <p className="text-xs text-slate-500/60 leading-relaxed">
                  정문 경비실 현황판 및 스캐너 출입통제 시스템에 로그인할 수 있는 보안협력사 담당자 이메일 목록입니다. 최고관리자 권한으로 직접 추가 및 삭제할 수 있습니다.
                </p>

                {/* 이메일 등록 폼 */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-slate-800 block">신규 담당자 이메일 등록</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="담당자명 (예: 김경비)"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#0F4C81]"
                    />
                    <input
                      type="email"
                      placeholder="이메일 (예: security@hniruja.com)"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#0F4C81]"
                    />
                    <button
                      type="button"
                      onClick={handleAddStaff}
                      disabled={staffLoading}
                      className="bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-lg text-xs font-bold transition-all py-2"
                    >
                      {staffLoading ? "등록 중..." : "담당자 계정 등록"}
                    </button>
                  </div>
                </div>

                {/* 등록된 목록 테이블 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[#0F4C81]">
                        <th className="py-2 px-3">담당자명</th>
                        <th className="py-2 px-3">이메일 주소</th>
                        <th className="py-2 px-3">등록일</th>
                        <th className="py-2 px-3 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {securityStaff.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-500 text-[11px]">
                            등록된 보안협력사 담당자가 없습니다. 경비실 로그인 허용을 위해 이메일을 등록해 주십시오.
                          </td>
                        </tr>
                      ) : (
                        securityStaff.map((staff) => (
                          <tr key={staff.id} className="border-b border-slate-200 hover:bg-white">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{staff.name || "-"}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">{staff.email}</td>
                            <td className="py-2.5 px-3 text-slate-500">{new Date(staff.createdAt).toLocaleDateString()}</td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveStaff(staff.id, staff.email)}
                                disabled={staffLoading}
                                className="text-rose-400 hover:text-rose-300 font-bold"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex space-x-4 border-t border-slate-200 pt-6">
                <button
                  type="button"
                  onClick={() => router.push("/admin/smtp")}
                  className="flex-1 px-5 py-3 border border-slate-200 text-[#0F4C81] rounded-xl font-medium hover:bg-white hover:text-slate-800 transition-all text-sm text-center"
                >
                  보안 토큰 인증 해제
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-medium text-sm text-white hover:shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2"
                >
                  {saving ? "설정 저장 중..." : "설정 안전하게 저장하기"}
                </button>
              </div>
            </form>
          )}

          {/* 모드 C: 오류 상태 발생 시 링크 발송으로 복귀 */}
          {mode === "error_state" && (
            <div className="text-center py-4 space-y-4">
              <button
                type="button"
                onClick={() => router.push("/admin/smtp")}
                className="px-6 py-2.5 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-xl text-xs font-semibold transition-all shadow-md"
              >
                관리자 메일 인증 요청 화면으로
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminSmtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-slate-800 font-sans">
          <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm text-slate-600 font-medium">콘솔 화면을 초기화하는 중입니다...</span>
        </div>
      }
    >
      <SmtpConfigurator />
    </Suspense>
  );
}
