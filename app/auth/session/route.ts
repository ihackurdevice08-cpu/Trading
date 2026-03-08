import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    if (!idToken) return NextResponse.json({ ok: false }, { status: 400 });

    // 토큰 검증
    await adminAuth().verifyIdToken(idToken);

    const res = NextResponse.json({ ok: true });
    // 1시간 쿠키 (Firebase ID 토큰 만료와 동일)
    res.cookies.set("__session", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 401 });
  }
}
