import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

async function handler(request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;

  // 먼저 redirect 응답을 만들어두고(303), Supabase가 setAll로 쿠키를 여기다 꽂게 한다.
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
    response.headers.set("Location", `${origin}/?e=oauth`);
    return response;
  }

  // 여기서 구글 인증 URL로 보내기
  response.headers.set("Location", data.url);
  return response;
}

export async function GET(request) {
  return handler(request);
}
export async function POST(request) {
  return handler(request);
}
