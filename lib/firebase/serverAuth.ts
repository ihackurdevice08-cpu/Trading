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

export interface AuthInfo {
  uid: string;
  token: string;
}

// uid만 반환 (하위 호환)
export async function getAuthUserId(): Promise<string | null> {
  const info = await getAuthInfo();
  return info?.uid ?? null;
}

// uid + token 반환 (Firestore REST 인증용)
export async function getAuthInfo(): Promise<AuthInfo | null> {
  try {
    const store = await cookies();
    const token = store.get("__session")?.value;
    if (!token) return null;

    const payload = decodeJwtPayload(token);
    if (!payload) return null;

    const uid = payload.user_id ?? payload.uid ?? payload.sub ?? null;
    if (!uid) return null;

    return { uid: String(uid), token };
  } catch {
    return null;
  }
}
