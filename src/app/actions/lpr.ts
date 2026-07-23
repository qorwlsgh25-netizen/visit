"use server";

import prisma from "@/lib/prisma";
import { verifySecuritySession } from "@/lib/auth";


/**
 * 등록된 임직원 차량 목록을 가져옵니다.
 */
export async function getEmployeeVehicles() {
  try {
    await verifySecuritySession();
    const list = await prisma.employeeVehicle.findMany({
      orderBy: { employeeName: "asc" }
    });
    return { success: true, data: list };
  } catch (err: any) {
    console.error("임직원 차량 조회 오류:", err);
    return { success: false, error: err.message || "조회 중 오류 발생" };
  }
}

/**
 * 신규 임직원 차량을 등록합니다.
 */
export async function addEmployeeVehicle(
  employeeName: string, 
  phoneNumber: string, 
  department: string, 
  carNumber: string
) {
  if (!employeeName || !phoneNumber || !department || !carNumber) {
    return { success: false, error: "모든 항목을 올바르게 기입해 주십시오." };
  }

  const cleanCarNumber = carNumber.replace(/\s+/g, "").trim();

  try {
    await verifySecuritySession();
    // 중복 전화번호 체크
    const dupEmp = await prisma.employeeVehicle.findUnique({
      where: { phoneNumber: phoneNumber.trim() }
    });
    if (dupEmp) {
      return { success: false, error: `이미 등록된 전화번호(${phoneNumber})입니다.` };
    }

    // 중복 차량 번호 체크
    const dupCar = await prisma.employeeVehicle.findUnique({
      where: { carNumber: cleanCarNumber }
    });
    if (dupCar) {
      return { success: false, error: `이미 등록된 차량번호(${carNumber})입니다.` };
    }

    const created = await prisma.employeeVehicle.create({
      data: {
        employeeName: employeeName.trim(),
        phoneNumber: phoneNumber.trim(),
        department: department.trim(),
        carNumber: cleanCarNumber
      }
    });

    return { success: true, data: created };
  } catch (err: any) {
    console.error("임직원 차량 등록 오류:", err);
    return { success: false, error: err.message || "등록 중 오류 발생" };
  }
}

/**
 * 등록된 임직원 차량을 삭제합니다.
 */
export async function deleteEmployeeVehicle(id: string) {
  try {
    await verifySecuritySession();
    await prisma.employeeVehicle.delete({
      where: { id }
    });
    return { success: true };
  } catch (err: any) {
    console.error("임직원 차량 삭제 오류:", err);
    return { success: false, error: err.message || "삭제 중 오류 발생" };
  }
}

/**
 * 5부제 위반 단속 기록 목록을 가져옵니다.
 */
export async function getRotationViolations() {
  try {
    await verifySecuritySession();
    const list = await prisma.rotationViolation.findMany({
      orderBy: { violatedAt: "desc" }
    });
    return { success: true, data: list };
  } catch (err: any) {
    console.error("5부제 위반 목록 조회 오류:", err);
    return { success: false, error: err.message || "조회 중 오류 발생" };
  }
}

/**
 * 5부제 위반 단속 기록을 삭제합니다.
 */
export async function deleteRotationViolation(id: string) {
  try {
    await verifySecuritySession();
    await prisma.rotationViolation.delete({
      where: { id }
    });
    return { success: true };
  } catch (err: any) {
    console.error("단속 기록 삭제 오류:", err);
    return { success: false, error: err.message || "삭제 중 오류 발생" };
  }
}

/**
 * 임직원 차량 정보를 수정합니다.
 */
export async function updateEmployeeVehicle(
  id: string,
  employeeName: string,
  phoneNumber: string,
  department: string,
  carNumber: string
) {
  if (!id || !employeeName || !phoneNumber || !department || !carNumber) {
    return { success: false, error: "모든 항목을 올바르게 기입해 주십시오." };
  }

  const cleanCarNumber = carNumber.replace(/\s+/g, "").trim();

  try {
    await verifySecuritySession();
    // 중복 전화번호 체크 (본인 제외)
    const dupEmp = await prisma.employeeVehicle.findFirst({
      where: {
        phoneNumber: phoneNumber.trim(),
        NOT: { id }
      }
    });
    if (dupEmp) {
      return { success: false, error: `이미 등록된 전화번호(${phoneNumber})입니다.` };
    }

    // 중복 차량번호 체크 (본인 제외)
    const dupCar = await prisma.employeeVehicle.findFirst({
      where: {
        carNumber: cleanCarNumber,
        NOT: { id }
      }
    });
    if (dupCar) {
      return { success: false, error: `이미 등록된 차량번호(${carNumber})입니다.` };
    }

    const updated = await prisma.employeeVehicle.update({
      where: { id },
      data: {
        employeeName: employeeName.trim(),
        phoneNumber: phoneNumber.trim(),
        department: department.trim(),
        carNumber: cleanCarNumber
      }
    });

    return { success: true, data: updated };
  } catch (err: any) {
    console.error("임직원 차량 수정 오류:", err);
    return { success: false, error: err.message || "수정 중 오류 발생" };
  }
}

