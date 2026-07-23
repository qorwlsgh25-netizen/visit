import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendVehicleArrivalEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-lpr-api-key");
    const validKey = process.env.LPR_API_SECRET || "lpr-secure-device-key-default";

    if (!apiKey || apiKey !== validKey) {
      return NextResponse.json({ success: false, error: "인증되지 않은 LPR 카메라인식 단말기 요청입니다." }, { status: 401 });
    }

    const body = await request.json();
    const { carNumber, image } = body;

    if (!carNumber) {
      return NextResponse.json({ success: false, error: "차량번호가 누락되었습니다." }, { status: 400 });
    }

    const cleanCarNumber = carNumber.replace(/\s+/g, "").trim();
    const now = new Date();

    // 1단계: 사전 등록 승인된 방문객 차량 검지
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const visitorReservation = await prisma.reservation.findFirst({
      where: {
        carNumber: cleanCarNumber,
        status: "APPROVED",
        OR: [
          {
            visitDateTime: { gte: todayStart, lte: todayEnd }
          },
          {
            visitDateTime: { lte: todayEnd },
            visitEndDateTime: { gte: todayStart }
          }
        ]
      }
    });

    if (visitorReservation) {
      // 방문객 감지 이벤트 로깅
      await prisma.lprEvent.create({
        data: {
          carNumber: cleanCarNumber,
          eventType: "VISITOR",
          message: "예약된 방문객 차량이 확인 되었습니다",
          visitorName: visitorReservation.visitorName,
          hostName: visitorReservation.hostName,
          imageUrl: image || null
        }
      });

      // 호스트에게 차량 정문 입차 알림 이메일 발송
      try {
        await sendVehicleArrivalEmail(visitorReservation);
      } catch (mailErr) {
        console.error("차량 입차 안내 메일 발송 중 오류:", mailErr);
      }

      return NextResponse.json({
        success: true,
        type: "visitor",
        message: "예약 방문자 입차 승인 완료 및 이메일 발송 완료",
        data: visitorReservation
      });
    }

    // 2단계: 임직원 차량 조회 및 5부제 단속 필터링
    const employeeVehicle = await prisma.employeeVehicle.findUnique({
      where: { carNumber: cleanCarNumber }
    });

    if (employeeVehicle) {
      const dayOfWeek = now.getDay(); // 0: 일요일, 1: 월요일, ..., 5: 금요일, 6: 토요일
      
      // 번호판 가장 우측 숫자 추출
      const matchDigits = cleanCarNumber.match(/\d/g);
      const lastDigit = matchDigits ? Number(matchDigits[matchDigits.length - 1]) : null;

      let isViolated = false;
      if (lastDigit !== null && dayOfWeek >= 1 && dayOfWeek <= 5) {
        if (dayOfWeek === 1 && (lastDigit === 1 || lastDigit === 6)) isViolated = true; // 월 1, 6
        if (dayOfWeek === 2 && (lastDigit === 2 || lastDigit === 7)) isViolated = true; // 화 2, 7
        if (dayOfWeek === 3 && (lastDigit === 3 || lastDigit === 8)) isViolated = true; // 수 3, 8
        if (dayOfWeek === 4 && (lastDigit === 4 || lastDigit === 9)) isViolated = true; // 목 4, 9
        if (dayOfWeek === 5 && (lastDigit === 5 || lastDigit === 0)) isViolated = true; // 금 5, 0
      }

      if (isViolated) {
        const violationImage = image || "/images/no_car_image.png";

        // 5부제 위반 단속 데이터 저장
        const violation = await prisma.rotationViolation.create({
          data: {
            carNumber: cleanCarNumber,
            employeeName: employeeVehicle.employeeName,
            department: employeeVehicle.department,
            imageUrl: violationImage
          }
        });

        // 대시보드 알림 발송용 LprEvent 생성
        await prisma.lprEvent.create({
          data: {
            carNumber: cleanCarNumber,
            eventType: "VIOLATION",
            message: "5부제 위반 차량이 감지되었습니다",
            employeeName: employeeVehicle.employeeName,
            department: employeeVehicle.department,
            imageUrl: violationImage
          }
        });

        return NextResponse.json({
          success: true,
          type: "violation",
          message: "5부제 위반 차량 검지 및 단속 완료",
          data: violation
        });
      }

      return NextResponse.json({
        success: true,
        type: "employee_ok",
        message: "임직원 차량 확인 (5부제 준수 상태)"
      });
    }

    // 3단계: 미등록 외부 차량
    return NextResponse.json({
      success: true,
      type: "unknown",
      message: "미등록 일반 외부 차량 진입"
    });

  } catch (err: any) {
    console.error("LPR scan API 처리 오류:", err);
    return NextResponse.json({ success: false, error: err.message || "서버 API 처리 실패" }, { status: 500 });
  }
}
