#!/usr/bin/env bash
set -euo pipefail

cat > components/widgets/FuturesTicker.jsx <<'JS'
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

// Binance Spot 24hr (one-shot)
function oneShotUrl() {
  const symbolsJson = encodeURIComponent(JSON.stringify(SYMBOLS));
  return `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsJson}`;
}

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
  const timer = useRef(null);

  async function tick() {
    try {
      const r = await fetch(oneShotUrl(), { cache: "no-store" });
      if (!r.ok) return;

      const arr = await r.json();
      const map = {};

      if (Array.isArray(arr)) {
        for (const it of arr) {
          const sym = String(it?.symbol || "").toUpperCase();
          if (!SYMBOLS.includes(sym)) continue;
          map[sym] = {
            price: Number(it?.lastPrice),
            pct: Number(it?.priceChangePercent),
          };
        }
      }

      for (const s of SYMBOLS) if (!map[s]) map[s] = { price: NaN, pct: NaN };
      setData(map);
    } catch {}
  }

  useEffect(() => {
    tick();
    timer.current = setInterval(tick, 1000);
    return () => clearInterval(timer.current);
  }, []);

  const rows = useMemo(() => {
    return SYMBOLS.map((s) => {
      const it = data[s] || {};
      const price = Number(it.price);
      const pct = Number(it.pct);

      let pctColor = "#000";
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
        zIndex: 50,
        borderTop: "1px solid rgba(0,0,0,0.1)",
        background: "rgba(245,242,235,0.95)",
        padding: "10px 12px",
      }}
    >
      {/* small label */}
      <div
        style={{
          position: "absolute",
          right: 12,
          top: 6,
          fontSize: 11,
          color: "#111",
          opacity: 0.7,
        }}
      >
        Binance Spot Live Price
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
        }}
      >
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

            {/* price left */}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmtPrice(r.price)}
            </span>

            {/* pct right */}
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                color: r.pctColor,
              }}
            >
              {fmtPct(r.pct)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
JS

npm run build
git add components/widgets/FuturesTicker.jsx
git commit -m "style: ticker readable black text + pct colors + binance spot label" || true
git push
vercel --prod
