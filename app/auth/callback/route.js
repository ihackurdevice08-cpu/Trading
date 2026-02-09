import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;

  // 기본: 성공 후 홈으로
  const response = NextResponse.redirect(origin, { status: 303 });

  if (!code) {
    // code가 없으면 그냥 홈으로 (또는 에러 페이지로 바꿔도 됨)
    response.headers.set("Location", `${origin}/?e=no_code`);
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    response.headers.set("Location", `${origin}/?e=exchange_failed`);
    return response;
  }

  // 세션 쿠키 박힌 상태로 홈으로
  response.headers.set("Location", origin);
  return response;
}
