import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Firebase 공개키 (JWKS) — Google의 공식 엔드포인트
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string" || idToken.length < 20) {
      return NextResponse.json({ ok: false, error: "idToken 없음" }, { status: 400 });
    }

    // Firebase idToken 서버 사이드 서명 검증 (jose — Edge/Node 모두 호환)
    let uid: string;
    try {
      const { payload } = await jwtVerify(idToken, JWKS, {
        issuer:   `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        audience: FIREBASE_PROJECT_ID,
      });
      uid = (payload.user_id ?? payload.uid ?? payload.sub ?? "") as string;
      if (!uid) throw new Error("uid 없음");
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: `토큰 검증 실패: ${e?.message}` },
        { status: 401 }
      );
    }

    // 검증된 idToken을 세션 쿠키에 저장 (7일)
    const res = NextResponse.json({ ok: true, uid });
    res.cookies.set("__session", idToken, {
      httpOnly: true,
      secure:   true,
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7,
      path:     "/",
    });
    return res;

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
