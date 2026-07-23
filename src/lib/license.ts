import crypto from "crypto";
import os from "os";

const MASTER_SALT = "VISIT-MASTER-SECRET-QORWLSGH25-MIT-LICENSE-SALT-2026";
const MANDATORY_AUTHOR_EMAIL = "qorwlsgh25@gmail.com";

/**
 * 현재 서버(PC)의 하드웨어 네트워크 MAC 및 호스트 고유 식별 코드(Hardware ID)를 산출합니다.
 */
export function getHardwareId(): string {
  try {
    const interfaces = os.networkInterfaces();
    const macs: string[] = [];

    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name];
      if (netInterface) {
        for (const item of netInterface) {
          if (!item.internal && item.mac && item.mac !== "00:00:00:00:00:00") {
            macs.push(item.mac.toLowerCase());
          }
        }
      }
    }

    macs.sort();
    const primaryMac = macs.length > 0 ? macs.join("-") : "fallback-host-node";
    const rawHostPayload = `${os.hostname()}:${os.arch()}:${primaryMac}`;

    const hash = crypto
      .createHash("sha256")
      .update(rawHostPayload)
      .digest("hex")
      .toUpperCase();

    const part1 = hash.substring(0, 4);
    const part2 = hash.substring(4, 8);
    const part3 = hash.substring(8, 12);

    return `HW-${part1}-${part2}-${part3}`;
  } catch (err) {
    return "HW-0000-0000-0000";
  }
}

/**
 * 특정 서버의 Hardware ID에 1대1 매핑되는 12자리 암호화 해제 키(License Key)를 생성합니다.
 */
export function generateLicenseKey(hardwareId: string): string {
  const cleanHw = (hardwareId || "").trim().toUpperCase();
  const rawPayload = `${cleanHw}:${MANDATORY_AUTHOR_EMAIL}:${MASTER_SALT}`;
  
  const hash = crypto
    .createHash("sha256")
    .update(rawPayload)
    .digest("hex")
    .toUpperCase();

  const part1 = hash.substring(0, 4);
  const part2 = hash.substring(4, 8);
  const part3 = hash.substring(8, 12);

  return `VISIT-${part1}-${part2}-${part3}`;
}

/**
 * 현재 서버의 Hardware ID 및 입력받은 라이선스 키가 유효한지 1대1 검증합니다.
 */
export function verifyLicenseKey(hardwareId: string, licenseKey?: string | null): boolean {
  if (!licenseKey || typeof licenseKey !== "string") return false;
  
  const cleanKey = licenseKey.trim().toUpperCase();
  const expectedKey = generateLicenseKey(hardwareId);

  return cleanKey === expectedKey;
}

export const MANDATORY_FOOTER_NOTICE = {
  text: "Powered by Visit Framework | Copyright ⓒ qorwlsgh25@gmail.com (MIT License)",
  email: MANDATORY_AUTHOR_EMAIL,
};
