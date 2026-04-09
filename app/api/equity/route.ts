/**
 * /api/equity
 * GET — Bitget 실시간 선물 지갑 총 잔고 (USDT-Futures usdtEquity 합산)
 * 대시보드에서 dashboard API와 병렬 호출하여 실제 잔고를 표시
 */
import { NextResponse } from "next/server";
import { getAuthInfo }    from "@/lib/firebase/serverAuth";
import { fetchBitgetEquity } from "@/lib/exchange/bitget";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 15; // Bitget API 타임아웃 고려

function bad(m: string, s = 400) {
  return NextResponse.json({ ok: false, error: m }, { status: s });
}

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const equity = await fetchBitgetEquity(uid, token);

  return NextResponse.json({
    ok:     true,
    equity, // null = 계정 없거나 API 실패
    ts:     new Date().toISOString(),
  });
}
