import fs from "fs";
import path from "path";
import RequestWizard from "./RequestWizard";

export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const infoDir = path.join(process.cwd(), "info");

  const readMarkdownFile = (filename: string): string => {
    try {
      const filePath = path.join(infoDir, filename);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf-8");
      }
      return "";
    } catch (error) {
      console.error(`[Error] Failed to read ${filename}:`, error);
      return "";
    }
  };

  // 5대 필수 동의서 파일 동적 로드
  const terms = readMarkdownFile("방문신청약관.md");
  const privacy = readMarkdownFile("개인정보처리방침.md");
  const safety = readMarkdownFile("안전수칙준수방침.md");
  const secret = readMarkdownFile("방문객 영업비밀 보호 서약서.md");
  const security = readMarkdownFile("정보보안 서약서.md");

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <RequestWizard
          termsContent={terms}
          privacyContent={privacy}
          safetyContent={safety}
          secretContent={secret}
          securityContent={security}
        />
      </div>
    </div>
  );
}
