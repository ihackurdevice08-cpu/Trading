import "server-only";
import { cookies } from "next/headers";

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64  = parts[1].replace(/-/g, "+").replace(/_/g, "/");
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
    const token  = store.get("__session")?.value;
    if (!token) return null;

    const payload = decodeJwtPayload(token);
    if (!payload) return null;

    // Firebase ID 토큰의 uid는 user_id 또는 sub 필드에 있음
    const uid = payload.user_id ?? payload.uid ?? payload.sub ?? null;
    if (!uid) return null;

    // 만료 체크 제거: 쿠키가 7일이고 layout.tsx에서 매번 갱신하므로 불필요
    // 만료된 경우 Firebase 클라이언트가 새 토큰을 발급해서 쿠키를 업데이트함

    return String(uid);
  } catch {
    return null;
  }
}
