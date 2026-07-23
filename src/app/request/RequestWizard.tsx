"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReservation } from "@/app/actions/reservation";

// 24시간 리스트 (30분 단위) 생성
const generateTimeOptions = () => {
  const options = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, "0");
    options.push(`${hour}:00`);
    options.push(`${hour}:30`);
  }
  return options;
};
const TIME_OPTIONS = generateTimeOptions();

const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, "");
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 8) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  }
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;
};


interface RequestWizardProps {
  termsContent: string;
  privacyContent: string;
  safetyContent: string;
  secretContent: string;
  securityContent: string;
}

export default function RequestWizard({
  termsContent,
  privacyContent,
  safetyContent,
  secretContent,
  securityContent,
}: RequestWizardProps) {
  const router = useRouter();

  // 단계 상태 (1: 약관 동의, 2: 정보 입력, 3: 신청 완료)
  const [step, setStep] = useState(1);

  // 약관 동의 체크박스 상태
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    safety: false,
    secret: false,
    security: false,
  });

  // 약관 아코디언 열림/닫힘 상태
  const [accordions, setAccordions] = useState({
    terms: true,
    privacy: false,
    safety: false,
    secret: false,
    security: false,
  });

  // 방문 유형: "single" (단일) 또는 "long" (장기)
  const [visitType, setVisitType] = useState<"single" | "long">("single");

  // 입력 폼 상태
  const [form, setForm] = useState({
    visitorName: "",
    visitorEmail: "", // 방문자 이메일 (필수)
    birthDate: "",
    phoneNumber: "",
    organization: "",
    carNumber: "",
    carType: "",
    purpose: "",
    visitDate: "",
    visitStartDate: "",
    visitEndDate: "",
    visitStartTime: "09:00",
    visitEndTime: "18:00",

    // 만나실 분(담당자) 정보
    hostName: "",
    hostPhone: "",
    hostEmail: "", // 담당자 이메일 (필수)
    hostDepartment: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdData, setCreatedData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const toggleAccordion = (key: keyof typeof accordions) => {
    setAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCheckboxChange = (key: keyof typeof agreements) => {
    const newValue = !agreements[key];
    setAgreements((prev) => ({ ...prev, [key]: newValue }));

    // 체크박스가 선택(true)되면, 현재 아코디언은 닫고 다음 아코디언을 자동으로 엽니다.
    if (newValue) {
      setAccordions((prev) => {
        const nextAccordions = { ...prev, [key]: false };
        if (key === "terms") nextAccordions.privacy = true;
        else if (key === "privacy") nextAccordions.safety = true;
        else if (key === "safety") nextAccordions.secret = true;
        else if (key === "secret") nextAccordions.security = true;
        return nextAccordions;
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === "phoneNumber" || name === "hostPhone") {
      formattedValue = formatPhoneNumber(value);
    }
    setForm((prev) => ({ ...prev, [name]: formattedValue }));
  };

  // 동행자 관련 상태 및 핸들러
  const [companions, setCompanions] = useState<any[]>([]);

  const addCompanion = () => {
    if (companions.length >= 10) {
      alert("동행자는 최대 10명까지만 추가 가능합니다.");
      return;
    }
    setCompanions((prev) => [
      ...prev,
      {
        name: "",
        email: "",
        phoneNumber: "",
        organization: "",
        carNumber: "",
        equipment: "",
        notes: "",
      },
    ]);
  };

  const removeCompanion = (index: number) => {
    setCompanions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCompanionChange = (index: number, field: string, value: string) => {
    let formattedValue = value;
    if (field === "phoneNumber") {
      formattedValue = formatPhoneNumber(value);
    }
    setCompanions((prev) =>
      prev.map((comp, i) => (i === index ? { ...comp, [field]: formattedValue } : comp))
    );
  };

  // 모든 약관 동의 여부 검사
  const allAgreed =
    agreements.terms &&
    agreements.privacy &&
    agreements.safety &&
    agreements.secret &&
    agreements.security;

  const handleNextStep = () => {
    if (step === 1 && !allAgreed) {
      alert("모든 약관 및 서약서에 동의해 주셔야 신청이 가능합니다.");
      return;
    }
    setStep(2);
  };

  const handlePrevStep = () => {
    setStep(1);
  };

  // 방문 신청 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 기본 유효성 검사
    if (!form.visitorName || !form.visitorEmail || !form.birthDate || !form.phoneNumber || !form.organization || !form.purpose) {
      setError("필수 입력 항목이 누락되었습니다.");
      return;
    }

    if (visitType === "single" && !form.visitDate) {
      setError("방문 날짜를 선택해주세요.");
      return;
    }

    if (visitType === "long" && (!form.visitStartDate || !form.visitEndDate)) {
      setError("방문 시작일과 종료일을 모두 선택해주세요.");
      return;
    }

    if (!form.visitStartTime || !form.visitEndTime) {
      setError("방문 시작 시간과 종료 시간을 선택해주세요.");
      return;
    }

    // 담당자 정보 필수 확인
    if (!form.hostName || !form.hostPhone || !form.hostEmail) {
      setError("만나실 분(담당자) 정보의 성명, 연락처, 이메일은 필수 입력입니다.");
      return;
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.visitorEmail)) {
      setError("방문자 이메일 주소 형식이 올바르지 않습니다.");
      return;
    }

    if (!emailRegex.test(form.hostEmail)) {
      setError("담당자 이메일 주소 형식이 올바르지 않습니다.");
      return;
    }

    // 생년월일 형식 검사 (6자리)
    if (!/^\d{6}$/.test(form.birthDate)) {
      setError("생년월일은 6자리 숫자로 입력해주세요 (예: 900101).");
      return;
    }

    // 연락처 형식 검사 (010-XXXX-XXXX)
    if (!/^010-\d{3,4}-\d{4}$/.test(form.phoneNumber)) {
      setError("연락처는 010-XXXX-XXXX 형식으로 입력해주세요.");
      return;
    }

    if (!/^010-\d{3,4}-\d{4}$/.test(form.hostPhone)) {
      setError("담당자 연락처는 010-XXXX-XXXX 형식으로 입력해주세요.");
      return;
    }

    // 동행자 필수 항목 및 연락처 검증
    for (let i = 0; i < companions.length; i++) {
      const comp = companions[i];
      if (!comp.name || !comp.email || !comp.phoneNumber || !comp.organization) {
        setError(`동행자 ${i + 1}의 성명, 이메일, 연락처, 소속회사는 필수 입력 항목입니다.`);
        return;
      }
      if (!emailRegex.test(comp.email)) {
        setError(`동행자 ${i + 1}의 이메일 주소 형식이 올바르지 않습니다.`);
        return;
      }
      if (!/^010-\d{3,4}-\d{4}$/.test(comp.phoneNumber)) {
        setError(`동행자 ${i + 1}의 연락처는 010-XXXX-XXXX 형식으로 입력해주세요.`);
        return;
      }
    }

    setLoading(true);

    try {
      // 날짜와 시간 결합
      const startDate = visitType === "single" ? form.visitDate : form.visitStartDate;
      const endDate = visitType === "single" ? form.visitDate : form.visitEndDate;

      const visitDateTimeISO = new Date(`${startDate}T${form.visitStartTime}:00`).toISOString();
      const visitEndDateTimeISO = new Date(`${endDate}T${form.visitEndTime}:00`).toISOString();

      if (new Date(visitDateTimeISO) >= new Date(visitEndDateTimeISO)) {
        setError("방문 종료 일시는 시작 일시보다 늦어야 합니다.");
        setLoading(false);
        return;
      }

      const result = await createReservation({
        visitorName: form.visitorName,
        visitorEmail: form.visitorEmail,
        birthDate: form.birthDate,
        phoneNumber: form.phoneNumber,
        organization: form.organization,
        carNumber: form.carNumber || undefined,
        carType: form.carType || undefined,
        purpose: form.purpose,
        visitDateTime: visitDateTimeISO,
        visitEndDateTime: visitEndDateTimeISO,
        hostName: form.hostName,
        hostPhone: form.hostPhone,
        hostEmail: form.hostEmail,
        hostDepartment: form.hostDepartment || undefined,
        companions: companions.length > 0 ? companions : undefined,
        termsAgreed: agreements.terms,
        privacyAgreed: agreements.privacy,
        safetyAgreed: agreements.safety,
        secretAgreed: agreements.secret,
        securityAgreed: agreements.security,
      });

      if (result.success && result.data) {
        setCreatedData(result.data);
        setStep(3);
      } else {
        setError(result.error || "방문 예약 신청 처리 중 오류가 발생했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "서버 통신 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* 진행 단계 인디케이터 */}
      <div className="flex justify-between items-center mb-12 max-w-lg mx-auto">
        {[
          { label: "약관 동의", num: 1 },
          { label: "방문 신청", num: 2 },
          { label: "신청 완료", num: 3 },
        ].map((item) => (
          <div key={item.num} className="flex flex-col items-center flex-1 relative">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2 ${
                step >= item.num
                  ? "bg-[#0F4C81] border-[#0F4C81] text-white shadow-lg shadow-indigo-500/20"
                  : "bg-white border-slate-200 text-[#0F4C81]"
              }`}
            >
              {item.num}
            </div>
            <span
              className={`text-xs mt-2.5 font-medium transition-colors duration-300 ${
                step >= item.num ? "text-[#0F4C81] font-bold" : "text-slate-400"
              }`}
            >
              {item.label}
            </span>
            {item.num < 3 && (
              <div
                className={`absolute top-5 left-[50%] right-[-50%] h-0.5 z-[-1] transition-all duration-500 ${
                  step > item.num ? "bg-[#0F4C81]" : "bg-indigo-950"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* 1단계: 약관 동의 화면 */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">방문 서약 및 약관 동의</h2>
            <p className="text-sm text-slate-600">
              보안 및 안전 수칙 준수를 위해 아래의 모든 동의서 내용을 확인하고 서약해 주시기 바랍니다.
            </p>
          </div>

          <div className="space-y-4">
            {/* 1. 방문신청 약관 */}
            <div className="rounded-xl border border-slate-200 bg-white backdrop-blur-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("terms")}
                className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800">1. 방문신청 약관</span>
                  {agreements.terms ? (
                    <span className="text-emerald-600 font-bold text-sm">(완료)</span>
                  ) : (
                    <span className="text-red-600 font-bold text-sm">(미동의)</span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-[#0F4C81] transition-transform duration-300 ${
                    accordions.terms ? "transform rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {accordions.terms && (
                <div className="border-t border-slate-100 bg-slate-50">
                  <div className="p-6 max-h-60 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-slate-500/80 leading-relaxed">
                    {termsContent || "약관 내용 로딩 중..."}
                  </div>
                  <div className="px-6 py-3 border-t border-slate-100 flex items-center bg-white">
                    <input
                      type="checkbox"
                      id="chk-terms"
                      checked={agreements.terms}
                      onChange={() => handleCheckboxChange("terms")}
                      className="w-4 h-4 rounded border-slate-200 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                    />
                    <label htmlFor="chk-terms" className="ml-2.5 text-xs font-medium text-slate-500 cursor-pointer">
                      상기 내용을 확인하였으며, 방문신청 약관에 동의합니다. (필수)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 2. 개인정보처리방침 */}
            <div className="rounded-xl border border-slate-200 bg-white backdrop-blur-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("privacy")}
                className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800">2. 개인정보처리방침</span>
                  {agreements.privacy ? (
                    <span className="text-emerald-600 font-bold text-sm">(완료)</span>
                  ) : (
                    <span className="text-red-600 font-bold text-sm">(미동의)</span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-[#0F4C81] transition-transform duration-300 ${
                    accordions.privacy ? "transform rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {accordions.privacy && (
                <div className="border-t border-slate-100 bg-slate-50">
                  <div className="p-6 max-h-60 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-slate-500/80 leading-relaxed">
                    {privacyContent || "약관 내용 로딩 중..."}
                  </div>
                  <div className="px-6 py-3 border-t border-slate-100 flex items-center bg-white">
                    <input
                      type="checkbox"
                      id="chk-privacy"
                      checked={agreements.privacy}
                      onChange={() => handleCheckboxChange("privacy")}
                      className="w-4 h-4 rounded border-slate-200 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                    />
                    <label htmlFor="chk-privacy" className="ml-2.5 text-xs font-medium text-slate-500 cursor-pointer">
                      상기 내용을 확인하였으며, 개인정보처리방침에 동의합니다. (필수)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 3. 안전수칙 준수 서약서 */}
            <div className="rounded-xl border border-slate-200 bg-white backdrop-blur-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("safety")}
                className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800">3. 안전수칙 준수 서약서</span>
                  {agreements.safety ? (
                    <span className="text-emerald-600 font-bold text-sm">(완료)</span>
                  ) : (
                    <span className="text-red-600 font-bold text-sm">(미동의)</span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-[#0F4C81] transition-transform duration-300 ${
                    accordions.safety ? "transform rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {accordions.safety && (
                <div className="border-t border-slate-100 bg-slate-50">
                  <div className="p-6 max-h-60 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-slate-500/80 leading-relaxed">
                    {safetyContent || "약관 내용 로딩 중..."}
                  </div>
                  <div className="px-6 py-3 border-t border-slate-100 flex items-center bg-white">
                    <input
                      type="checkbox"
                      id="chk-safety"
                      checked={agreements.safety}
                      onChange={() => handleCheckboxChange("safety")}
                      className="w-4 h-4 rounded border-slate-200 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                    />
                    <label htmlFor="chk-safety" className="ml-2.5 text-xs font-medium text-slate-500 cursor-pointer">
                      상기 내용을 확인하였으며, 안전수칙 준수 서약서에 동의합니다. (필수)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 4. 방문객 영업비밀 보호 서약서 */}
            <div className="rounded-xl border border-slate-200 bg-white backdrop-blur-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("secret")}
                className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800">4. 방문객 영업비밀 보호 서약서</span>
                  {agreements.secret ? (
                    <span className="text-emerald-600 font-bold text-sm">(완료)</span>
                  ) : (
                    <span className="text-red-600 font-bold text-sm">(미동의)</span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-[#0F4C81] transition-transform duration-300 ${
                    accordions.secret ? "transform rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {accordions.secret && (
                <div className="border-t border-slate-100 bg-slate-50">
                  <div className="p-6 max-h-60 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-slate-500/80 leading-relaxed">
                    {secretContent || "약관 내용 로딩 중..."}
                  </div>
                  <div className="px-6 py-3 border-t border-slate-100 flex items-center bg-white">
                    <input
                      type="checkbox"
                      id="chk-secret"
                      checked={agreements.secret}
                      onChange={() => handleCheckboxChange("secret")}
                      className="w-4 h-4 rounded border-slate-200 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                    />
                    <label htmlFor="chk-secret" className="ml-2.5 text-xs font-medium text-slate-500 cursor-pointer">
                      상기 내용을 확인하였으며, 방문객 영업비밀 보호 서약서에 동의합니다. (필수)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 5. 회사정보 보호 서약서 */}
            <div className="rounded-xl border border-slate-200 bg-white backdrop-blur-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("security")}
                className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800">5. 회사정보 보호 서약서</span>
                  {agreements.security ? (
                    <span className="text-emerald-600 font-bold text-sm">(완료)</span>
                  ) : (
                    <span className="text-red-600 font-bold text-sm">(미동의)</span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-[#0F4C81] transition-transform duration-300 ${
                    accordions.security ? "transform rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {accordions.security && (
                <div className="border-t border-slate-100 bg-slate-50">
                  <div className="p-6 max-h-60 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-slate-500/80 leading-relaxed">
                    {securityContent || "약관 내용 로딩 중..."}
                  </div>
                  <div className="px-6 py-3 border-t border-slate-100 flex items-center bg-white">
                    <input
                      type="checkbox"
                      id="chk-security"
                      checked={agreements.security}
                      onChange={() => handleCheckboxChange("security")}
                      className="w-4 h-4 rounded border-slate-200 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                    />
                    <label htmlFor="chk-security" className="ml-2.5 text-xs font-medium text-slate-500 cursor-pointer">
                      상기 내용을 확인하였으며, 회사정보 보호 서약서에 동의합니다. (필수)
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="flex space-x-4 mt-10 max-w-sm mx-auto">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex-1 px-5 py-3 border border-slate-200 text-[#0F4C81] rounded-xl font-medium hover:bg-white hover:text-slate-800 transition-all text-sm"
            >
              동의하지 않습니다
            </button>
            <button
              type="button"
              disabled={!allAgreed}
              onClick={handleNextStep}
              className={`flex-1 px-5 py-3 rounded-xl font-medium text-sm transition-all text-white ${
                allAgreed
                  ? "bg-[#0F4C81] hover:bg-[#0c3e6b] text-white hover:shadow-lg hover:shadow-indigo-500/20 cursor-pointer"
                  : "bg-white border border-slate-200 text-[#0F4C81]/50 cursor-not-allowed"
              }`}
            >
              동의합니다
            </button>
          </div>
        </div>
      )}

      {/* 2단계: 정보 입력 화면 */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-8 bg-white border border-slate-200 p-8 rounded-2xl backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">방문자 인적사항 & 일정 입력</h2>
            <p className="text-sm text-slate-600">방문 예약을 위해 아래 입력 폼을 모두 정확하게 기입해주십시오.</p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="visitorName" className="block text-xs font-semibold text-slate-600 mb-2">
                성명 <span className="text-red-600 font-bold ml-1">(필수)</span>
              </label>
              <input
                type="text"
                id="visitorName"
                name="visitorName"
                required
                value={form.visitorName}
                onChange={handleInputChange}
                placeholder="성명을 입력하세요"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="birthDate" className="block text-xs font-semibold text-slate-600 mb-2">
                생년월일 6자리 <span className="text-red-600 font-bold ml-1">(필수)</span>
              </label>
              <input
                type="text"
                id="birthDate"
                name="birthDate"
                required
                maxLength={6}
                value={form.birthDate}
                onChange={handleInputChange}
                placeholder="YYMMDD (예: 900101)"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-xs font-semibold text-slate-600 mb-2">
                연락처 <span className="text-red-600 font-bold ml-1">(필수)</span>
              </label>
              <input
                type="text"
                id="phoneNumber"
                name="phoneNumber"
                required
                value={form.phoneNumber}
                onChange={handleInputChange}
                placeholder="010-XXXX-XXXX"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="visitorEmail" className="block text-xs font-semibold text-slate-600 mb-2">
                이메일 주소 <span className="text-red-600 font-bold ml-1">(필수)</span>
              </label>
              <input
                type="email"
                id="visitorEmail"
                name="visitorEmail"
                required
                value={form.visitorEmail}
                onChange={handleInputChange}
                placeholder="example@email.com"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="organization" className="block text-xs font-semibold text-slate-600 mb-2">
                소속사명 <span className="text-red-600 font-bold ml-1">(필수)</span>
              </label>
              <input
                type="text"
                id="organization"
                name="organization"
                required
                value={form.organization}
                onChange={handleInputChange}
                placeholder="회사/조직명을 입력하세요"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="carNumber" className="block text-xs font-semibold text-slate-600 mb-2">
                차량번호 <span className="text-slate-700 font-medium ml-1">(선택)</span>
              </label>
              <input
                type="text"
                id="carNumber"
                name="carNumber"
                value={form.carNumber}
                onChange={handleInputChange}
                placeholder="예: 12가3456"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="carType" className="block text-xs font-semibold text-slate-600 mb-2">
                차종 <span className="text-slate-700 font-medium ml-1">(선택)</span>
              </label>
              <input
                type="text"
                id="carType"
                name="carType"
                value={form.carType}
                onChange={handleInputChange}
                placeholder="예: 소나타 / 아반떼"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="purpose" className="block text-xs font-semibold text-slate-600 mb-2">
                방문 목적 <span className="text-red-600 font-bold ml-1">(필수)</span>
              </label>
              <input
                type="text"
                id="purpose"
                name="purpose"
                required
                value={form.purpose}
                onChange={handleInputChange}
                placeholder="방문 목적을 기입하세요 (예: 회의 참석, 장비 셋업 등)"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
              />
            </div>

            {/* 방문 희망 날짜 및 구분 선택 */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <span className="block text-xs font-semibold text-slate-600 mb-2">
                  방문 구분 <span className="text-red-600 font-bold ml-1">(필수)</span>
                </span>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setVisitType("single")}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium border transition-all ${
                      visitType === "single"
                        ? "bg-[#0F4C81]/20 border-[#0F4C81] text-white shadow-lg shadow-indigo-500/10"
                        : "bg-white border-slate-200 text-[#0F4C81] hover:text-white"
                    }`}
                  >
                    단일 방문
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisitType("long")}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium border transition-all ${
                      visitType === "long"
                        ? "bg-[#0F4C81]/20 border-[#0F4C81] text-white shadow-lg shadow-indigo-500/10"
                        : "bg-white border-slate-200 text-[#0F4C81] hover:text-white"
                    }`}
                  >
                    장기 방문 (기간 선택)
                  </button>
                </div>
              </div>

              {visitType === "single" ? (
                <div>
                  <label htmlFor="visitDate" className="block text-xs font-semibold text-slate-600 mb-2">
                    방문 희망 날짜 <span className="text-red-600 font-bold ml-1">(필수)</span>
                  </label>
                  <input
                    type="date"
                    id="visitDate"
                    name="visitDate"
                    required
                    value={form.visitDate}
                    onChange={handleInputChange}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors cursor-pointer"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="visitStartDate" className="block text-xs font-semibold text-slate-600 mb-2">
                      방문 시작일 <span className="text-red-600 font-bold ml-1">(필수)</span>
                    </label>
                    <input
                      type="date"
                      id="visitStartDate"
                      name="visitStartDate"
                      required
                      value={form.visitStartDate}
                      onChange={handleInputChange}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors cursor-pointer"
                    />
                  </div>
                  <div>
                    <label htmlFor="visitEndDate" className="block text-xs font-semibold text-slate-600 mb-2">
                      방문 종료일 <span className="text-red-600 font-bold ml-1">(필수)</span>
                    </label>
                    <input
                      type="date"
                      id="visitEndDate"
                      name="visitEndDate"
                      required
                      value={form.visitEndDate}
                      onChange={handleInputChange}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 방문 희망 시간 선택 (시작/종료 드롭다운) */}
            <div>
              <label htmlFor="visitStartTime" className="block text-xs font-semibold text-slate-600 mb-2">
                방문 시작 시간 <span className="text-red-600 font-bold ml-1">(필수)</span>
              </label>
              <select
                id="visitStartTime"
                name="visitStartTime"
                value={form.visitStartTime}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors cursor-pointer"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={`start-${time}`} value={time} className="bg-white text-slate-800">
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="visitEndTime" className="block text-xs font-semibold text-slate-600 mb-2">
                방문 종료 시간 <span className="text-red-600 font-bold ml-1">(필수)</span>
              </label>
              <select
                id="visitEndTime"
                name="visitEndTime"
                value={form.visitEndTime}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors cursor-pointer"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={`end-${time}`} value={time} className="bg-white text-slate-800">
                    {time}
                  </option>
                ))}
              </select>
            </div>

            {/* 동행자 정보 (선택사항) */}
            <div className="md:col-span-2 space-y-6 border-t border-slate-200 pt-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-[#0F4C81]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-800">동행자 정보</span>
                  <span className="text-xs text-[#0F4C81] font-medium">(선택사항)</span>
                </div>
                <button
                  type="button"
                  onClick={addCompanion}
                  className="flex items-center space-x-1.5 py-1.5 px-3.5 bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/20 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-500/5 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>동행자 추가 ({companions.length}/10)</span>
                </button>
              </div>

              {companions.map((companion, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-xl p-5 relative space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>동행자 {index + 1}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCompanion(index)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 12H6" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">
                        성명 <span className="text-red-600 font-bold ml-0.5">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F4C81] text-xs">👤</span>
                        <input
                          type="text"
                          required
                          value={companion.name}
                          onChange={(e) => handleCompanionChange(index, "name", e.target.value)}
                          placeholder="동행자 성명"
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">
                        이메일 주소 <span className="text-red-600 font-bold ml-0.5">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F4C81] text-xs">✉</span>
                        <input
                          type="email"
                          required
                          value={companion.email}
                          onChange={(e) => handleCompanionChange(index, "email", e.target.value)}
                          placeholder="example@email.com"
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">
                        연락처 <span className="text-red-600 font-bold ml-0.5">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F4C81] text-xs">📞</span>
                        <input
                          type="text"
                          required
                          value={companion.phoneNumber}
                          onChange={(e) => handleCompanionChange(index, "phoneNumber", e.target.value)}
                          placeholder="010-XXXX-XXXX"
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">
                        소속회사 <span className="text-red-600 font-bold ml-0.5">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F4C81] text-xs">🏢</span>
                        <input
                          type="text"
                          required
                          value={companion.organization}
                          onChange={(e) => handleCompanionChange(index, "organization", e.target.value)}
                          placeholder="소속회사명"
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">차량번호</label>
                      <input
                        type="text"
                        value={companion.carNumber}
                        onChange={(e) => handleCompanionChange(index, "carNumber", e.target.value)}
                        placeholder="차량번호를 입력하세요"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">반입장비</label>
                      <input
                        type="text"
                        value={companion.equipment}
                        onChange={(e) => handleCompanionChange(index, "equipment", e.target.value)}
                        placeholder="반입장비를 입력하세요"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-2">기타사항</label>
                      <input
                        type="text"
                        value={companion.notes}
                        onChange={(e) => handleCompanionChange(index, "notes", e.target.value)}
                        placeholder="기타사항을 입력하세요"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 만나실 분(담당자) 정보 */}
            <div className="md:col-span-2 space-y-6 border-t border-slate-200 pt-6">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-[#0F4C81]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-semibold text-slate-800">만나실 분(담당자) 정보</span>
              </div>

              <div className="bg-[#F8F9FA] border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="hostName" className="block text-xs font-semibold text-slate-600 mb-2">
                      담당자 성명 <span className="text-red-600 font-bold ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F4C81] text-xs">👤</span>
                      <input
                        type="text"
                        id="hostName"
                        name="hostName"
                        required
                        value={form.hostName}
                        onChange={handleInputChange}
                        placeholder="담당자 성명"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="hostPhone" className="block text-xs font-semibold text-slate-600 mb-2">
                      담당자 연락처 <span className="text-red-600 font-bold ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F4C81] text-xs">📞</span>
                      <input
                        type="text"
                        id="hostPhone"
                        name="hostPhone"
                        required
                        value={form.hostPhone}
                        onChange={handleInputChange}
                        placeholder="010-XXXX-XXXX"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="hostEmail" className="block text-xs font-semibold text-slate-600 mb-2">
                      담당자 이메일 <span className="text-red-600 font-bold ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F4C81] text-xs">✉</span>
                      <input
                        type="email"
                        id="hostEmail"
                        name="hostEmail"
                        required
                        value={form.hostEmail}
                        onChange={handleInputChange}
                        placeholder="host@email.com"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="hostDepartment" className="block text-xs font-semibold text-slate-600 mb-2">
                      담당자 부서
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F4C81] text-xs">🏢</span>
                      <input
                        type="text"
                        id="hostDepartment"
                        name="hostDepartment"
                        value={form.hostDepartment}
                        onChange={handleInputChange}
                        placeholder="개발팀, 영업팀 등"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0F4C81] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-4 border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex-1 px-5 py-3 border border-slate-200 text-[#0F4C81] rounded-xl font-medium hover:bg-white hover:text-slate-800 transition-all text-sm"
            >
              이전 단계로
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-5 py-3 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-xl font-medium text-sm text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>처리중...</span>
                </>
              ) : (
                <span>신청 완료</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* 3단계: 신청 완료 화면 */}
      {step === 3 && createdData && (
        <div className="bg-white border border-slate-200 p-8 rounded-2xl backdrop-blur-sm text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">방문 예약 신청 완료</h2>
          <p className="text-sm text-slate-600 mb-8 leading-relaxed">
            방문 예약 신청이 성공적으로 완료되었습니다.<br />
            담당 부서의 승인 결과를 대기 중입니다. 승인 결과 조회 시 아래 예약번호가 사용되므로 반드시 보관해 주시기 바랍니다.
          </p>

          <div className="bg-white border border-slate-200 p-5 rounded-xl text-left space-y-4 mb-8">
            <div>
              <span className="block text-[10px] font-bold text-[#0F4C81] uppercase tracking-wider mb-1">방문 예약번호</span>
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-200">
                <code className="text-xs text-slate-800 font-mono break-all pr-2">{createdData.id}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdData.id)}
                  className="px-2.5 py-1 text-[10px] font-bold bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded transition-colors"
                >
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-600 block">방문객 성명</span>
                <span className="text-slate-800 font-medium">{createdData.visitorName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-600 block">소속회사</span>
                <span className="text-slate-800 font-medium">{createdData.organization}</span>
              </div>
              <div>
                <span className="text-xs text-slate-600 block">방문 목적</span>
                <span className="text-slate-800 font-medium">{createdData.purpose}</span>
              </div>
              <div>
                <span className="text-xs text-slate-600 block">방문 예정 일시</span>
                <span className="text-slate-800 font-medium break-words leading-relaxed text-xs">
                  {new Date(createdData.visitDateTime).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}{" "}
                  {new Date(createdData.visitDateTime).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                  {createdData.visitEndDateTime && (
                    <>
                      {" ~ "}
                      {new Date(createdData.visitEndDateTime).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }) ===
                      new Date(createdData.visitDateTime).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                        ? new Date(createdData.visitEndDateTime).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })
                        : `${new Date(createdData.visitEndDateTime).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })} ${new Date(createdData.visitEndDateTime).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}`}
                    </>
                  )}
                </span>
              </div>
              <div className="col-span-2 border-t border-slate-200 pt-3">
                <span className="text-xs text-slate-600 block mb-1">만나실 분 (담당자)</span>
                <span className="text-slate-800 font-medium text-xs">
                  {createdData.hostName} {createdData.hostDepartment ? `(${createdData.hostDepartment})` : ""} - {createdData.hostPhone}
                </span>
              </div>
              {createdData.companions && createdData.companions.length > 0 && (
                <div className="col-span-2 border-t border-slate-200 pt-3">
                  <span className="text-xs text-slate-600 block mb-1.5">동행자 ({createdData.companions.length}명)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {createdData.companions.map((comp: any, idx: number) => (
                      <span key={idx} className="bg-slate-50 border border-slate-200 text-[10px] text-slate-500 px-2 py-0.5 rounded font-mono">
                        {comp.name} ({comp.organization})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full py-3 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white hover:shadow-lg hover:shadow-indigo-500/20 text-white rounded-xl font-medium text-sm transition-all"
          >
            메인 페이지로 이동
          </button>
        </div>
      )}
    </div>
  );
}
