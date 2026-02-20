import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function parseSymbols(s: string | null) {
  const raw = (s || "BTCUSDT,ETHUSDT,SOLUSDT")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);

  return raw.slice(0, 20);
}

async function fetchWithTimeout(url: string, ms = 3500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept: "application/json,text/plain,*/*",
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
    `https://fapi.binance.com/fapi/v1/ticker/price?symbols=${symJson}`,
    `https://data-api.binance.vision/fapi/v1/ticker/price?symbols=${symJson}`,
  ];

  let lastErr = "";
  for (const url of candidates) {
    try {
      const r = await fetchWithTimeout(url, 4000);
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        lastErr = `upstream ${r.status}: ${t.slice(0, 200)}`;
        continue;
      }

      const j = await r.json().catch(() => null);
      if (!j) {
        lastErr = "upstream json parse failed";
        continue;
      }

      const arr = Array.isArray(j) ? j : [j];
      const out: Record<string, any> = {};
      for (const it of arr) {
        const sym = String(it?.symbol || "").toUpperCase();
        const price = Number(it?.price);
        if (sym && Number.isFinite(price)) out[sym] = { lastPrice: price };
      }

      return json(200, { ok: true, data: out, source: url });
    } catch (e: any) {
      lastErr = e?.name === "AbortError" ? "timeout" : String(e?.message || e);
      continue;
    }
  }

  return json(500, { ok: false, error: `binance fetch failed: ${lastErr}` });
}
