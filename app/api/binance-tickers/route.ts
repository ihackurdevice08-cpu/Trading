import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSymbols(s: string | null) {
  return (s || "BTCUSDT,ETHUSDT,SOLUSDT")
    .split(",").map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, 20);
}

async function fetchJ(url: string, ms = 5000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal, cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
    });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
  finally { clearTimeout(t); }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  const symJson = encodeURIComponent(JSON.stringify(symbols));

  // 24hr ticker 한 번만 호출 → price + openPrice(UTC 00:00 시초가) 한 번에 해결
  // Binance 24hr ticker의 openPrice = UTC 당일 00:00 시초가 (rolling 24h가 아님)
  let arr: any[] = [];

  for (const url of [
    `https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${symJson}`,
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${symJson}`,
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${symJson}`,
  ]) {
    const j = await fetchJ(url, 5000);
    if (j) { arr = Array.isArray(j) ? j : [j]; break; }
  }

  if (arr.length === 0) {
    return NextResponse.json({ ok: false, error: "Binance API 응답 없음" }, { status: 500 });
  }

  const out: Record<string, { price: number; pctDay: number; openDay: number }> = {};

  for (const it of arr) {
    const sym = String(it?.symbol || "").toUpperCase();
    if (!symbols.includes(sym)) continue;

    const price   = Number(it.lastPrice  ?? it.price ?? NaN);
    const openDay = Number(it.openPrice  ?? NaN);
    const pctDay  = Number.isFinite(price) && Number.isFinite(openDay) && openDay > 0
      ? ((price - openDay) / openDay) * 100
      : Number(it.priceChangePercent ?? NaN); // fallback: Binance 계산값 그대로

    out[sym] = { price, pctDay, openDay };
  }

  // 없는 심볼 채우기
  for (const sym of symbols) {
    if (!out[sym]) out[sym] = { price: NaN, pctDay: NaN, openDay: NaN };
  }

  return NextResponse.json({ ok: true, data: out });
}
