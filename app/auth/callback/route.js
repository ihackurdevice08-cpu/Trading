import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function canonicalSite() {
  const v = process.env.NEXT_PUBLIC_SITE_URL;
  if (!v) return null;
  return v.replace(/\/+$/, "");
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const origin = canonicalSite() || url.origin;

  // code 없으면 그냥 홈으로
  if (!code) {
    return NextResponse.redirect(`${origin}/`, { status: 303 });
  }

  // ✅ 쿠키 세팅이 들어가야 하니까 response를 먼저 만든다
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

  await supabase.auth.exchangeCodeForSession(code);

  return response;
}
