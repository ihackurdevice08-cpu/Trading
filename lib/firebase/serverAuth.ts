import { cookies } from "next/headers";
import { adminAuth } from "./admin";

/**
 * API Route에서 현재 로그인 유저 ID 반환
 * 클라이언트가 요청 헤더 Authorization: Bearer <idToken> 으로 전달
 * 또는 쿠키 __session에 idToken 저장
 */
export async function getAuthUserId(): Promise<string | null> {
  try {
    const store = await cookies();
    const token = store.get("__session")?.value;
    if (!token) return null;
    const decoded = await adminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
