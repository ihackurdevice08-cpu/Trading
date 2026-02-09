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

  const origin =
  process.env.NEXT_PUBLIC_SITE_URL ||
  new URL(request.url).origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` }
  });

  console.log("[signin] origin =", origin);
  console.log("[signin] error =", error);
  console.log("[signin] data.url =", data?.url);

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}/?e=oauth`, { status: 303 });
  }

  return NextResponse.redirect(data.url, { status: 303 });
}

export async function GET(request) {
  return handler(request);
}
export async function POST(request) {
  return handler(request);
}
