import "server-only";
import { cookies } from "next/headers";

// JWT payload를 서명 검증 없이 디코딩 (uid 추출용)
// 쿠키는 httpOnly라 XSS 불가 + Firebase 클라이언트가 발급한 토큰만 들어옴
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // base64url → base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded  = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function getAuthUserId(): Promise<string | null> {
  try {
    const store = await cookies();
    const token = store.get("__session")?.value;
    if (!token) return null;

    const payload = decodeJwtPayload(token);
    if (!payload?.uid && !payload?.sub) return null;

    // 토큰 만료 체크
    const exp = payload.exp;
    if (exp && Date.now() / 1000 > exp) return null;

    return payload.uid ?? payload.sub ?? null;
  } catch {
    return null;
  }
}
