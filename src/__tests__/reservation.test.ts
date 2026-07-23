import { createReservation, getReservation, updateReservationStatus } from "../app/actions/reservation";
import prisma from "../lib/prisma";
import * as authModule from "../lib/auth";

// Prisma 및 auth 모듈 모킹
jest.mock("../lib/prisma", () => ({
  reservation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  securityToken: {
    create: jest.fn(),
  }
}));

jest.mock("../lib/auth", () => ({
  getSessionEmail: jest.fn(),
  verifySecuritySession: jest.fn(),
  verifyHostSession: jest.fn(),
}));

jest.mock("../lib/email", () => ({
  sendVisitNotification: jest.fn().mockResolvedValue({ success: true }),
  sendApprovalNotification: jest.fn().mockResolvedValue({ success: true }),
}));

describe("방문 예약 시스템 Server Actions 단위 테스트", () => {
  const mockReservationData = {
    id: "test-uuid-1234",
    visitorName: "홍길동",
    visitorEmail: "hong@example.com",
    birthDate: "900101",
    phoneNumber: "010-1234-5678",
    organization: "루자테크",
    carNumber: "12가3456",
    carType: "소나타",
    purpose: "업무 미팅",
    visitDateTime: new Date("2026-07-07T10:00:00.000Z"),
    status: "PENDING",
    hostName: "김담당",
    hostPhone: "010-9999-8888",
    hostEmail: "host@example.com",
    termsAgreed: true,
    privacyAgreed: true,
    securityAgreed: true,
    secretAgreed: true,
    safetyAgreed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createReservation - 필수 약관 동의 및 데이터 유효 시 정상 등록되어야 한다.", async () => {
    const input = {
      visitorName: "홍길동",
      visitorEmail: "hong@example.com",
      birthDate: "900101",
      phoneNumber: "010-1234-5678",
      organization: "루자테크",
      carNumber: "12가3456",
      carType: "소나타",
      purpose: "업무 미팅",
      visitDateTime: "2026-07-07T10:00:00.000Z",
      hostName: "김담당",
      hostPhone: "010-9999-8888",
      hostEmail: "host@example.com",
      termsAgreed: true,
      privacyAgreed: true,
      securityAgreed: true,
      secretAgreed: true,
      safetyAgreed: true,
    };

    const prismaCreateMock = prisma.reservation.create as jest.Mock;
    prismaCreateMock.mockResolvedValue(mockReservationData);

    const result = await createReservation(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockReservationData);
  });

  test("createReservation - 약관 중 하나라도 동의하지 않으면 에러를 던져야 한다.", async () => {
    const input = {
      visitorName: "홍길동",
      visitorEmail: "hong@example.com",
      birthDate: "900101",
      phoneNumber: "010-1234-5678",
      organization: "루자테크",
      purpose: "업무 미팅",
      visitDateTime: "2026-07-07T10:00:00.000Z",
      hostName: "김담당",
      hostPhone: "010-9999-8888",
      hostEmail: "host@example.com",
      termsAgreed: true,
      privacyAgreed: false, // 필수 약관 미동의
      securityAgreed: true,
      secretAgreed: true,
      safetyAgreed: true,
    };

    await expect(createReservation(input)).rejects.toThrow(
      "모든 필수 약관 및 서약서에 동의하셔야 신청이 가능합니다."
    );
  });

  test("getReservation - ID, 생년월일, 연락처 매칭 시 정보를 반환해야 한다.", async () => {
    const prismaFindUniqueMock = prisma.reservation.findUnique as jest.Mock;
    prismaFindUniqueMock.mockResolvedValue(mockReservationData);

    const result = await getReservation("test-uuid-1234", "900101", "010-1234-5678");

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockReservationData);
  });

  test("getReservation - 생년월일 또는 연락처가 불일치 시 에러 메시지를 반환해야 한다.", async () => {
    const prismaFindUniqueMock = prisma.reservation.findUnique as jest.Mock;
    prismaFindUniqueMock.mockResolvedValue(mockReservationData);

    const result = await getReservation("test-uuid-1234", "999999", "010-1234-5678");

    expect(result.success).toBe(false);
    expect(result.error).toBe("입력된 정보가 예약자 정보와 일치하지 않습니다.");
  });

  test("updateReservationStatus - 관리자 승인 시 상태가 정상 변경되어야 한다.", async () => {
    const updatedData = { ...mockReservationData, status: "APPROVED", hostEmail: "host@example.com" };
    const prismaFindUniqueMock = prisma.reservation.findUnique as jest.Mock;
    const prismaUpdateMock = prisma.reservation.update as jest.Mock;
    prismaFindUniqueMock.mockResolvedValue(updatedData);
    prismaUpdateMock.mockResolvedValue(updatedData);

    (authModule.getSessionEmail as jest.Mock).mockResolvedValue("host@example.com");
    (authModule.verifySecuritySession as jest.Mock).mockResolvedValue("host@example.com");

    const result = await updateReservationStatus("test-uuid-1234", "APPROVED");

    expect(result.success).toBe(true);
    expect(result.data.status).toBe("APPROVED");
  });
});
