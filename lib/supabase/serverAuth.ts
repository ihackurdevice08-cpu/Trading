import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * 공통 유틸: cookie 기반 Supabase 클라이언트 (인증용)
 * 모든 API route에서 sbFromCookies() 대신 이것을 사용
 */
export async function createAuthClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return store.getAll(); },
        setAll(cs) { cs.forEach(({ name, value, options }) => store.set(name, value, options)); },
      },
    }
  );
}

/**
 * 현재 로그인한 유저 ID를 반환. 없으면 null.
 */
export async function getAuthUserId(): Promise<string | null> {
  const sb = await createAuthClient();
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}
