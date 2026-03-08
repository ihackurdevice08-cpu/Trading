import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
