import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "https://fapi.binance.com/fapi/v1/ticker/24hr";
const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

export async function GET() {
  try {
    const url = `${ENDPOINT}?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
    const r = await fetch(url, { cache: "no-store" });
    const text = await r.text();
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: `binance ${r.status}: ${text}` }, { status: 502 });
    }

    const arr = JSON.parse(text);
    const items: Record<string, { price: number; pct: number }> = {};

    for (const it of arr) {
      const sym = String(it.symbol || "");
      if (!sym) continue;
      items[sym] = {
        price: Number(it.lastPrice ?? 0),
        pct: Number(it.priceChangePercent ?? 0),
      };
    }

    return NextResponse.json({ ok: true, ts: Date.now(), items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
