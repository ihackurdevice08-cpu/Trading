import { createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * 브라우저용 Supabase 클라이언트 (싱글톤)
 * - createBrowserClient를 써야 쿠키 기반 세션이 API route까지 전달됨
 * - createClient(anon)은 쿠키를 안 씀 → 서버에서 항상 unauthorized
 */
export function supabaseBrowser() {
  if (_client) return _client;
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _client;
}
