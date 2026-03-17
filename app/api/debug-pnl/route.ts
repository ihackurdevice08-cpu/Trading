import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { queryDocs, listDocs } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthInfo();
  
  if (!auth) {
    return NextResponse.json({ 
      ok: false, 
      error: "NO AUTH - 쿠키 없음 또는 JWT 디코딩 실패",
      cookiePresent: false
    }, { status: 401 });
  }

  const { uid, token } = auth;
  
  // token 유효성 테스트 - 실제 Firestore 읽기 시도
  let readTest = null;
  let readError = null;
  let writeTest = null;
  let writeError = null;

  try {
    const docs = await queryDocs(token, `users/${uid}/fills_raw`, {
      orderBy: [{ field: { fieldPath: "ts_ms" }, direction: "DESCENDING" }],
      limit: 1,
    });
    readTest = { ok: true, count: docs.length };
  } catch(e: any) {
    readError = e?.message;
  }

  // 쓰기 테스트 - 테스트 문서 하나 써보기
  try {
    const { setDoc } = await import("@/lib/firebase/firestoreRest");
    await setDoc(token, `users/${uid}/debug_test/ping`, { ts: new Date(), test: true });
    writeTest = { ok: true };
  } catch(e: any) {
    writeError = e?.message;
  }

  // fills_raw 총 개수
  let fillsCount = 0;
  try {
    const fills = await listDocs(token, `users/${uid}/fills_raw`, 10);
    fillsCount = fills.length;
  } catch(e: any) {}

  return NextResponse.json({
    ok: true,
    uid,
    tokenLen: token.length,
    tokenExpiry: (() => {
      try {
        const p = token.split('.')[1];
        const payload = JSON.parse(Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString());
        return { exp: new Date(payload.exp * 1000).toISOString(), expired: payload.exp < Date.now()/1000 };
      } catch { return null; }
    })(),
    readTest, readError,
    writeTest, writeError,
    fillsCount,
  });
}
