import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSymbols(s: string | null) {
  return (s || "BTCUSDT,ETHUSDT,SOLUSDT")
    .split(",").map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, 20);
}

async function fetchJ(url: string, ms = 4500): Promise<any | null> {
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

  // ── 현재가 (24hr ticker)
  let tickerArr: any[] = [];
  for (const url of [
    `https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${symJson}`,
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${symJson}`,
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${symJson}`,
  ]) {
    const j = await fetchJ(url, 4000);
    if (j) { tickerArr = Array.isArray(j) ? j : [j]; break; }
  }

  const tickerMap: Record<string, number> = {};
  for (const it of tickerArr) {
    const sym = String(it?.symbol || "").toUpperCase();
    if (symbols.includes(sym)) tickerMap[sym] = Number(it?.lastPrice ?? it?.price ?? NaN);
  }

  // ── UTC 당일 00:00 시초가 (1d kline open)
  const utcOpenMap: Record<string, number> = {};
  await Promise.allSettled(
    symbols.map(async (sym) => {
      for (const base of [
        "https://fapi.binance.com/fapi/v1/klines",
        "https://api.binance.com/api/v3/klines",
      ]) {
        // limit=1, interval=1d → 오늘 UTC 00:00 시작 일봉 1개
        const arr = await fetchJ(`${base}?symbol=${sym}&interval=1d&limit=1`, 3500);
        if (Array.isArray(arr) && arr[0]?.[1] != null) {
          utcOpenMap[sym] = Number(arr[0][1]); // index 1 = open
          break;
        }
      }
    })
  );

  // ── 조합
  const out: Record<string, { price: number; pctDay: number; openDay: number }> = {};
  for (const sym of symbols) {
    const price   = tickerMap[sym]  ?? NaN;
    const openDay = utcOpenMap[sym] ?? NaN;
    const pctDay  = Number.isFinite(openDay) && openDay > 0 && Number.isFinite(price)
      ? ((price - openDay) / openDay) * 100
      : NaN;
    out[sym] = { price, pctDay, openDay };
  }

  return NextResponse.json({ ok: true, data: out });
}
