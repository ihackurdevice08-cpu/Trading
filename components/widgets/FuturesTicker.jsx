"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const API_URL  = `/api/binance-tickers?symbols=${SYMBOLS.join(",")}`;

function openTradingView(sym) {
  const tv  = `BINANCE:${sym}`;
  const web = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = `tradingview://chart?symbol=${encodeURIComponent(tv)}`;
    setTimeout(() => (window.location.href = web), 600);
  } else {
    window.open(web, "_blank", "noopener,noreferrer");
  }
}

function fmtPrice(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1000)  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (n >= 100)   return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1)     return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

export default function FuturesTicker() {
  const [data,   setData]   = useState({});
  const [error,  setError]  = useState(false);
  const [loaded, setLoaded] = useState(false);
  // "day" = UTC 당일 시초가 기준, "24h" = 24시간 rolling
  const [mode, setMode] = useState("day");
  const timer = useRef(null);

  async function tick() {
    try {
      const r = await fetch(API_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      if (!j?.ok || !j?.data) throw new Error("bad response");
      setData(j.data);
      setError(false);
      setLoaded(true);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    tick();
    timer.current = setInterval(tick, 5000);
    return () => clearInterval(timer.current);
  }, []);

  const rows = useMemo(() =>
    SYMBOLS.map(s => {
      const it = data[s] || {};
      const price = Number(it.price);
      // 선택된 모드에 따라 변동률 결정
      const pct   = mode === "day" ? Number(it.pctDay) : Number(it.pct24h);
      const up    = Number.isFinite(pct) && pct > 0;
      const down  = Number.isFinite(pct) && pct < 0;
      return { symbol: s, base: s.replace("USDT", ""), price, pct, up, down };
    }),
  [data, mode]);

  const pctColor = (r) =>
    !loaded ? "rgba(255,255,255,0.30)"
    : r.up   ? "#2ecc71"
    : r.down ? "#e74c3c"
    : "rgba(255,255,255,0.50)";

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 200,
      background: "rgba(14,12,10,0.97)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      borderTop: "1px solid rgba(255,255,255,0.09)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        padding: "0 10px", height: 50, gap: 6,
        overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none",
      }}>

        {/* 상태 + 모드 토글 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: 0.5 }}>
            {error ? "⚠ ERR" : loaded ? "LIVE·5s" : "…"}
          </span>
          {/* 모드 토글 버튼 */}
          <button
            onClick={() => setMode(m => m === "day" ? "24h" : "day")}
            style={{
              all: "unset", cursor: "pointer",
              fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
              color: "rgba(255,255,255,0.45)",
              padding: "1px 5px", borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            title={mode === "day" ? "UTC 당일 시초가 기준 · 클릭하면 24h 롤링으로 전환" : "24시간 롤링 변동률 · 클릭하면 당일 기준으로 전환"}
          >
            {mode === "day" ? "TODAY" : "24H"}
          </button>
        </div>

        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.10)", flexShrink: 0 }} />

        {/* 코인 버튼들 */}
        {rows.map(r => (
          <button
            key={r.symbol}
            type="button"
            onClick={() => openTradingView(r.symbol)}
            style={{
              all: "unset", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "5px 11px", borderRadius: 9,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              flexShrink: 0, transition: "background 0.12s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.11)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.80)", minWidth: 28 }}>
              {r.base}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              color: loaded ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.25)",
            }}>
              {loaded ? fmtPrice(r.price) : "—"}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              color: pctColor(r), minWidth: 50, textAlign: "right",
            }}>
              {loaded ? fmtPct(r.pct) : "—"}
            </span>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", flexShrink: 0, whiteSpace: "nowrap" }}>
          Binance
        </span>
      </div>
    </div>
  );
}
