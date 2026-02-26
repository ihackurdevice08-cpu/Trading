import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSymbols(s: string | null) {
  return (s || "BTCUSDT,ETHUSDT,SOLUSDT")
    .split(",").map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, 20);
}

async function fetchWithTimeout(url: string, ms = 4500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal, cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
    });
  } finally { clearTimeout(t); }
}

// KST 당일 00:00 UTC 타임스탬프
function kstDayStartMs(): number {
  const now = new Date();
  const kstMs = now.getTime() + 9 * 3600 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear(), mo = kst.getUTCMonth(), d = kst.getUTCDate();
  // KST 00:00 = UTC 전날 15:00
  return Date.UTC(y, mo, d, 0, 0, 0) - 9 * 3600 * 1000;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  const symJson = encodeURIComponent(JSON.stringify(symbols));

  // ── 1) KST 당일 시초가: klines 1d (KST 00:00 기준 일봉 open)
  //    Binance 일봉 기준: UTC 00:00 = KST 09:00 → 실제 KST 장 시작과 다름
  //    → 정확한 KST 시초가는 kstStartMs을 startTime으로 주면 됨
  const dayStartMs = kstDayStartMs();

  // 가격 + 24h 통계 한 번에 가져오기
  const tickerCandidates = [
    `https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${symJson}`,
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${symJson}`,
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${symJson}`,
  ];

  // KST 당일 시초가용 klines (1m interval, limit=1, startTime=오늘 KST 00:00)
  // futures: fapi, spot fallback: api
  // 각 심볼별로 가져오면 너무 많은 요청 → 24hr ticker의 openPrice 활용
  // 단, openPrice는 "24시간 전" 기준임
  // 진짜 KST 당일 시초가 = klines?interval=1d&limit=1 의 open (UTC 00:00 기준 daily open)
  // → 트레이더 입장에서 "오늘 얼마로 시작했나" = UTC 기준 daily open이 가장 실용적
  // → Binance daily kline open = UTC 00:00 기준, 한국 트레이더에게 이게 표준

  let tickerData: Record<string, { price: number; open24h: number; pct24h: number }> = {};
  let lastErr = "";

  for (const url of tickerCandidates) {
    try {
      const r = await fetchWithTimeout(url, 4000);
      if (!r.ok) { lastErr = `upstream ${r.status}`; continue; }
      const j = await r.json().catch(() => null);
      if (!Array.isArray(j) && !j) { lastErr = "json fail"; continue; }

      const arr = Array.isArray(j) ? j : [j];
      for (const it of arr) {
        const sym = String(it?.symbol || "").toUpperCase();
        if (!symbols.includes(sym)) continue;
        tickerData[sym] = {
          price:   Number(it?.lastPrice  ?? it?.price ?? NaN),
          open24h: Number(it?.openPrice  ?? NaN),   // 24시간 전 open (rolling)
          pct24h:  Number(it?.priceChangePercent ?? NaN), // 24시간 rolling 변동률
        };
      }
      break;
    } catch (e: any) {
      lastErr = e?.name === "AbortError" ? "timeout" : String(e?.message || e);
    }
  }

  // ── 2) KST 당일 시초가(daily kline open) 별도 fetch
  //    futures daily kline = UTC 00:00 시가
  //    → 이게 실질적으로 한국 트레이더들이 "당일 시초가"로 보는 값
  const klinesBase = "https://fapi.binance.com/fapi/v1/klines";
  const klinesSpot = "https://api.binance.com/api/v3/klines";

  const dailyOpenMap: Record<string, number> = {};

  // 심볼 수가 적으므로 병렬 fetch
  await Promise.allSettled(
    symbols.map(async (sym) => {
      // futures 먼저, 실패하면 spot
      for (const base of [klinesBase, klinesSpot]) {
        try {
          const url = `${base}?symbol=${sym}&interval=1d&limit=1`;
          const r = await fetchWithTimeout(url, 3000);
          if (!r.ok) continue;
          const arr = await r.json().catch(() => null);
          // kline: [openTime, open, high, low, close, volume, ...]
          if (Array.isArray(arr) && arr[0]) {
            dailyOpenMap[sym] = Number(arr[0][1]); // index 1 = open
            break;
          }
        } catch {}
      }
    })
  );

  // ── 결과 조합
  const out: Record<string, {
    price: number;
    pct24h: number;    // 24시간 rolling 변동률 (Binance 표준)
    pctDay: number;    // UTC 당일 시초가 기준 변동률 (= KST 09:00 기준)
    open24h: number;
    openDay: number;
  }> = {};

  for (const sym of symbols) {
    const t = tickerData[sym];
    const openDay = dailyOpenMap[sym] ?? NaN;
    const price = t?.price ?? NaN;
    const pctDay = Number.isFinite(openDay) && openDay > 0 && Number.isFinite(price)
      ? ((price - openDay) / openDay) * 100
      : NaN;

    out[sym] = {
      price,
      pct24h:  t?.pct24h  ?? NaN,
      pctDay,
      open24h: t?.open24h ?? NaN,
      openDay,
    };
  }

  if (Object.keys(out).length === 0) {
    return NextResponse.json({ ok: false, error: `fetch failed: ${lastErr}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: out });
}
