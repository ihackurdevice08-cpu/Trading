"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
// Binance Futures 24hr 티커 - 서버 API 경유 (CORS 안전, Next.js 캐싱 활용)
const API_URL = `/api/binance-tickers?symbols=${SYMBOLS.join(",")}`;

function tvSymbol(sym) {
  return `BINANCE:${sym}`;
}

function openTradingView(sym) {
  const tv = tvSymbol(sym);
  const web = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    const deep = `tradingview://chart?symbol=${encodeURIComponent(tv)}`;
    window.location.href = deep;
    setTimeout(() => (window.location.href = web), 600);
  } else {
    window.open(web, "_blank", "noopener,noreferrer");
  }
}

function fmtPrice(n) {
  if (!isFinite(n)) return "-";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function fmtPct(n) {
  if (!isFinite(n)) return "-";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function FuturesTicker() {
  const [data, setData] = useState({});
  const [error, setError] = useState(false);
  const timer = useRef(null);
  const retryCount = useRef(0);

  async function tick() {
    try {
      const r = await fetch(API_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const j = await r.json();
      if (!j?.ok || !j?.data) throw new Error("bad response");

      setData(j.data);
      setError(false);
      retryCount.current = 0;
    } catch {
      retryCount.current += 1;
      setError(true);
    }
  }

  useEffect(() => {
    tick();
    // 5초 폴링 (1초→5초: 브라우저 부하 80% 감소, 거래소 데이터는 5초도 충분)
    timer.current = setInterval(tick, 5000);
    return () => clearInterval(timer.current);
  }, []);

  const rows = useMemo(() => {
    return SYMBOLS.map((s) => {
      const it = data[s] || {};
      const price = Number(it.price);
      const pct = Number(it.pct);
      let pctColor = "inherit";
      if (isFinite(pct)) {
        pctColor = pct >= 0 ? "#0b7949" : "#bc0a07";
      }
      return { symbol: s, price, pct, pctColor };
    });
  }, [data]);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid rgba(0,0,0,0.10)",
        padding: "8px 16px",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 12,
          top: 6,
          fontSize: 11,
          opacity: 0.5,
        }}
      >
        {error ? "⚠ 연결 재시도 중..." : "Binance Futures · 5s"}
      </div>

      <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
        {rows.map((r) => (
          <button
            key={r.symbol}
            type="button"
            onClick={() => openTradingView(r.symbol)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 14px",
              minWidth: 220,
              borderRadius: 14,
              background: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(0,0,0,0.15)",
              fontWeight: 800,
              color: "#000",
            }}
          >
            <span>{r.symbol.replace("USDT", "")}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmtPrice(r.price)}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: r.pctColor }}>
              {fmtPct(r.pct)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
