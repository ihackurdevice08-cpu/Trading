import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;

  // code 없으면 그냥 홈으로
  if (!code) return NextResponse.redirect(`${origin}/`, { status: 303 });

  // 홈으로 보내는 response를 만들고 여기 쿠키를 setAll로 박음
  const response = NextResponse.redirect(`${origin}/`, { status: 303 });

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
    return NextResponse.redirect(`${origin}/?e=oauth_exchange`, { status: 303 });
  }

  return response;
}
