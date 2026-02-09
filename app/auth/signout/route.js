import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function handler(request) {
  const cookieStore = await cookies();
  const origin = new URL(request.url).origin;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll() {} } }
  );

  await supabase.auth.signOut();
  return NextResponse.redirect(origin, { status: 303 });
}

export async function GET(request) {
  return handler(request);
}
export async function POST(request) {
  return handler(request);
}
