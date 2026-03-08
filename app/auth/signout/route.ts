import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const res = NextResponse.redirect(`${origin}/login`, { status: 303 });
  res.cookies.delete("__session");
  return res;
}
