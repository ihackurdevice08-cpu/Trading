import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ ok: false, error: "idToken 없음" }, { status: 400 });
    }

    // 토큰 검증 (실패 시 상세 에러 반환)
    try {
      await adminAuth().verifyIdToken(idToken);
    } catch (verifyErr: any) {
      console.error("[session] verifyIdToken 실패:", verifyErr?.message);
      return NextResponse.json(
        { ok: false, error: `토큰 검증 실패: ${verifyErr?.message}` },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("__session", idToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7, // 7일
      path:     "/",
    });
    return res;

  } catch (e: any) {
    console.error("[session] 알 수 없는 오류:", e?.message);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
