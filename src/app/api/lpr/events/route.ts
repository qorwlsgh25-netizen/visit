import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifySecuritySession } from "@/lib/auth";

export async function GET() {
  try {
    await verifySecuritySession();

    // 1. 아직 대시보드에서 읽지 않은 이벤트 수집
    const events = await prisma.lprEvent.findMany({
      where: { read: false },
      orderBy: { createdAt: "asc" }
    });

    if (events.length > 0) {
      // 2. 수집된 이벤트들의 상태를 읽음(read: true)으로 업데이트
      const eventIds = events.map(e => e.id);
      await prisma.lprEvent.updateMany({
        where: { id: { in: eventIds } },
        data: { read: true }
      });
    }

    return NextResponse.json({ success: true, data: events });
  } catch (err: any) {
    console.error("LPR 실시간 이벤트 조회 오류:", err);
    return NextResponse.json({ success: false, error: err.message || "서버 API 통신 실패" }, { status: 500 });
  }
}
