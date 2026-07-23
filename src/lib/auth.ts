import { cookies } from "next/headers";
import prisma from "./prisma";

/**
 * 쿠키에서 session_token을 추출합니다.
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("session_token")?.value || null;
}

/**
 * 세션 토큰을 검증하고 관련 이메일 주소를 반환합니다.
 */
export async function getSessionEmail(): Promise<string | null> {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const secToken = await prisma.securityToken.findUnique({
      where: { token },
    });

    if (!secToken || secToken.expiresAt < new Date()) {
      return null;
    }

    return secToken.email;
  } catch (err) {
    console.error("[Auth] Session validation error:", err);
    return null;
  }
}

/**
 * 호스트(담당자) 권한 세션을 검증합니다.
 */
export async function verifyHostSession(expectedEmail: string): Promise<string> {
  const email = await getSessionEmail();
  if (!email || email.toLowerCase().trim() !== expectedEmail.toLowerCase().trim()) {
    throw new Error("보안 세션 인증에 실패했거나 권한이 없습니다.");
  }
  return email;
}

/**
 * 보안협력사(경비실) 또는 최고 관리자 권한 세션을 검증합니다.
 */
export async function verifySecuritySession(): Promise<string> {
  const email = await getSessionEmail();
  if (!email) {
    throw new Error("보안 세션 인증에 실패했습니다.");
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // 1. 보안협력사 직원 여부 확인
    const staff = await prisma.securityStaff.findUnique({
      where: { email: cleanEmail },
    });

    // 2. 최고 관리자 여부 확인
    const admin = await prisma.adminConfig.findUnique({
      where: { id: "singleton" },
    });
    const isAdmin = admin && admin.adminEmail.toLowerCase().trim() === cleanEmail;

    if (!staff && !isAdmin) {
      throw new Error("해당 보안 콘솔에 접근할 수 있는 권한이 없습니다.");
    }

    return email;
  } catch (err: any) {
    throw new Error(err.message || "보안 검증 중 오류 발생");
  }
}

/**
 * 로그인 토큰 기반으로 보안 쿠키 세션을 생성합니다.
 */
export async function establishSession(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 86400, // 24시간
    path: "/",
  });
}

/**
 * 보안 쿠키 세션을 무효화(삭제)합니다.
 */
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete("session_token");
}
