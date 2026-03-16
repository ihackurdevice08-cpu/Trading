import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string" || idToken.length < 20) {
      return NextResponse.json({ ok: false, error: "idToken 없음" }, { status: 400 });
    }

    // 쿠키에 idToken 저장 (검증은 각 API route에서 Firebase Admin으로 처리)
    const res = NextResponse.json({ ok: true });
    res.cookies.set("__session", idToken, {
      httpOnly: true,
      secure:   true,
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7, // 7일
      path:     "/",
    });
    return res;

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
