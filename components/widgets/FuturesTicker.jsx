"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const API_URL = `/api/binance-tickers?symbols=${SYMBOLS.join(",")}`;

function openTradingView(sym) {
  const tv = `BINANCE:${sym}`;
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
  if (!Number.isFinite(n)) return "—";
  if (n >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

export default function FuturesTicker() {
  const [data, setData] = useState({});
  const [error, setError] = useState(false);
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
    SYMBOLS.map((s) => {
      const it = data[s] || {};
      const price = Number(it.price);
      const pct = Number(it.pct);
      const up = Number.isFinite(pct) && pct >= 0;
      const down = Number.isFinite(pct) && pct < 0;
      return { symbol: s, base: s.replace("USDT", ""), price, pct, up, down };
    }),
  [data]);

  return (
    <div style={{
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 200,
      background: "rgba(20,18,14,0.96)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderTop: "1px solid rgba(255,255,255,0.10)",
      // 갤럭시 폴드 홈 인디케이터 대응
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {/* 데스크탑 레이아웃 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        height: 52,
        gap: 8,
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}>
        {/* 라벨 */}
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {error ? "⚠ RETRY" : loaded ? "LIVE · 5s" : "…"}
        </div>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />

        {/* 코인 버튼들 */}
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
              gap: 8,
              padding: "6px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
          >
            {/* 심볼 */}
            <span style={{
              fontSize: 12,
              fontWeight: 800,
              color: "rgba(255,255,255,0.85)",
              minWidth: 32,
            }}>
              {r.base}
            </span>

            {/* 가격 */}
            <span style={{
              fontSize: 13,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: loaded ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.30)",
            }}>
              {loaded ? fmtPrice(r.price) : "—"}
            </span>

            {/* 등락률 */}
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: !loaded
                ? "rgba(255,255,255,0.30)"
                : r.up ? "#2ecc71"
                : r.down ? "#e74c3c"
                : "rgba(255,255,255,0.50)",
              minWidth: 52,
              textAlign: "right",
            }}>
              {loaded ? fmtPct(r.pct) : "—"}
            </span>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <div style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.20)",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}>
          Binance
        </div>
      </div>
    </div>
  );
}
