import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  return NextResponse.redirect(`${origin}/dashboard`, { status: 303 });
}
