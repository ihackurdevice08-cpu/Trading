import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function canonicalSite() {
  const v = process.env.NEXT_PUBLIC_SITE_URL;
  if (!v) return null;
  return v.replace(/\/+$/, ""); // trailing slash 제거
}

async function handler(request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // 여기서는 redirect만 하므로 불필요
      },
    }
  );

  const origin = canonicalSite() || new URL(request.url).origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}/?e=oauth`, { status: 303 });
  }

  // ✅ fetch로 호출하면 브라우저가 redirect를 "따라가서" 화면이 안 바뀌는 경우가 많다.
  // ✅ form submit(네 코드)일 때는 아래 redirect가 정상적으로 브라우저 네비게이션을 일으킨다.
  return NextResponse.redirect(data.url, { status: 303 });
}

export async function GET(request) {
  return handler(request);
}
export async function POST(request) {
  return handler(request);
}
