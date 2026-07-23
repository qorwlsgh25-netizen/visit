"use server";

import prisma from "@/lib/prisma";
import { getSessionEmail } from "@/lib/auth";

import nodemailer from "nodemailer";

export interface SmtpSettingInput {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  secure: boolean;
  senderEmail: string;
  senderName: string;
}

/**
 * 현재 등록된 최고 관리자 이메일을 조회합니다.
 */
export async function getAdminEmail() {
  try {
    const config = await prisma.adminConfig.findUnique({
      where: { id: "singleton" },
    });
    return { success: true, adminEmail: config?.adminEmail || null };
  } catch (error: any) {
    console.error("관리자 이메일 조회 오류:", error);
    return { success: false, error: error.message || "관리자 이메일을 조회하지 못했습니다." };
  }
}

/**
 * SMTP 설정을 조회합니다. DB에 기록이 없을 시 src/smtp.md 정보를 기본값으로 반환합니다.
 */
export async function getSmtpSetting(token?: string) {
  try {
    // 1. 보안 권한 검증 (전달된 1회성 토큰이 있거나, 관리자 로그인 세션이 활성화된 상태여야 함)
    if (token) {
      const val = await validateSecurityToken(token);
      if (!val.success) {
        throw new Error("유효하지 않은 보안 토큰입니다.");
      }
    } else {
      const email = await getSessionEmail();
      if (!email) {
        throw new Error("권한이 없습니다. 관리자 로그인이 필요합니다.");
      }
      const admin = await prisma.adminConfig.findUnique({
        where: { id: "singleton" }
      });
      if (!admin || admin.adminEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
        throw new Error("최고 관리자만 접근할 수 있습니다.");
      }
    }

    let setting = await prisma.smtpSetting.findUnique({
      where: { id: "singleton" },
    });

    if (!setting) {
      setting = {
        id: "singleton",
        smtpHost: process.env.SMTP_HOST || "smtp.example.com",
        smtpPort: Number(process.env.SMTP_PORT) || 587,
        smtpUser: process.env.SMTP_USER || "user@example.com",
        smtpPassword: process.env.SMTP_PASSWORD || "dummy_password",
        secure: process.env.SMTP_SECURE === "true",
        senderEmail: process.env.SENDER_EMAIL || "no-reply@example.com",
        senderName: "Netizen Tech",
        updatedAt: new Date(),
      };
    }

    return { success: true, data: setting };
  } catch (error: any) {
    console.error("SMTP 설정 조회 오류:", error);
    return { success: false, error: error.message || "SMTP 설정을 불러오지 못했습니다." };
  }
}

/**
 * 관리자 메일 변경을 위해 보안 일회성 링크(토큰)를 요청하고 발송합니다.
 */
export async function requestAdminSecurityToken(email: string) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("유효한 이메일 주소를 입력해 주십시오.");
  }

  try {
    // 1. 관리자 설정이 존재하는지 확인
    let adminConfig = await prisma.adminConfig.findUnique({
      where: { id: "singleton" },
    });

    // 2. 만약 첫 등록 상태라면, 이메일을 최초 관리자 이메일로 자동 등록(부트스트랩)
    if (!adminConfig) {
      adminConfig = await prisma.adminConfig.create({
        data: {
          id: "singleton",
          adminEmail: email,
        },
      });
    } else if (adminConfig.adminEmail !== email) {
      return {
        success: false,
        error: "등록된 최고 관리자 이메일 주소와 일치하지 않습니다.",
      };
    }

    // 3. 일회성 보안 토큰 생성 (15분간 유효)
    const crypto = await import("crypto");
    const tokenValue = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15분 후 만료

    await prisma.securityToken.create({
      data: {
        token: tokenValue,
        email: email,
        expiresAt: expiresAt,
      },
    });

    const link = `http://10.10.5.56:3000/admin/smtp?token=${tokenValue}`;
    // 개발 테스트 및 운영 진단 로그용으로 서버 콘솔에 인증용 링크 주소를 상시 기록합니다.
    console.log(`[ADMIN SECURITY TOKEN LINK GENERATED]: ${link}`);

    // 4. SMTP 설정을 조회하여 인증 메일 발송 시도
    const smtpSetting = await prisma.smtpSetting.findUnique({
      where: { id: "singleton" },
    });

    // SMTP가 설정되어 있지 않은 최초 기동 상태인 경우: 메일 전송이 불가하므로 부트스트랩을 위해 화면에 토큰을 출력하도록 유도
    if (!smtpSetting) {
      console.warn(`[Bootstrap Token Link Generated]: ${link}`);
      return {
        success: true,
        isSmtpNotConfigured: true,
        token: tokenValue,
        link: link,
      };
    }

    // SMTP가 정상 등록되어 있는 경우 메일 발송
    const transporter = nodemailer.createTransport({
      host: smtpSetting.smtpHost,
      port: smtpSetting.smtpPort,
      secure: smtpSetting.secure,
      auth: {
        user: smtpSetting.smtpUser,
        pass: smtpSetting.smtpPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1e1b4b; padding: 25px; text-align: center; color: white;">
          <h3 style="margin: 0; font-size: 20px;">[보안 인증] SMTP 설정 변경 일회성 메일링크</h3>
        </div>
        <div style="padding: 25px; line-height: 1.6; color: #1e293b;">
          <p>안녕하세요, 최고 관리자님.</p>
          <p>방문자 예약 시스템의 **SMTP 메일 서버 설정 변경**을 승인하기 위한 일회성 보안 인증 링크가 발급되었습니다.</p>
          <p>설정 변경 양식을 활성화하고 수정하려면 아래 버튼을 클릭하십시오. (발급 후 15분 동안만 유효합니다.)</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              메일 서버 설정 변경하기
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b;">만약 본인이 요청한 것이 아니라면 본 메일을 즉시 삭제하고 비밀번호 변경을 권장합니다.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
      to: email,
      subject: `[보안인증] 메일 서버 설정 변경용 일회성 링크`,
      html: mailHtml,
    });

    return { success: true, isSmtpNotConfigured: false };
  } catch (error: any) {
    console.error("보안인증 토큰 발급 오류:", error);
    return { success: false, error: error.message || "보안 인증 메일 발송 중 오류가 발생했습니다." };
  }
}

/**
 * 전달받은 보안 토큰의 유효성을 검증합니다.
 */
export async function validateSecurityToken(token: string) {
  if (!token) {
    return { success: false, error: "토큰 정보가 제공되지 않았습니다." };
  }

  try {
    const dbToken = await prisma.securityToken.findUnique({
      where: { token },
    });

    if (!dbToken) {
      return { success: false, error: "유효하지 않거나 만료된 보안 토큰 링크입니다." };
    }

    if (dbToken.expiresAt < new Date()) {
      // 만료된 토큰 삭제 처리
      await prisma.securityToken.delete({ where: { id: dbToken.id } }).catch(() => {});
      return { success: false, error: "보안 토큰의 유효 시간이 만료되었습니다." };
    }

    return { success: true, email: dbToken.email };
  } catch (error: any) {
    console.error("토큰 검증 오류:", error);
    return { success: false, error: error.message || "토큰 검증 중 오류가 발생했습니다." };
  }
}

/**
 * 보안 토큰 검증을 거친 후 SMTP 설정을 업서트하며, 추가적으로 최고 관리자 이메일 주소도 변경 가능하도록 업데이트합니다.
 */
export async function upsertSmtpSettingWithToken(token: string, data: SmtpSettingInput & { newAdminEmail?: string }) {
  if (!token) {
    throw new Error("보안 인증 토큰이 누락되어 설정을 변경할 수 없습니다.");
  }

  // 1. 토큰 유효성 검사
  const tokenValidation = await validateSecurityToken(token);
  if (!tokenValidation.success) {
    throw new Error(tokenValidation.error || "보안 인증을 통과하지 못했습니다.");
  }

  try {
    // 2. SMTP 정보 저장
    await prisma.smtpSetting.upsert({
      where: { id: "singleton" },
      update: {
        smtpHost: data.smtpHost,
        smtpPort: Number(data.smtpPort),
        smtpUser: data.smtpUser,
        smtpPassword: data.smtpPassword,
        secure: data.secure,
        senderEmail: data.senderEmail,
        senderName: data.senderName,
      },
      create: {
        id: "singleton",
        smtpHost: data.smtpHost,
        smtpPort: Number(data.smtpPort),
        smtpUser: data.smtpUser,
        smtpPassword: data.smtpPassword,
        secure: data.secure,
        senderEmail: data.senderEmail,
        senderName: data.senderName,
      },
    });

    // 3. 만약 관리자 이메일 변경 정보가 넘어왔다면 업데이트
    if (data.newAdminEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.newAdminEmail)) {
      await prisma.adminConfig.upsert({
        where: { id: "singleton" },
        update: {
          adminEmail: data.newAdminEmail,
        },
        create: {
          id: "singleton",
          adminEmail: data.newAdminEmail,
        },
      });
    }

    // 4. 사용이 끝난 일회성 토큰은 안전하게 즉각 삭제
    await prisma.securityToken.delete({
      where: { token },
    }).catch(() => {});

    return { success: true };
  } catch (error: any) {
    console.error("보안 메일 서버 설정 저장 오류:", error);
    return { success: false, error: error.message || "설정 저장 중 오류가 발생했습니다." };
  }
}

/**
 * 보안협력사 담당자 목록 조회 (최고관리자 토큰 기반 인증)
 */
export async function getSecurityStaffList(token: string) {
  if (!token) return { success: false, error: "관리자 인증 토큰이 누락되었습니다." };
  const tokenValidation = await validateSecurityToken(token);
  if (!tokenValidation.success) return { success: false, error: tokenValidation.error || "관리자 인증 실패" };
  
  try {
    const list = await prisma.securityStaff.findMany({
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: list };
  } catch (error: any) {
    console.error("보안협력사 목록 조회 오류:", error);
    return { success: false, error: error.message || "조회 중 오류 발생" };
  }
}

/**
 * 보안협력사 담당자 추가 (최고관리자 토큰 기반 인증)
 */
export async function addSecurityStaff(token: string, email: string, name?: string) {
  if (!token) return { success: false, error: "관리자 인증 토큰이 누락되었습니다." };
  const tokenValidation = await validateSecurityToken(token);
  if (!tokenValidation.success) return { success: false, error: tokenValidation.error || "관리자 인증 실패" };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "유효한 이메일 주소를 입력해 주십시오." };
  }

  try {
    const existing = await prisma.securityStaff.findUnique({
      where: { email: email.trim().toLowerCase() }
    });
    if (existing) {
      return { success: false, error: "이미 등록된 보안협력사 이메일 주소입니다." };
    }

    const created = await prisma.securityStaff.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name?.trim() || null
      }
    });

    return { success: true, data: created };
  } catch (error: any) {
    console.error("보안협력사 등록 오류:", error);
    return { success: false, error: error.message || "등록 중 오류 발생" };
  }
}

/**
 * 보안협력사 담당자 삭제 (최고관리자 토큰 기반 인증)
 */
export async function deleteSecurityStaff(token: string, id: string) {
  if (!token) return { success: false, error: "관리자 인증 토큰이 누락되었습니다." };
  const tokenValidation = await validateSecurityToken(token);
  if (!tokenValidation.success) return { success: false, error: tokenValidation.error || "관리자 인증 실패" };

  try {
    await prisma.securityStaff.delete({
      where: { id }
    });
    return { success: true };
  } catch (error: any) {
    console.error("보안협력사 삭제 오류:", error);
    return { success: false, error: error.message || "삭제 중 오류 발생" };
  }
}
