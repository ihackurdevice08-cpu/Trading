import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function parseSymbols(s: string | null) {
  return (s || "BTCUSDT,ETHUSDT,SOLUSDT")
    .split(",").map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, 20);
}

async function fetchEndpoint(url: string): Promise<any[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4500); // 4.5초 타임아웃
  try {
    const r = await fetch(url, {
      signal: ctrl.signal, cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : [j];
    if (!arr.length) throw new Error("empty");
    return arr;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  const symJson = encodeURIComponent(JSON.stringify(symbols));

  const endpoints = [
    `https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${symJson}`,
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${symJson}`,
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${symJson}`,
  ];

  let arr: any[];
  try {
    // 병렬 호출 — 가장 먼저 성공한 응답 채택
    arr = await Promise.any(endpoints.map(fetchEndpoint));
  } catch {
    return NextResponse.json({ ok: false, error: "Binance API 응답 없음" }, { status: 500 });
  }

  const out: Record<string, { price: number; pctDay: number }> = {};

  for (const it of arr) {
    const sym = String(it?.symbol || "").toUpperCase();
    if (!symbols.includes(sym)) continue;

    const price  = Number(it.lastPrice ?? it.price ?? NaN);
    // Rolling 24h 변동률 — Binance 제공값 그대로 사용 (직접 계산 제거)
    const pctDay = Number(it.priceChangePercent ?? NaN);

    out[sym] = { price, pctDay };
  }

  for (const sym of symbols) {
    if (!out[sym]) out[sym] = { price: NaN, pctDay: NaN };
  }

  return NextResponse.json({ ok: true, data: out });
}
