"use server";

import prisma from "@/lib/prisma";
import { 
  verifyHostSession, 
  verifySecuritySession, 
  establishSession, 
  destroySession, 
  getSessionEmail 
} from "@/lib/auth";

import { sendVisitNotification } from "@/lib/email";

// SQLite 버전에 맞춰 ReservationStatus 열거형 타입을 유니온 타입으로 대체 정의합니다.
export type ReservationStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface CompanionInput {
  name: string;
  email: string; // 동행자 이메일 (필수)
  phoneNumber: string;
  organization: string;
  carNumber?: string;
  equipment?: string;
  notes?: string;
}

export interface CreateReservationInput {
  visitorName: string;
  visitorEmail: string; // 방문자 이메일 (필수)
  birthDate: string; // 생년월일 (YYMMDD)
  phoneNumber: string; // 연락처
  organization: string; // 소속사명
  carNumber?: string; // 차량번호 (선택)
  carType?: string; // 차종 (선택)
  purpose: string; // 방문 목적
  visitDateTime: string; // 방문 시작 일시 (ISO String)
  visitEndDateTime?: string; // 방문 종료 일시 (ISO String)
  
  // 만나실 분(담당자) 정보
  hostName: string; // 담당자 성명
  hostPhone: string; // 담당자 연락처
  hostEmail: string; // 담당자 이메일 (필수)
  hostDepartment?: string; // 담당자 부서

  // 동행자 목록 (최대 10명)
  companions?: CompanionInput[];

  termsAgreed: boolean;
  privacyAgreed: boolean;
  securityAgreed: boolean;
  secretAgreed: boolean;
  safetyAgreed: boolean;
}

/**
 * 6자리의 고유한 숫자 예약 번호를 생성합니다.
 */
async function generateUnique6DigitId(): Promise<string> {
  let attempts = 0;
  while (attempts < 100) {
    const id = Math.floor(100000 + Math.random() * 900000).toString();
    const existing = await prisma.reservation.findUnique({
      where: { id },
    });
    if (!existing) {
      return id;
    }
    attempts++;
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 새로운 방문 예약을 신청합니다 (동행자 및 담당자 정보 포함).
 */
export async function createReservation(data: CreateReservationInput) {
  // 필수 필드 유효성 검사
  if (
    !data.visitorName ||
    !data.visitorEmail ||
    !data.birthDate ||
    !data.phoneNumber ||
    !data.organization ||
    !data.purpose ||
    !data.visitDateTime ||
    !data.hostName ||
    !data.hostPhone ||
    !data.hostEmail
  ) {
    throw new Error("필수 입력 항목이 누락되었습니다.");
  }

  // 약관 및 서약 동의 유효성 검사
  if (!data.termsAgreed || !data.privacyAgreed || !data.securityAgreed || !data.secretAgreed || !data.safetyAgreed) {
    throw new Error("모든 필수 약관 및 서약서에 동의하셔야 신청이 가능합니다.");
  }

  // 동행자 수 제한 및 필수 정보 유효성 검사 (최대 10명)
  if (data.companions) {
    if (data.companions.length > 10) {
      throw new Error("동행자는 최대 10명까지만 추가할 수 있습니다.");
    }
    for (const comp of data.companions) {
      if (!comp.name || !comp.email || !comp.phoneNumber || !comp.organization) {
        throw new Error("동행자 필수 항목(성명, 이메일, 연락처, 소속회사)이 누락되었습니다.");
      }
    }
  }

  try {
    const uniqueId = await generateUnique6DigitId();
    const reservation = await prisma.reservation.create({
      data: {
        id: uniqueId,
        visitorName: data.visitorName,
        visitorEmail: data.visitorEmail,
        birthDate: data.birthDate,
        phoneNumber: data.phoneNumber,
        organization: data.organization,
        carNumber: data.carNumber || null,
        carType: data.carType || null,
        purpose: data.purpose,
        visitDateTime: new Date(data.visitDateTime),
        visitEndDateTime: data.visitEndDateTime ? new Date(data.visitEndDateTime) : null,
        hostName: data.hostName,
        hostPhone: data.hostPhone,
        hostEmail: data.hostEmail,
        hostDepartment: data.hostDepartment || null,
        termsAgreed: data.termsAgreed,
        privacyAgreed: data.privacyAgreed,
        securityAgreed: data.securityAgreed,
        secretAgreed: data.secretAgreed,
        safetyAgreed: data.safetyAgreed,
        status: "PENDING",
        companions: {
          create: data.companions
            ? data.companions.map((comp) => ({
                name: comp.name,
                email: comp.email,
                phoneNumber: comp.phoneNumber,
                organization: comp.organization,
                carNumber: comp.carNumber || null,
                equipment: comp.equipment || null,
                notes: comp.notes || null,
              }))
            : [],
        },
      },
      include: {
        companions: true,
      },
    });

    // 호스트의 즉시 1클릭 대시보드 승인 검토 진입을 위한 보안 토큰 생성
    const crypto = await import("crypto");
    const hostToken = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일간 유효
    
    await prisma.securityToken.create({
      data: {
        token: hostToken,
        email: reservation.hostEmail.trim().toLowerCase(),
        expiresAt
      }
    });

    // 메일 발송 비동기 트리거 (사용자 대기 시간이 길어지지 않도록 비동기로 처리)
    sendVisitNotification({
      id: reservation.id,
      visitorName: reservation.visitorName,
      visitorEmail: reservation.visitorEmail,
      organization: reservation.organization,
      phoneNumber: reservation.phoneNumber,
      purpose: reservation.purpose,
      visitDateTime: reservation.visitDateTime,
      visitEndDateTime: reservation.visitEndDateTime,
      hostName: reservation.hostName,
      hostEmail: reservation.hostEmail,
      hostPhone: reservation.hostPhone,
      hostDepartment: reservation.hostDepartment,
      companions: reservation.companions,
      hostToken: hostToken, // 메일 본문에 전달
    }).catch((err) => {
      console.error("[Email Error] Failed to send email alert asynchronously:", err);
    });

    return { success: true, data: reservation };
  } catch (error: any) {
    console.error("방문 예약 신청 오류:", error);
    return { success: false, error: error.message || "방문 예약 신청 중 오류가 발생했습니다." };
  }
}

/**
 * ID, 생년월일, 연락처 정보를 바탕으로 방문 상세 내역을 조회합니다.
 */
export async function getReservation(id: string, birthDate: string, phoneNumber: string) {
  if (!id || !birthDate || !phoneNumber) {
    throw new Error("조회에 필요한 정보가 누락되었습니다.");
  }

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        companions: true,
      },
    });

    if (!reservation) {
      return { success: false, error: "해당 예약 내역을 찾을 수 없습니다." };
    }

    // 본인 확인 (생년월일 및 연락처 검증)
    if (reservation.birthDate !== birthDate || reservation.phoneNumber !== phoneNumber) {
      return { success: false, error: "입력된 정보가 예약자 정보와 일치하지 않습니다." };
    }

    return { success: true, data: reservation };
  } catch (error: any) {
    console.error("방문 예약 조회 오류:", error);
    return { success: false, error: error.message || "방문 예약 조회 중 오류가 발생했습니다." };
  }
}

/**
 * 관리자가 특정 예약의 상태(승인, 반려)를 업데이트합니다.
 */
export async function updateReservationStatus(id: string, status: ReservationStatus) {
  if (!id || !status) {
    throw new Error("ID 또는 변경할 상태가 누락되었습니다.");
  }

  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    throw new Error("권한이 없습니다. 로그인이 필요합니다.");
  }

  try {
    const existing = await prisma.reservation.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("해당 예약을 찾을 수 없습니다.");
    }

    // 보안실/관리자 권한 확인 시도, 실패 시 해당 호스트 본인인지 확인
    let isSec = false;
    try {
      await verifySecuritySession();
      isSec = true;
    } catch {
      isSec = false;
    }

    if (!isSec && existing.hostEmail.toLowerCase().trim() !== sessionEmail.toLowerCase().trim()) {
      throw new Error("해당 방문 예약을 승인/반려할 권한이 없습니다.");
    }

    const reservation = await prisma.reservation.update({
      where: { id },
      data: { status },
      include: {
        companions: true,
      },
    });

    // 상태 변경이 APPROVED(최종 승인)인 경우 최종 승인 통보 메일 발송 트리거
    if (status === "APPROVED") {
      const { sendApprovalNotification } = await import("@/lib/email");
      sendApprovalNotification({
        id: reservation.id,
        visitorName: reservation.visitorName,
        visitorEmail: reservation.visitorEmail,
        organization: reservation.organization,
        phoneNumber: reservation.phoneNumber,
        purpose: reservation.purpose,
        visitDateTime: reservation.visitDateTime,
        visitEndDateTime: reservation.visitEndDateTime,
        hostName: reservation.hostName,
        hostEmail: reservation.hostEmail,
        hostPhone: reservation.hostPhone,
        hostDepartment: reservation.hostDepartment,
        companions: reservation.companions,
      }).catch((err) => {
        console.error("[Email Error] Failed to send final approval email asynchronously:", err);
      });
    }

    return { success: true, data: reservation };
  } catch (error: any) {
    console.error("방문 예약 상태 변경 오류:", error);
    return { success: false, error: error.message || "방문 예약 상태 변경 중 오류가 발생했습니다." };
  }
}

/**
 * 신청자 이메일 주소 및 접수번호를 기반으로 방문 예약을 조회합니다.
 */
export async function lookupReservation(visitorEmail: string, id: string) {
  if (!visitorEmail || !id) {
    throw new Error("이메일 주소와 접수번호를 모두 입력해 주십시오.");
  }

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        companions: true,
      },
    });

    if (!reservation) {
      return { success: false, error: "일치하는 예약 정보를 찾을 수 없습니다." };
    }

    // 이메일 주소가 일치하는지 비교 (대소문자 무관 비교 적용)
    if (reservation.visitorEmail.toLowerCase().trim() !== visitorEmail.toLowerCase().trim()) {
      return { success: false, error: "입력하신 이메일 주소가 예약 정보와 일치하지 않습니다." };
    }

    return { success: true, data: reservation };
  } catch (error: any) {
    console.error("방문 예약 조회(lookup) 오류:", error);
    return { success: false, error: error.message || "방문 예약 조회 중 오류가 발생했습니다." };
  }
}

/**
 * 방문 예약을 취소 상태로 변경하고 신청자 및 담당자에게 취소 알림 메일을 전송합니다.
 */
export async function cancelReservation(visitorEmail: string, id: string) {
  if (!visitorEmail || !id) {
    throw new Error("취소 요청 정보가 부족합니다.");
  }

  try {
    // 1. 예약 조회 및 검증
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        companions: true,
      },
    });

    if (!reservation) {
      return { success: false, error: "해당 예약 내역을 찾을 수 없습니다." };
    }

    if (reservation.visitorEmail.toLowerCase().trim() !== visitorEmail.toLowerCase().trim()) {
      return { success: false, error: "본인 확인 정보가 일치하지 않아 취소할 수 없습니다." };
    }

    if (reservation.status === "CANCELLED") {
      return { success: false, error: "이미 취소 완료된 방문 예약입니다." };
    }

    // 2. 상태를 CANCELLED로 변경
    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: {
        companions: true,
      },
    });

    // 3. 취소 알림 메일 발송 비동기 호출
    const { sendCancellationNotification } = await import("@/lib/email");
    sendCancellationNotification({
      id: updated.id,
      visitorName: updated.visitorName,
      visitorEmail: updated.visitorEmail,
      organization: updated.organization,
      phoneNumber: updated.phoneNumber,
      purpose: updated.purpose,
      visitDateTime: updated.visitDateTime,
      visitEndDateTime: updated.visitEndDateTime,
      hostName: updated.hostName,
      hostEmail: updated.hostEmail,
      hostPhone: updated.hostPhone,
      hostDepartment: updated.hostDepartment,
      companions: updated.companions,
    }).catch((err) => {
      console.error("[Email Error] Failed to send cancellation email:", err);
    });

    return { success: true, data: updated };
  } catch (error: any) {
    console.error("방문 예약 취소 처리 오류:", error);
    return { success: false, error: error.message || "취소 처리 중 오류가 발생했습니다." };
  }
}

/**
 * 보안 메일링크의 토큰을 검증합니다.
 */
export async function verifyHostToken(email: string, token: string) {
  if (!email || !token) return { success: false, error: "이메일 또는 보안 토큰이 제공되지 않았습니다." };
  try {
    const secToken = await prisma.securityToken.findFirst({
      where: {
        token,
        email: email.trim().toLowerCase(),
        expiresAt: { gt: new Date() }
      }
    });
    if (!secToken) {
      return { success: false, error: "만료되었거나 유효하지 않은 보안 로그인 링크입니다." };
    }
    await establishSession(token);
    return { success: true };
  } catch (error: any) {
    console.error("보안 토큰 검증 에러:", error);
    return { success: false, error: "토큰 검증 중 서버 에러가 발생했습니다." };
  }
}

/**
 * 호스트용 보안 로그인 링크 이메일을 요청합니다.
 */
export async function requestHostLoginLink(email: string) {
  if (!email) return { success: false, error: "이메일 주소를 입력해 주십시오." };
  
  const cleanEmail = email.trim().toLowerCase();
  try {
    // 해당 이메일이 담당자로 등록된 예약 건수 검증
    const count = await prisma.reservation.count({
      where: { hostEmail: cleanEmail }
    });
    if (count === 0) {
      return { success: false, error: "등록된 호스트 담당자 이메일 주소가 아닙니다. 방문자가 호스트로 기재한 이메일 주소여야 합니다." };
    }
    
    // 토큰 생성 및 만료 시간 설정 (24시간)
    const crypto = await import("crypto");
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await prisma.securityToken.create({
      data: {
        token,
        email: cleanEmail,
        expiresAt
      }
    });
    
    // 이메일 전송
    const { sendHostLoginEmail } = await import("@/lib/email");
    const result = await sendHostLoginEmail(cleanEmail, token);
    if (result.success) {
      return { success: true, message: "이메일로 대시보드 로그인 보안 링크가 발송되었습니다." };
    } else {
      return { success: false, error: result.error || "메일 전송에 실패했습니다." };
    }
  } catch (err: any) {
    console.error("호스트 로그인 메일 요청 오류:", err);
    return { success: false, error: err.message || "요청 처리 중 서버 에러가 발생했습니다." };
  }
}

/**
 * 특정 호스트 이메일로 요청된 모든 방문 신청서를 가져옵니다.
 */
export async function getHostReservations(hostEmail: string) {
  if (!hostEmail) return { success: false, error: "이메일 주소가 누락되었습니다." };
  try {
    await verifyHostSession(hostEmail);
    const reservations = await prisma.reservation.findMany({
      where: { hostEmail: hostEmail.trim().toLowerCase() },
      include: { companions: true },
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: reservations };
  } catch (err: any) {
    console.error("호스트 예약 조회 오류:", err);
    return { success: false, error: err.message || "조회 중 오류가 발생했습니다." };
  }
}

/**
 * 정문 경비실을 위한 오늘의 방문객 리스트를 가져옵니다.
 */
export async function getSecurityReservations(query?: string) {
  try {
    await verifySecuritySession();
    const now = new Date();
    // 당일의 시작과 끝 (로컬 타임 기준 설정)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const whereClause: any = {
      OR: [
        {
          // 당일 방문 기간에 포함되는 예약
          visitDateTime: { lte: endOfToday },
          visitEndDateTime: { gte: startOfToday }
        },
        {
          // 당일 단일 방문 예약
          visitDateTime: { gte: startOfToday, lte: endOfToday }
        },
        {
          // 현재 로비/건물 내에 들어와 있는 예약
          status: "ENTERED"
        }
      ]
    };
    
    if (query) {
      const cleanQuery = query.trim();
      whereClause.AND = {
        OR: [
          { visitorName: { contains: cleanQuery } },
          { organization: { contains: cleanQuery } },
          { id: { contains: cleanQuery } },
          { phoneNumber: { contains: cleanQuery } }
        ]
      };
    }
    
    const reservations = await prisma.reservation.findMany({
      where: whereClause,
      include: { companions: true },
      orderBy: [
        { visitDateTime: "asc" },
        { createdAt: "desc" }
      ]
    });
    
    return { success: true, data: reservations };
  } catch (err: any) {
    console.error("보안실 목록 조회 에러:", err);
    return { success: false, error: err.message || "조회 중 오류가 발생했습니다." };
  }
}

/**
 * 방문객 정문 입실 체크인 처리를 수행합니다.
 */
export async function checkInVisitor(
  id: string,
  temporaryCardNumber: string,
  idCardKept: boolean,
  deviceSealed: boolean
) {
  if (!id) return { success: false, error: "예약 ID가 누락되었습니다." };
  if (!temporaryCardNumber) return { success: false, error: "임시출입카드 발급 번호를 입력해 주십시오." };
  
  try {
    await verifySecuritySession();
    const reservation = await prisma.reservation.findUnique({
      where: { id }
    });
    
    if (!reservation) {
      return { success: false, error: "해당 예약을 찾을 수 없습니다." };
    }
    
    if (reservation.status !== "APPROVED") {
      return { success: false, error: "최종 승인 완료(APPROVED)된 예약만 입실 처리할 수 있습니다." };
    }
    
    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status: "ENTERED",
        enteredAt: new Date(),
        temporaryCardNumber,
        idCardKept,
        deviceSealed
      },
      include: { companions: true }
    });
    
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("입실 처리 오류:", err);
    return { success: false, error: err.message || "입실 처리 중 에러가 발생했습니다." };
  }
}

/**
 * 방문객 정문 퇴실 체크아웃 처리를 수행합니다.
 */
export async function checkOutVisitor(id: string) {
  if (!id) return { success: false, error: "예약 ID가 누락되었습니다." };
  
  try {
    await verifySecuritySession();
    const reservation = await prisma.reservation.findUnique({
      where: { id }
    });
    
    if (!reservation) {
      return { success: false, error: "해당 예약을 찾을 수 없습니다." };
    }
    
    if (reservation.status !== "ENTERED") {
      return { success: false, error: "입실 완료(ENTERED) 상태인 예약만 퇴실 처리할 수 있습니다." };
    }
    
    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status: "EXITED",
        exitedAt: new Date(),
        idCardKept: false // 신분증은 퇴실 시 반납하므로 false 처리
      },
      include: { companions: true }
    });
    
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("퇴실 처리 오류:", err);
    return { success: false, error: err.message || "퇴실 처리 중 에러가 발생했습니다." };
  }
}

/**
 * 보안협력사용 보안 로그인 링크 이메일을 요청하고 발송합니다.
 */
export async function requestSecurityLoginLink(email: string) {
  if (!email) return { success: false, error: "이메일 주소를 입력해 주십시오." };
  
  const cleanEmail = email.trim().toLowerCase();
  try {
    // 등록된 보안협력사 이메일인지 검증
    const staff = await prisma.securityStaff.findUnique({
      where: { email: cleanEmail }
    });
    if (!staff) {
      return { success: false, error: "등록되지 않은 보안협력사 이메일 주소입니다. 최고관리자 콘솔에서 먼저 이메일을 등록해야 합니다." };
    }
    
    // 토큰 생성 및 만료 시간 설정 (24시간)
    const crypto = await import("crypto");
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await prisma.securityToken.create({
      data: {
        token,
        email: cleanEmail,
        expiresAt
      }
    });
    
    // 이메일 전송
    const { sendSecurityLoginEmail } = await import("@/lib/email");
    const result = await sendSecurityLoginEmail(cleanEmail, token);
    if (result.success) {
      return { success: true, message: "이메일로 보안 대시보드 로그인 링크가 발송되었습니다." };
    } else {
      return { success: false, error: result.error || "메일 전송에 실패했습니다." };
    }
  } catch (err: any) {
    console.error("보안 로그인 링크 요청 오류:", err);
    return { success: false, error: err.message || "요청 처리 중 서버 에러가 발생했습니다." };
  }
}

/**
 * 보안협력사용 로그인 보안 토큰을 검증합니다.
 */
export async function verifySecurityToken(email: string, token: string) {
  if (!email || !token) return { success: false, error: "이메일 또는 보안 토큰이 제공되지 않았습니다." };
  try {
    const secToken = await prisma.securityToken.findFirst({
      where: {
        token,
        email: email.trim().toLowerCase(),
        expiresAt: { gt: new Date() }
      }
    });
    if (!secToken) {
      return { success: false, error: "만료되었거나 유효하지 않은 보안 로그인 링크입니다." };
    }
    await establishSession(token);
    return { success: true };
  } catch (error: any) {
    console.error("보안 토큰 검증 에러:", error);
    return { success: false, error: "토큰 검증 중 서버 에러가 발생했습니다." };
  }
}

/**
 * 캘린더 뷰를 위한 특정 연/월의 모든 예약 일정을 가져옵니다.
 */
export async function getMonthlyReservations(year: number, month: number) {
  try {
    await verifySecuritySession();
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    
    const reservations = await prisma.reservation.findMany({
      where: {
        OR: [
          {
            visitDateTime: { gte: startOfMonth, lte: endOfMonth }
          },
          {
            // 여러 날에 걸친 방문 예약 조회 포함
            visitDateTime: { lte: endOfMonth },
            visitEndDateTime: { gte: startOfMonth }
          }
        ]
      },
      include: { companions: true },
      orderBy: { visitDateTime: "asc" }
    });
    
    return { success: true, data: reservations };
  } catch (err: any) {
    console.error("월간 예약 목록 조회 에러:", err);
    return { success: false, error: err.message || "조회 중 오류가 발생했습니다." };
  }
}

export async function logout() {
  await destroySession();
  return { success: true };
}
