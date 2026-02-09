import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;

  // 응답 객체를 먼저 만들고, 여기에 쿠키를 setAll로 박아야 함 (PKCE 때문에 필수)
  const response = NextResponse.redirect(origin, { status: 303 });

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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}/?e=oauth_start`, { status: 303 });
  }

  // 실제 목적지(구글 OAuth)로 Location만 갈아끼우면 됨
  response.headers.set("Location", data.url);
  return response;
}
