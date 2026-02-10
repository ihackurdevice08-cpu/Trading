"use client";

import React, { useEffect, useRef, useState } from "react";

function fmtPrice(n) {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  let d = 2;
  if (abs < 1) d = 4;
  else if (abs < 10) d = 3;
  else if (abs < 1000) d = 2;
  else d = 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n) {
  if (!Number.isFinite(n)) return "-";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function openTradingView(symbol) {
  // TradingView 심볼 표기: Binance Futures(무기한) = BINANCE:BTCUSDT.P 등
  // - 가장 흔히 동작하는 웹 URL은 아래 /chart + symbol 파라미터
  const tvSym = `BINANCE:${symbol}.P`;

  // 1) 앱 딥링크 시도 (iOS/Android/데스크톱 앱 설치시 열릴 수 있음)
  // TradingView는 플랫폼/버전에 따라 딥링크 동작이 달라서 "시도 → 실패시 웹" 방식이 현실적.
  const deepLink = `tradingview://symbol/${encodeURIComponent(tvSym)}`;

  // 2) 웹 fallback (확실하게 동작)
  const web = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}`;

  // 새 탭 열기(대부분 브라우저에서 허용) → 앱 핸들러 있으면 앱이 가로채고, 없으면 실패
  // iOS에서는 바로 location 이동이 더 잘 먹는 경우가 있어 둘 다 사용.
  const w = window.open(deepLink, "_blank", "noopener,noreferrer");
  // 팝업 차단이면 w가 null일 수 있음 → 그땐 현재 탭에서 시도
  if (!w) {
    window.location.href = deepLink;
  }

  // 600ms 후 웹으로 강제 fallback (앱이 열리면 브라우저가 백그라운드로 가며, 이 코드가 실행 안되거나 무시되는 경우가 많음)
  setTimeout(() => {
    try {
      window.open(web, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = web;
    }
  }, 600);
}

function Pill({ sym, price, pct }) {
  const up = (pct ?? 0) >= 0;
  const pctColor = up ? "var(--pos)" : "var(--neg)";
  const bg = up ? "rgba(45,212,191,0.10)" : "rgba(255,77,77,0.10)";
  const border = up ? "rgba(45,212,191,0.35)" : "rgba(255,77,77,0.35)";

  return (
    <button
      type="button"
      onClick={() => openTradingView(sym)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        minWidth: 210,
        justifyContent: "space-between",
        boxShadow: "0 8px 18px rgba(0,0,0,0.15)",
        backdropFilter: "blur(10px)",
        cursor: "pointer",
        color: "var(--text-primary)",
      }}
      title="Tap to open TradingView (Binance Futures perpetual)"
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>{sym}</div>
        <div style={{ fontWeight: 900, color: pctColor }}>{fmtPct(pct)}</div>
      </div>

      <div style={{ fontWeight: 900 }}>{fmtPrice(price)}</div>
    </button>
  );
}

export default function FuturesTicker() {
  const [data, setData] = useState({
    BTCUSDT: { price: 0, pct: 0 },
    ETHUSDT: { price: 0, pct: 0 },
    SOLUSDT: { price: 0, pct: 0 },
  });

  const timer = useRef(null);
  const inflight = useRef(false);

  async function tick() {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const r = await fetch("/api/binance-tickers", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && j?.items) {
        setData((prev) => ({ ...prev, ...j.items }));
      }
    } finally {
      inflight.current = false;
    }
  }

  useEffect(() => {
    tick();
    timer.current = setInterval(tick, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 모바일 최적화: 작은 화면에서는 1열(세로 스택), 넓으면 2~3열 자동
  return (
    <div
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 10,
        alignItems: "center",
        justifyItems: "center",
      }}
    >
      <Pill sym="BTCUSDT" price={data.BTCUSDT?.price} pct={data.BTCUSDT?.pct} />
      <Pill sym="ETHUSDT" price={data.ETHUSDT?.price} pct={data.ETHUSDT?.pct} />
      <Pill sym="SOLUSDT" price={data.SOLUSDT?.price} pct={data.SOLUSDT?.pct} />
    </div>
  );
}
