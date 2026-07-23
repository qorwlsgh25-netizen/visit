"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getEmployeeVehicles,
  addEmployeeVehicle,
  deleteEmployeeVehicle,
  getRotationViolations,
  deleteRotationViolation,
  updateEmployeeVehicle
} from "@/app/actions/lpr";


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

export default function FiveDayRotationPage() {
  const router = useRouter();

  // 보안 인증 상태
  const [email, setEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 데이터 상태
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 등록 폼 상태
  const [form, setForm] = useState({
    employeeName: "",
    phoneNumber: "",
    department: "",
    carNumber: ""
  });
  const [registering, setRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 편집 폼 상태
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    employeeName: "",
    phoneNumber: "",
    department: "",
    carNumber: ""
  });
  const [updating, setUpdating] = useState(false);
  const [editErrorMsg, setEditErrorMsg] = useState<string | null>(null);

  // 1. 보안 인가 쿠키 체크
  useEffect(() => {
    const checkAuth = () => {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(";").shift() || "");
        return "";
      };

      const savedEmail = sessionStorage.getItem("security_email") || getCookie("security_email");
      if (!savedEmail) {
        setAuthLoading(false);
        return;
      }
      setEmail(savedEmail);
      setAuthLoading(false);
    };

    checkAuth();
  }, []);

  // 2. 초기 데이터 로드
  useEffect(() => {
    if (!email) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [vehiclesRes, violationsRes] = await Promise.all([
          getEmployeeVehicles(),
          getRotationViolations()
        ]);

        if (vehiclesRes.success && vehiclesRes.data) {
          setVehicles(vehiclesRes.data);
        }
        if (violationsRes.success && violationsRes.data) {
          setViolations(violationsRes.data);
        }
      } catch (err) {
        console.error("데이터 로드 중 예외:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [email]);

  // 3. 차량 등록 핸들러
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setRegistering(true);

    try {
      const res = await addEmployeeVehicle(
        form.employeeName,
        form.phoneNumber,
        form.department,
        form.carNumber
      );

      if (res.success && res.data) {
        setVehicles((prev) => [res.data, ...prev]);
        setForm({
          employeeName: "",
          phoneNumber: "",
          department: "",
          carNumber: ""
        });
        alert("임직원 차량이 성공적으로 대장에 등록되었습니다.");
      } else {
        setErrorMsg(res.error || "차량 등록에 실패했습니다.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "등록 처리 중 서버 오류가 발생했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  // 4. 차량 삭제 핸들러
  const handleDeleteVehicle = async (id: string, carNumber: string) => {
    if (!confirm(`정말로 차량번호 ${carNumber} 임직원 등록정보를 삭제하시겠습니까?`)) return;

    try {
      const res = await deleteEmployeeVehicle(id);
      if (res.success) {
        setVehicles((prev) => prev.filter((v) => v.id !== id));
        alert("삭제 완료되었습니다.");
      } else {
        alert(res.error || "삭제 실패");
      }
    } catch (err: any) {
      alert(err.message || "삭제 오류");
    }
  };

  // 5. 위반 기록 삭제 핸들러
  const handleDeleteViolation = async (id: string) => {
    if (!confirm("해당 단속 이력 로그를 삭제하시겠습니까?")) return;

    try {
      const res = await deleteRotationViolation(id);
      if (res.success) {
        setViolations((prev) => prev.filter((v) => v.id !== id));
      } else {
        alert(res.error || "로그 삭제 실패");
      }
    } catch (err: any) {
      alert(err.message || "삭제 오류");
    }
  };

  // 5-2. 임직원 차량 편집 및 수정 제출 핸들러
  const handleStartEdit = (v: any) => {
    setEditingVehicle(v);
    setEditErrorMsg(null);
    setEditForm({
      employeeName: v.employeeName,
      phoneNumber: v.phoneNumber,
      department: v.department,
      carNumber: v.carNumber
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    setEditErrorMsg(null);
    setUpdating(true);

    try {
      const res = await updateEmployeeVehicle(
        editingVehicle.id,
        editForm.employeeName,
        editForm.phoneNumber,
        editForm.department,
        editForm.carNumber
      );

      if (res.success && res.data) {
        setVehicles((prev) => 
          prev.map((v) => (v.id === editingVehicle.id ? res.data : v))
        );
        setEditingVehicle(null);
        alert("임직원 차량 정보가 성공적으로 변경되었습니다.");
      } else {
        setEditErrorMsg(res.error || "수정에 실패했습니다.");
      }
    } catch (err: any) {
      setEditErrorMsg(err.message || "수정 중 에러가 발생했습니다.");
    } finally {
      setUpdating(false);
    }
  };

  // 6. 검색 필터
  const filteredVehicles = vehicles.filter((v) => 
    v.employeeName.includes(searchQuery) ||
    v.phoneNumber.includes(searchQuery) ||
    v.carNumber.includes(searchQuery) ||
    v.department.includes(searchQuery)
  );

  // 미인증 보호막
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-600 font-sans text-xs">
        보안 게이트 인가 확인 중...
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-slate-800 font-sans">
        <div className="bg-red-950/20 border border-red-900/40 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 text-red-500 text-3xl font-bold flex items-center justify-center">🔒</div>
          <h2 className="text-xl font-bold text-red-400">보안 접근 권한이 없습니다</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            경비원 전용 보안 화면입니다.<br />
            경비원 대시보드 화면을 통해 메일 인증을 완료한 후 이용해 주십시오.
          </p>
          <div className="pt-4">
            <Link href="/admin/dashboard" className="inline-block px-5 py-2.5 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-xl text-xs font-bold transition-all">
              경비실 대시보드로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans">
      
      {/* 상단 헤더 */}
      <header className="border-b border-slate-200 bg-white backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-slate-950"></span>
          <div>
            <span className="font-bold text-sm tracking-tight text-slate-900">네티젠 테크 아산(본사)</span>
            <span className="block text-[10px] text-[#0F4C81] font-bold uppercase tracking-wider">5부제 관리 및 단속 센터</span>
          </div>
        </div>
        <Link 
          href="/admin/dashboard"
          className="px-4 py-2 bg-[#0F4C81] hover:bg-[#0c3e6b] text-white rounded-xl text-xs font-bold transition-all shadow-md"
        >
          경비실 대시보드로 복귀
        </Link>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <main className="max-w-7xl w-full mx-auto px-4 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* 좌측 컬럼: 임직원 차량 등록 및 대장 (7/12 영역) */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">🏢 사내 임직원 차량 등록 대장</h3>
            <p className="text-[11px] text-slate-600/60 mt-1">사내 주차 시설을 이용하는 임직원의 기본 차량 정보를 등록하고 관리합니다.</p>
          </div>

          {/* 신규 등록 폼 */}
          <form onSubmit={handleRegister} className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-slate-700 block border-b border-slate-200 pb-2">신규 차량 정보 기입</span>
            {errorMsg && (
              <p className="text-xs text-rose-400 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10">⚠️ {errorMsg}</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#0F4C81] mb-1">임직원 성명</label>
                <input
                  type="text"
                  required
                  value={form.employeeName}
                  onChange={(e) => setForm((prev) => ({ ...prev, employeeName: e.target.value }))}
                  placeholder="예: 백진호"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0F4C81]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#0F4C81] mb-1">전화번호</label>
                <input
                  type="text"
                  required
                  value={form.phoneNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: formatPhoneNumber(e.target.value) }))}
                  placeholder="예: 010-1234-5678"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0F4C81]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#0F4C81] mb-1">소속 부서</label>
                <input
                  type="text"
                  required
                  value={form.department}
                  onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                  placeholder="예: 인사총무팀"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0F4C81]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#0F4C81] mb-1">차량 번호 (공백 없이)</label>
                <input
                  type="text"
                  required
                  value={form.carNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, carNumber: e.target.value }))}
                  placeholder="예: 12가3456"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0F4C81]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={registering}
              className="w-full py-2.5 bg-[#0F4C81] hover:bg-[#0c3e6b] rounded-xl text-xs font-bold text-slate-900 transition-all"
            >
              {registering ? "등록 중..." : "차량 등록 완료"}
            </button>
          </form>

          {/* 목록 관리 및 검색 */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600">등록된 차량 명단 ({filteredVehicles.length}건)</span>
              <input
                type="text"
                placeholder="이름, 전화번호, 차량번호 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0F4C81] w-48"
              />
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[40vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white text-[#0F4C81] border-b border-slate-200">
                    <th className="py-2.5 px-4">성명</th>
                    <th className="py-2.5 px-4">전화번호</th>
                    <th className="py-2.5 px-4">소속부서</th>
                    <th className="py-2.5 px-4">차량번호</th>
                    <th className="py-2.5 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-[11px]">
                        조건에 부합하는 등록 임직원 차량이 존재하지 않습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((v) => (
                      <tr key={v.id} className="border-b border-slate-200/20 hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{v.employeeName}</td>
                        <td className="py-2.5 px-4 text-slate-700 font-mono">{v.phoneNumber}</td>
                        <td className="py-2.5 px-4 text-slate-600">{v.department}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-600">{v.carNumber}</td>
                        <td className="py-2.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleStartEdit(v)}
                            className="text-[#0F4C81] hover:text-slate-600 font-semibold"
                          >
                            편집
                          </button>
                          <span className="text-slate-800 text-[10px]">|</span>
                          <button
                            onClick={() => handleDeleteVehicle(v.id, v.carNumber)}
                            className="text-rose-400 hover:text-rose-300 font-semibold"
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
        </section>

        {/* 우측 컬럼: 5부제 위반 단속 기록 (5/12 영역) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-rose-400">📸 금일 5부제 위반 단속 갤러리</h3>
            <p className="text-[11px] text-slate-600/60 mt-1">LPR 카메라 판독에 의해 검출된 사내 5부제 규정 위반 기록입니다.</p>
          </div>

          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {violations.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl">
                <span>🍀</span>
                <span className="text-xs">오늘 적발된 5부제 위반 차량 이력이 없습니다.</span>
              </div>
            ) : (
              violations.map((violation) => (
                <div 
                  key={violation.id}
                  className="bg-white border border-red-950/50 hover:border-red-900/40 rounded-2xl p-4 space-y-3 transition-colors relative group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                        5부제 규정 위반
                      </span>
                      <h4 className="font-bold text-xs text-slate-800 mt-2">
                        {violation.employeeName || "미등록 소유자"} ({violation.department || "정보없음"})
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        단속 시각: {new Date(violation.violatedAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteViolation(violation.id)}
                      className="text-[10px] text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      로그 삭제
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-xs bg-white/80 p-2.5 rounded-lg border border-slate-200 font-mono">
                    <span className="text-slate-600">적발 차량번호</span>
                    <span className="font-bold text-rose-400">{violation.carNumber}</span>
                  </div>

                  {/* 캡처 이미지 */}
                  {violation.imageUrl && (
                    <div className="border border-red-950/40 rounded-xl overflow-hidden aspect-video bg-white flex items-center justify-center">
                      <img 
                        src={violation.imageUrl} 
                        alt="Violation Capture"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

      </main>

      <footer className="border-t border-slate-200 py-6 bg-white text-center text-[#0F4C81]/30 text-[10px] mt-8">
        &copy; {new Date().getFullYear()} 네티젠 테크 통합 보안 출입 관리 시스템
      </footer>

      {/* 임직원 차량 편집 다이얼로그 모달 */}
      {editingVehicle && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center p-6 z-[9999]">
          <div className="bg-white border border-[#0F4C81]/30 p-8 rounded-3xl max-w-md w-full space-y-6 shadow-2xl relative">
            <button 
              onClick={() => setEditingVehicle(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">✏️ 임직원 차량 정보 편집</h3>
              <p className="text-[10px] text-[#0F4C81]">선택된 임직원 차량 정보를 변경합니다.</p>
            </div>

            {editErrorMsg && (
              <p className="text-xs text-rose-400 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10">⚠️ {editErrorMsg}</p>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#0F4C81] mb-1">임직원 성명</label>
                  <input
                    type="text"
                    required
                    value={editForm.employeeName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, employeeName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0F4C81]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#0F4C81] mb-1">전화번호</label>
                  <input
                    type="text"
                    required
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: formatPhoneNumber(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0F4C81]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#0F4C81] mb-1">소속 부서</label>
                  <input
                    type="text"
                    required
                    value={editForm.department}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0F4C81]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#0F4C81] mb-1">차량 번호</label>
                  <input
                    type="text"
                    required
                    value={editForm.carNumber}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, carNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:border-[#0F4C81]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="flex-1 py-2.5 bg-white hover:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#0F4C81] hover:bg-[#0c3e6b] rounded-xl text-xs font-bold text-slate-900 transition-all"
                >
                  수정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
