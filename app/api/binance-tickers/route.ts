import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSymbols(s: string | null) {
  return (s || "BTCUSDT,ETHUSDT,SOLUSDT")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);
}

async function fetchWithTimeout(url: string, ms = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TradingApp/1.0)",
        accept: "application/json",
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  const symJson = encodeURIComponent(JSON.stringify(symbols));

  const candidates = [
    `https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${symJson}`,
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${symJson}`,
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${symJson}`,
  ];

  let lastErr = "";

  for (const url of candidates) {
    try {
      const r = await fetchWithTimeout(url, 4000);
      if (!r.ok) { lastErr = `upstream ${r.status}`; continue; }

      const j = await r.json().catch(() => null);
      if (!j) { lastErr = "json parse failed"; continue; }

      const arr = Array.isArray(j) ? j : [j];
      const out: Record<string, { price: number; pct: number }> = {};

      for (const it of arr) {
        const sym = String(it?.symbol || "").toUpperCase();
        if (!symbols.includes(sym)) continue;
        const price = Number(it?.lastPrice ?? it?.price ?? NaN);
        const pct = Number(it?.priceChangePercent ?? NaN);
        if (sym && Number.isFinite(price)) out[sym] = { price, pct };
      }

      for (const s of symbols) {
        if (!out[s]) out[s] = { price: NaN, pct: NaN };
      }

      return NextResponse.json({ ok: true, data: out });
    } catch (e: any) {
      lastErr = e?.name === "AbortError" ? "timeout" : String(e?.message || e);
    }
  }

  return NextResponse.json(
    { ok: false, error: `binance fetch failed: ${lastErr}` },
    { status: 500 }
  );
}
