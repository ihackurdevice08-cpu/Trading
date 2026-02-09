import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function handler(request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll() {} } }
  );

  const origin = new URL(request.url).origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` }
  });

  // ✅ 핵심: Vercel Logs에서 이 3줄이 보여야 함
  console.log("[signin] origin =", origin);
  console.log("[signin] error =", error);
  console.log("[signin] data.url =", data?.url);

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}/?e=oauth`, { status: 303 });
  }

  return NextResponse.redirect(data.url, { status: 303 });
}

export async function POST(request) {
  return handler(request);
}

// ✅ 주소창 테스트용 (버튼 말고 직접 /auth/signin 들어가도 확인 가능)
export async function GET(request) {
  return handler(request);
}
