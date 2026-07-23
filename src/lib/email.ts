import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";
import QRCode from "qrcode";

interface CompanionData {
  name: string;
  phoneNumber: string;
  organization: string;
  email?: string; // 동행자 이메일 추가
}

interface ReservationData {
  id: string;
  visitorName: string;
  visitorEmail: string;
  organization: string;
  phoneNumber: string;
  purpose: string;
  visitDateTime: Date;
  visitEndDateTime?: Date | null;
  carNumber?: string | null; // 차량 번호 추가
  hostName: string;
  hostEmail: string;
  hostPhone: string;
  hostDepartment?: string | null;
  companions?: CompanionData[];
  hostToken?: string;
}

/**
 * 방문 예약 완료 알림 메일을 발송합니다.
 */
export async function sendVisitNotification(reservation: ReservationData) {
  try {
    // 1. DB에서 SMTP 설정 가져오기
    let smtpSetting = await prisma.smtpSetting.findUnique({
      where: { id: "singleton" },
    });

    if (!smtpSetting) {
      // DB에 설정이 미등록된 경우 src/smtp.md 설정값으로 항시 자동 폴백(기본값 유지)
      smtpSetting = {
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

    // 2. Transporter 설정
    const transporter = nodemailer.createTransport({
      host: smtpSetting.smtpHost,
      port: smtpSetting.smtpPort,
      secure: smtpSetting.secure, // true for port 465, false for other ports
      auth: {
        user: smtpSetting.smtpUser,
        pass: smtpSetting.smtpPassword,
      },
      tls: {
        // 사내 메일 서버 또는 자체 서명된(Self-signed) 인증서 환경에서도 
        // 보안인증서 실패로 인한 전송 블록을 막기 위해 unauthorized 에러를 무시하도록 허용합니다.
        rejectUnauthorized: false,
      },
    });

    const formattedStartDate = new Date(reservation.visitDateTime).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const formattedEndDate = reservation.visitEndDateTime
      ? new Date(reservation.visitEndDateTime).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    const dateDisplay = formattedEndDate
      ? `${formattedStartDate} ~ ${formattedEndDate}`
      : formattedStartDate;

    // 2.5 QR 코드 생성 (인식기 검증용 링크)
    const scanUrl = `http://10.10.5.56:3000/admin/scan?id=${reservation.id}`;
    
    // 호스트 결재 대시보드로 이동하는 보안 일회용 토큰 링크 빌드
    const hostDashboardUrl = reservation.hostToken
      ? `http://10.10.5.56:3000/host/dashboard?email=${encodeURIComponent(reservation.hostEmail)}&token=${reservation.hostToken}`
      : `http://10.10.5.56:3000/host/dashboard`;
    let qrAttachment = null;
    try {
      const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 250, margin: 2 });
      const base64Data = qrDataUrl.split("base64,")[1];
      qrAttachment = {
        filename: "qrcode.png",
        content: Buffer.from(base64Data, "base64"),
        cid: "qrcode",
      };
    } catch (qrErr) {
      console.error("QR Code 생성 중 오류 발생:", qrErr);
    }

    // --- A. 방문 신청자용 메일 템플릿 작성 ---
    const visitorHtml = `
      <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">방문 예약 접수 완료 안내</h2>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">네티젠 테크 방문 예약이 성공적으로 접수되었습니다.</p>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 20px 0; font-size: 15px;">안녕하세요, <strong>${reservation.visitorName}</strong>님.</p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">귀하께서 신청하신 방문 예약 상세 내역은 다음과 같습니다. 사내 담당 부서의 승인 프로세스 완료 후 최종 승인 메일이 발송됩니다.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="width: 100px; padding: 6px 0; color: #64748b; font-weight: bold;">예약 번호</td>
                <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-weight: bold;">${reservation.id}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">소속 회사</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.organization}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 목적</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.purpose}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 예정 일시</td>
                <td style="padding: 6px 0; color: #4f46e5; font-weight: bold;">${dateDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">담당자 (만나실 분)</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.hostName} ${reservation.hostDepartment ? `(${reservation.hostDepartment})` : ""}</td>
              </tr>
              ${
                reservation.companions && reservation.companions.length > 0
                  ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold; vertical-align: top;">동행자 명단</td>
                <td style="padding: 6px 0; color: #0f172a;">
                  ${reservation.companions.map((c) => `${c.name} (${c.organization})`).join(", ")}
                </td>
              </tr>
              `
                  : ""
              }
            </table>
          </div>

          <!-- 보안담당자 제시용 인라인 QR코드 영역 -->
          <div style="text-align: center; margin: 25px 0; padding: 20px; border: 1px dashed #cbd5e1; border-radius: 12px; background-color: #f8fafc;">
            <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #1e293b;">출입 보안 확인용 QR코드</p>
            <img src="cid:qrcode" alt="방문자 QR코드" style="width: 150px; height: 150px; display: inline-block; background-color: white; border: 1px solid #e2e8f0; padding: 5px; border-radius: 8px;" />
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748b;">네티젠 테크 도착 시 정문 보안담당자에게 제시해 주십시오.</p>
          </div>

          <div style="border-left: 4px solid #f59e0b; padding-left: 15px; margin-bottom: 25px;">
            <h4 style="margin: 0 0 6px 0; color: #b45309; font-size: 13px; font-weight: bold;">[방문 시 주의사항]</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #64748b;">
              <li>방문 시 신분증을 반드시 지참해 주시기 바랍니다.</li>
              <li>보안 서약 규정에 따라 회사 내에서 허가되지 않은 사진 촬영 및 기기 무단 연결 등은 금지됩니다.</li>
              <li>공장 내에서는 사내 안전 수칙을 준수해 주십시오.</li>
            </ul>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          본 메일은 발신전용 메일입니다. 문의 사항이 있으신 경우 사내 담당자에게 문의해 주십시오.<br />
          &copy; ${new Date().getFullYear()} ${smtpSetting.senderName}. All Rights Reserved.
        </div>
      </div>
    `;

    // --- B. 담당자(만나실 분)용 메일 템플릿 작성 ---
    const hostHtml = `
      <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #0f172a, #334155); padding: 30px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">새로운 외부 방문객 예약 알림</h2>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">신청인에 대한 방문 승인 여부를 검토해 주시기 바랍니다.</p>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 20px 0; font-size: 15px;">안녕하세요, <strong>${reservation.hostName}</strong> 님.</p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">귀하를 만나실 분으로 지정하여 외부 방문객 신청서가 다음과 같이 접수되었습니다. 세부사항을 확인하시어 승인 처리를 부탁드립니다.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="width: 100px; padding: 6px 0; color: #64748b; font-weight: bold;">방문 신청인</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${reservation.visitorName} (${reservation.organization})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">연락처 / 이메일</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.phoneNumber} / ${reservation.visitorEmail}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 목적</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.purpose}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 예정 일시</td>
                <td style="padding: 6px 0; color: #4f46e5; font-weight: bold;">${dateDisplay}</td>
              </tr>
              ${
                reservation.companions && reservation.companions.length > 0
                  ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold; vertical-align: top;">동행자 명단</td>
                <td style="padding: 6px 0; color: #0f172a;">
                  ${reservation.companions.map((c) => `${c.name} (${c.organization})`).join(", ")}
                </td>
              </tr>
              `
                  : ""
              }
            </table>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${hostDashboardUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
              관리자 콘솔로 이동하여 승인 검토
            </a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          본 메일은 방문자 예약 시스템에 의해 자동 발송되었습니다.<br />
          &copy; ${new Date().getFullYear()} ${smtpSetting.senderName}. All Rights Reserved.
        </div>
      </div>
    `;

    // 3. 이메일 전송 정보 구성
    // A. 방문 신청자에게 전송
    const visitorMailOptions: any = {
      from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
      to: reservation.visitorEmail,
      subject: `[방문 접수 완료] ${reservation.visitorName}님의 방문 신청 예약 상세 안내`,
      html: visitorHtml,
    };
    if (qrAttachment) {
      visitorMailOptions.attachments = [qrAttachment];
    }
    await transporter.sendMail(visitorMailOptions);

    // A-2. 동행자들에게도 동일하게 접수 완료 알림 메일 발송
    if (reservation.companions && reservation.companions.length > 0) {
      for (const companion of reservation.companions) {
        if (companion.email) {
          const companionHtml = visitorHtml
            .replace(`안녕하세요, <strong>${reservation.visitorName}</strong>님.`, `안녕하세요, <strong>${companion.name}</strong>님.`)
            .replace(`귀하께서 신청하신`, `귀하가 동행자로 지정된`);
          
          const companionMailOptions: any = {
            from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
            to: companion.email,
            subject: `[방문 접수 완료] 네티젠 테크 방문 예약 안내 (${reservation.visitorName}님 동행)`,
            html: companionHtml,
          };
          if (qrAttachment) {
            companionMailOptions.attachments = [qrAttachment];
          }
          await transporter.sendMail(companionMailOptions).catch(err => {
            console.error(`[Companion Email Error] Failed to send to ${companion.email}:`, err);
          });
        }
      }
    }

    // B. 만나실 담당자에게 알림 전송
    await transporter.sendMail({
      from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
      to: reservation.hostEmail,
      subject: `[방문 예약 승인 요청] ${reservation.visitorName}님의 방문 신청이 도착하였습니다.`,
      html: hostHtml,
    });

    console.log(`[Email Service Success] Visit notification emails sent successfully for Reservation: ${reservation.id}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Email Service Error] Failed to send email for reservation: ${reservation.id}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * 방문 예약 취소 알림 메일을 발송합니다.
 */
export async function sendCancellationNotification(reservation: ReservationData) {
  try {
    // 1. DB에서 SMTP 설정 가져오기
    let smtpSetting = await prisma.smtpSetting.findUnique({
      where: { id: "singleton" },
    });

    if (!smtpSetting) {
      // DB에 설정이 미등록된 경우 src/smtp.md 설정값으로 항시 자동 폴백(기본값 유지)
      smtpSetting = {
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

    // 2. Transporter 설정
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

    const formattedStartDate = new Date(reservation.visitDateTime).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const formattedEndDate = reservation.visitEndDateTime
      ? new Date(reservation.visitEndDateTime).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    const dateDisplay = formattedEndDate
      ? `${formattedStartDate} ~ ${formattedEndDate}`
      : formattedStartDate;

    // --- A. 방문 신청자용 취소 안내 메일 HTML ---
    const visitorHtml = `
      <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #ef4444, #f43f5e); padding: 30px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">방문 예약 취소 안내</h2>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">신청하신 방문 예약이 정상적으로 취소 처리되었습니다.</p>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 20px 0; font-size: 15px;">안녕하세요, <strong>${reservation.visitorName}</strong>님.</p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">귀하께서 신청하신 아래 방문 예약 건이 성공적으로 취소 완료되었습니다. 본 예약번호와 보안용 QR코드는 더 이상 유효하지 않습니다.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="width: 100px; padding: 6px 0; color: #64748b; font-weight: bold;">예약 번호</td>
                <td style="padding: 6px 0; color: #ef4444; font-family: monospace; font-weight: bold; text-decoration: line-through;">${reservation.id}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">소속 회사</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.organization}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 목적</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.purpose}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 예정 일시</td>
                <td style="padding: 6px 0; color: #0f172a;">${dateDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">담당자 (만나실 분)</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.hostName} ${reservation.hostDepartment ? `(${reservation.hostDepartment})` : ""}</td>
              </tr>
            </table>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          본 메일은 발신전용 메일입니다. 문의 사항이 있으신 경우 사내 담당자에게 문의해 주십시오.<br />
          &copy; ${new Date().getFullYear()} ${smtpSetting.senderName}. All Rights Reserved.
        </div>
      </div>
    `;

    // --- B. 담당자(호스트)용 취소 알림 메일 HTML ---
    const hostHtml = `
      <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #1e293b, #475569); padding: 30px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">[방문 취소] 예약 취소 알림</h2>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">신청된 방문 예약 건이 취소되었습니다.</p>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 20px 0; font-size: 15px;">안녕하세요, <strong>${reservation.hostName}</strong> 님.</p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">귀하를 호스트로 지정하였던 아래 외부인 방문 신청 건이 **신청자에 의해 취소**되었습니다. 업무 및 출입 통제 계획에 참고하시기 바랍니다.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="width: 100px; padding: 6px 0; color: #64748b; font-weight: bold;">방문 신청인</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${reservation.visitorName} (${reservation.organization})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 예정 일시</td>
                <td style="padding: 6px 0; color: #0f172a;">${dateDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 목적</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.purpose}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">예약 번호</td>
                <td style="padding: 6px 0; color: #0f172a; font-family: monospace;">${reservation.id}</td>
              </tr>
            </table>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          본 메일은 방문자 예약 시스템에 의해 자동 발송되었습니다.<br />
          &copy; ${new Date().getFullYear()} ${smtpSetting.senderName}. All Rights Reserved.
        </div>
      </div>
    `;

    // 3. 이메일 전송
    // A. 방문객 전송
    await transporter.sendMail({
      from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
      to: reservation.visitorEmail,
      subject: `[방문 취소 안내] ${reservation.visitorName}님의 방문 신청 예약이 취소되었습니다.`,
      html: visitorHtml,
    });

    // A-2. 동행자들에게도 동일하게 취소 알림 메일 발송
    if (reservation.companions && reservation.companions.length > 0) {
      for (const companion of reservation.companions) {
        if (companion.email) {
          const companionCancelHtml = visitorHtml
            .replace(`안녕하세요, <strong>${reservation.visitorName}</strong>님.`, `안녕하세요, <strong>${companion.name}</strong>님.`)
            .replace(`귀하께서 신청하신`, `귀하가 동행자로 지정되었던`);
          
          await transporter.sendMail({
            from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
            to: companion.email,
            subject: `[방문 취소 안내] 네티젠 테크 방문 예약이 취소되었습니다. (${reservation.visitorName}님 동행)`,
            html: companionCancelHtml,
          }).catch(err => {
            console.error(`[Companion Cancel Email Error] Failed to send to ${companion.email}:`, err);
          });
        }
      }
    }

    // B. 담당자 전송
    await transporter.sendMail({
      from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
      to: reservation.hostEmail,
      subject: `[방문 취소 알림] ${reservation.visitorName}님의 방문 예약이 취소되었습니다.`,
      html: hostHtml,
    });

    console.log(`[Email Service Success] Cancellation notification sent successfully for Reservation: ${reservation.id}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Email Service Error] Failed to send cancellation email for Reservation: ${reservation.id}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * 사내 호스트 로그인 매직링크 메일을 전송합니다.
 */
export async function sendHostLoginEmail(email: string, token: string) {
  try {
    let smtpSetting = await prisma.smtpSetting.findUnique({
      where: { id: "singleton" },
    });

    if (!smtpSetting) {
      smtpSetting = {
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

    const loginUrl = `http://10.10.5.56:3000/host/dashboard?email=${encodeURIComponent(email)}&token=${token}`;

    const html = `
      <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">사내 호스트 대시보드 로그인</h2>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">요청하신 대시보드 보안 로그인 링크입니다.</p>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 20px 0; font-size: 15px;">안녕하세요.</p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">귀하의 호스트 계정으로 가입된 방문 예약 내역 승인 및 대시보드 관리를 위한 보안 로그인 링크가 발급되었습니다. 아래 버튼을 클릭하시면 즉시 로그인 상태로 대시보드에 진입합니다.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
              호스트 대시보드 로그인하기
            </a>
          </div>
          <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">본 로그인 링크는 24시간 동안 1회에 한해 유효합니다.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          본 메일은 방문자 예약 시스템에 의해 자동 발송되었습니다.<br />
          &copy; ${new Date().getFullYear()} ${smtpSetting.senderName}. All Rights Reserved.
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
      to: email,
      subject: `[보안인증] 네티젠 테크 방문예약 호스트 로그인 링크`,
      html: html,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[Host Login Link Error] Failed to send email:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 사내 보안협력사(경비원) 로그인 매직링크 메일을 전송합니다.
 */
export async function sendSecurityLoginEmail(email: string, token: string) {
  try {
    let smtpSetting = await prisma.smtpSetting.findUnique({
      where: { id: "singleton" },
    });

    if (!smtpSetting) {
      smtpSetting = {
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

    const loginUrl = `http://10.10.5.56:3000/admin/dashboard?email=${encodeURIComponent(email)}&token=${token}`;

    const html = `
      <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); padding: 30px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">정문 경비실 전산 로그인</h2>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">요청하신 보안협력사 로그인 링크입니다.</p>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 20px 0; font-size: 15px;">안녕하세요, 보안협력사 담당자님.</p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">귀하의 정문 출입 현황판 모니터링 및 체크인/아웃 관리를 위한 보안 로그인 링크가 발급되었습니다. 아래 버튼을 클릭하시면 즉시 대시보드에 진입합니다.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="display: inline-block; background-color: #312e81; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(49, 46, 129, 0.2);">
              경비실 대시보드 로그인하기
            </a>
          </div>
          <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">본 로그인 링크는 24시간 동안 1회에 한해 유효합니다.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          본 메일은 방문자 예약 시스템에 의해 자동 발송되었습니다.<br />
          &copy; ${new Date().getFullYear()} ${smtpSetting.senderName}. All Rights Reserved.
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
      to: email,
      subject: `[보안인증] 네티젠 테크 경비실 출입콘솔 로그인 링크`,
      html: html,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[Security Login Link Error] Failed to send email:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 방문객 차량의 정문 통과(입차) 소식을 담당 호스트 임직원에게 알리는 메일을 전송합니다.
 */
export async function sendVehicleArrivalEmail(reservation: any) {
  try {
    let smtpSetting = await prisma.smtpSetting.findUnique({
      where: { id: "singleton" },
    });

    if (!smtpSetting) {
      smtpSetting = {
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

    const html = `
      <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 30px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">🚗 방문객 차량 정문 통과 알림</h2>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">신청된 방문객 차량이 정문을 통과하여 입차하였습니다.</p>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 20px 0; font-size: 15px; font-weight: bold; color: #0f172a;">안녕하세요, ${reservation.hostName} 님.</p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">귀하가 담당하시는 방문 예정자 <strong>${reservation.visitorName}</strong> 님의 차량이 정문 번호판 인식기(LPR)에 감지되어 정상 입차하였습니다. 원활한 미팅 준비를 진행해 주시기 바랍니다.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">방문 및 차량 상세 정보</h4>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 100px;">방문자명</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${reservation.visitorName} (${reservation.organization})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">차량 번호</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${reservation.carNumber}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">방문 목적</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.purpose}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">통과 일시</td>
                <td style="padding: 6px 0; color: #0f172a;">${new Date().toLocaleString("ko-KR")}</td>
              </tr>
            </table>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          본 메일은 방문자 예약 시스템에 의해 자동 발송되었습니다.<br />
          &copy; ${new Date().getFullYear()} ${smtpSetting.senderName}. All Rights Reserved.
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
      to: reservation.hostEmail,
      subject: `[차량 입차] 네티젠 테크 담당 방문객 차량 정문 통과 알림 (${reservation.visitorName} 님)`,
      html: html,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[Vehicle Arrival Email Error] Failed to send email:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 방문 예약 최종 승인 완료 알림 메일을 발송합니다.
 * 신청자(방문객) 및 승인담당자(호스트)에게 각각 개별 발송합니다.
 */
export async function sendApprovalNotification(reservation: ReservationData) {
  try {
    // 1. DB에서 SMTP 설정 가져오기
    let smtpSetting = await prisma.smtpSetting.findUnique({
      where: { id: "singleton" },
    });

    if (!smtpSetting) {
      smtpSetting = {
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

    // 2. Transporter 설정
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

    const formattedStartDate = new Date(reservation.visitDateTime).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const formattedEndDate = reservation.visitEndDateTime
      ? new Date(reservation.visitEndDateTime).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    const dateDisplay = formattedEndDate
      ? `${formattedStartDate} ~ ${formattedEndDate}`
      : formattedStartDate;

    // --- A. 방문 신청자용 최종 승인 안내 메일 HTML ---
    const visitorHtml = `
      <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">방문 예약 최종 승인 완료</h2>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">귀하께서 신청하신 방문 예약이 접견 담당자에 의해 최종 승인되었습니다.</p>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 20px 0; font-size: 15px;">안녕하세요, <strong>${reservation.visitorName}</strong>님.</p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">신청하신 네티젠 테크 방문 예약 건이 최종 승인 완료되어 아래와 같이 안내를 발송해 드립니다.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="width: 100px; padding: 6px 0; color: #64748b; font-weight: bold;">예약 번호</td>
                <td style="padding: 6px 0; color: #059669; font-family: monospace; font-weight: bold;">${reservation.id}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">소속 회사</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.organization}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 목적</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.purpose}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 예정 일시</td>
                <td style="padding: 6px 0; color: #4f46e5; font-weight: bold;">${dateDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">차량 번호</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${reservation.carNumber || "차량 없음 (도보)"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">접견 담당자</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.hostName} ${reservation.hostDepartment ? `(${reservation.hostDepartment})` : ""}</td>
              </tr>
            </table>
          </div>

          <div style="border-left: 4px solid #10b981; padding-left: 15px; margin-bottom: 25px;">
            <h4 style="margin: 0 0 6px 0; color: #065f46; font-size: 13px; font-weight: bold;">[방문 협조 사항]</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #64748b;">
              <li>신청하신 예약 차량은 정문 출입 통과 시 LPR 카메라를 통해 자동 인식되어 입차 처리됩니다.</li>
              <li>신분증을 지참하시고 정문 경비실에 방문 목적을 말씀하신 뒤 출입증을 교부 받으시기 바랍니다.</li>
              <li>공장 내부에서는 승인되지 않은 촬영 및 출입 통제 구역 접근이 엄격히 금지됩니다.</li>
            </ul>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          본 메일은 발신전용 메일입니다. 문의 사항이 있으신 경우 접견 담당자에게 연락하여 주십시오.<br />
          &copy; ${new Date().getFullYear()} ${smtpSetting.senderName}. All Rights Reserved.
        </div>
      </div>
    `;

    // --- B. 승인 담당자(호스트)용 승인 통보 메일 HTML ---
    const hostHtml = `
      <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #1f2937, #111827); padding: 30px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">방문 예약 최종 승인 완료</h2>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">요청된 외부 방문객 예약을 성공적으로 승인 완료하였습니다.</p>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 20px 0; font-size: 15px;">안녕하세요, <strong>${reservation.hostName}</strong> 님.</p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">귀하가 승인하신 아래의 방문 예약 건에 대하여 예약 최종 승인 통보 메일이 발송되었습니다. 내방 일정을 확인하시어 접객 준비를 부탁드립니다.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="width: 100px; padding: 6px 0; color: #64748b; font-weight: bold;">방문 신청자</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${reservation.visitorName} (${reservation.organization})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">연락처 / 이메일</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.phoneNumber} / ${reservation.visitorEmail}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 예정 일시</td>
                <td style="padding: 6px 0; color: #4f46e5; font-weight: bold;">${dateDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">차량 번호</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${reservation.carNumber || "차량 없음 (도보)"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">방문 목적</td>
                <td style="padding: 6px 0; color: #0f172a;">${reservation.purpose}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">예약 번호</td>
                <td style="padding: 6px 0; color: #0f172a; font-family: monospace;">${reservation.id}</td>
              </tr>
            </table>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          본 메일은 방문자 예약 시스템에 의해 자동 발송되었습니다.<br />
          &copy; ${new Date().getFullYear()} ${smtpSetting.senderName}. All Rights Reserved.
        </div>
      </div>
    `;

    // 3. 이메일 전송
    // A. 방문객 전송
    await transporter.sendMail({
      from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
      to: reservation.visitorEmail,
      subject: `[최종 승인 완료] ${reservation.visitorName}님의 방문 신청 승인 안내`,
      html: visitorHtml,
    });

    // A-2. 동행자들에게도 동일하게 최종 승인 알림 메일 발송
    if (reservation.companions && reservation.companions.length > 0) {
      for (const companion of reservation.companions) {
        if (companion.email) {
          const companionApprovalHtml = visitorHtml
            .replace(`안녕하세요, <strong>${reservation.visitorName}</strong>님.`, `안녕하세요, <strong>${companion.name}</strong>님.`)
            .replace(`신청하신 네티젠 테크`, `귀하가 동행자로 등록된 네티젠 테크`);
          
          await transporter.sendMail({
            from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
            to: companion.email,
            subject: `[최종 승인 완료] 네티젠 테크 방문 신청 승인 안내 (${reservation.visitorName}님 동행)`,
            html: companionApprovalHtml,
          }).catch(err => {
            console.error(`[Companion Approval Email Error] Failed to send to ${companion.email}:`, err);
          });
        }
      }
    }

    // B. 담당자 전송
    await transporter.sendMail({
      from: `"${smtpSetting.senderName}" <${smtpSetting.senderEmail}>`,
      to: reservation.hostEmail,
      subject: `[최종 승인 알림] ${reservation.visitorName}님의 방문 신청 건이 승인 처리되었습니다.`,
      html: hostHtml,
    });

    console.log(`[Email Service Success] Approval notification sent successfully for Reservation: ${reservation.id}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Email Service Error] Failed to send approval email for Reservation: ${reservation.id}`, error);
    return { success: false, error: error.message };
  }
}
