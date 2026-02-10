import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get("symbols") || "";
  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT;

  const r = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr", { cache: "no-store" });
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: `binance status=${r.status}` }, { status: 502 });
  }

  const arr = await r.json();
  const map: Record<string, { price: number; pct: number }> = {};

  if (Array.isArray(arr)) {
    for (const it of arr) {
      const sym = String(it?.symbol || "").toUpperCase();
      if (!symbols.includes(sym)) continue;

      map[sym] = {
        price: Number(it?.lastPrice ?? NaN),
        pct: Number(it?.priceChangePercent ?? NaN),
      };
    }
  }

  for (const s of symbols) {
    if (!map[s]) map[s] = { price: NaN as any, pct: NaN as any };
  }

  return NextResponse.json({ ok: true, data: map });
}
