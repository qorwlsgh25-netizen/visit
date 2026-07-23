"use server";

import prisma from "@/lib/prisma";
import { getSessionEmail } from "@/lib/auth";
import { validateSecurityToken } from "./smtp";
import { getHardwareId, verifyLicenseKey } from "@/lib/license";

export interface BrandConfigInput {
  companyName: string;
  locationName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  copyrightText: string;
  licenseKey?: string | null;
}

const DEFAULT_BRAND_CONFIG = {
  id: "singleton",
  companyName: "네티젠 테크",
  locationName: "본사",
  logoUrl: null,
  faviconUrl: null,
  copyrightText: "© 2026 Netizen Tech. All Rights Reserved.",
  licenseKey: null,
};

/**
 * 현재 브랜드 설정 정보를 가져옵니다. (비로그인 방문객 공개 가능)
 */
export async function getBrandConfig() {
  try {
    let brand = await prisma.brandConfig.findUnique({
      where: { id: "singleton" },
    });

    if (!brand) {
      brand = await prisma.brandConfig.create({
        data: DEFAULT_BRAND_CONFIG,
      });
    }

    const hardwareId = getHardwareId();
    const isLicenseValid = verifyLicenseKey(hardwareId, brand.licenseKey);

    return {
      success: true,
      data: brand,
      hardwareId,
      isLicenseValid,
    };
  } catch (error: any) {
    console.error("브랜드 설정 조회 오류:", error);
    const hardwareId = getHardwareId();
    return {
      success: true,
      data: DEFAULT_BRAND_CONFIG,
      hardwareId,
      isLicenseValid: false,
    };
  }
}

/**
 * 보안 토큰을 이용하여 관리자용 브랜드 설정을 불러옵니다.
 */
export async function getBrandConfigForAdmin(token?: string) {
  try {
    if (token) {
      const val = await validateSecurityToken(token);
      if (!val.success) {
        throw new Error("유효하지 않거나 만료된 보안 인증 토큰입니다.");
      }
    } else {
      const sessionEmail = await getSessionEmail();
      if (!sessionEmail) {
        throw new Error("권한이 없습니다. 최고 관리자 배포 인증이 필요합니다.");
      }
      const admin = await prisma.adminConfig.findUnique({ where: { id: "singleton" } });
      if (!admin || admin.adminEmail.toLowerCase().trim() !== sessionEmail.toLowerCase().trim()) {
        throw new Error("최고 관리자만 접근할 수 있습니다.");
      }
    }

    return await getBrandConfig();
  } catch (error: any) {
    return { success: false, error: error.message || "브랜드 설정을 불러오지 못했습니다." };
  }
}

/**
 * 브랜드 설정 정보를 업데이트합니다. (최고 관리자 전용)
 */
export async function updateBrandConfig(input: BrandConfigInput, token?: string) {
  try {
    if (token) {
      const val = await validateSecurityToken(token);
      if (!val.success) {
        return { success: false, error: "유효하지 않거나 만료된 보안 인증 토큰입니다." };
      }
    } else {
      const sessionEmail = await getSessionEmail();
      if (!sessionEmail) {
        return { success: false, error: "관리자 로그인이 필요합니다." };
      }

      const admin = await prisma.adminConfig.findUnique({
        where: { id: "singleton" },
      });

      if (!admin || admin.adminEmail.toLowerCase().trim() !== sessionEmail.toLowerCase().trim()) {
        return { success: false, error: "최고 관리자만 브랜드 설정을 변경할 수 있습니다." };
      }
    }

    const cleanLicenseKey = input.licenseKey ? input.licenseKey.trim().toUpperCase() : null;

    const updated = await prisma.brandConfig.upsert({
      where: { id: "singleton" },
      update: {
        companyName: input.companyName.trim(),
        locationName: input.locationName.trim(),
        logoUrl: input.logoUrl ?? null,
        faviconUrl: input.faviconUrl ?? null,
        copyrightText: input.copyrightText.trim(),
        licenseKey: cleanLicenseKey,
      },
      create: {
        id: "singleton",
        companyName: input.companyName.trim(),
        locationName: input.locationName.trim(),
        logoUrl: input.logoUrl ?? null,
        faviconUrl: input.faviconUrl ?? null,
        copyrightText: input.copyrightText.trim(),
        licenseKey: cleanLicenseKey,
      },
    });

    const hardwareId = getHardwareId();
    const isLicenseValid = verifyLicenseKey(hardwareId, updated.licenseKey);

    return {
      success: true,
      data: updated,
      hardwareId,
      isLicenseValid,
    };
  } catch (error: any) {
    console.error("브랜드 설정 업데이트 오류:", error);
    return { success: false, error: error.message || "브랜드 설정 저장 중 오류가 발생했습니다." };
  }
}
