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
  const timer = useRef(null);

  async function tick() {
    try {
      const r = await fetch(API_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      if (!j?.ok || !j?.data) throw new Error("bad");
      setData(j.data);
      setError(false);
      setLoaded(true);
    } catch { setError(true); }
  }

  useEffect(() => {
    tick();
    timer.current = setInterval(tick, 5000);
    return () => clearInterval(timer.current);
  }, []);

  const rows = useMemo(() =>
    SYMBOLS.map(s => {
      const it   = data[s] || {};
      const price = Number(it.price);
      const pct   = Number(it.pctDay);
      return { symbol: s, base: s.replace("USDT", ""), price, pct,
               up: pct > 0, down: pct < 0 };
    }),
  [data]);

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
        padding: "0 12px", height: 50, gap: 6,
        overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none",
      }}>

        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap", flexShrink: 0,
          color: error ? "#e74c3c" : loaded ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.20)",
        }}>
          {error ? "⚠ ERR" : loaded ? "LIVE · 5s" : "…"}
        </div>

        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.20)", flexShrink: 0 }}>
          UTC
        </div>

        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.10)", flexShrink: 0 }} />

        {rows.map(r => (
          <button
            key={r.symbol}
            type="button"
            onClick={() => openTradingView(r.symbol)}
            style={{
              all: "unset", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "5px 11px", borderRadius: 9, flexShrink: 0,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              transition: "background 0.12s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.11)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            title={`UTC 00:00 시초가 대비 변동률`}
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
              minWidth: 52, textAlign: "right",
              color: !loaded ? "rgba(255,255,255,0.25)"
                : r.up   ? "#2ecc71"
                : r.down ? "#e74c3c"
                : "rgba(255,255,255,0.45)",
            }}>
              {loaded ? fmtPct(r.pct) : "—"}
            </span>
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", flexShrink: 0 }}>Binance</span>
      </div>
    </div>
  );
}
