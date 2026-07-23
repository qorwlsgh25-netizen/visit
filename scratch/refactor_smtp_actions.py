import os

def refactor_smtp():
    path = r"e:\visit\src\app\actions\smtp.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add auth import
    auth_import = '\nimport { getSessionEmail } from "@/lib/auth";\n'
    if "getSessionEmail" not in content:
        content = content.replace('import prisma from "@/lib/prisma";', 'import prisma from "@/lib/prisma";' + auth_import)

    # 2. Refactor getSmtpSetting to accept token and check auth
    old_get_smtp = """export async function getSmtpSetting() {
  try {
    let setting = await prisma.smtpSetting.findUnique({
      where: { id: "singleton" },
    });"""
    new_get_smtp = """export async function getSmtpSetting(token?: string) {
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
    });"""
    content = content.replace(old_get_smtp, new_get_smtp)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Refactored smtp.ts with security checks")

refactor_smtp()
