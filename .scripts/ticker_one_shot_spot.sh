#!/usr/bin/env bash
set -euo pipefail

mkdir -p components/widgets

cat > components/widgets/FuturesTicker.jsx <<'JS'
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

// ✅ 예전 방식: "한방에" 24hr ticker 가져오기 (Spot)
// Binance Spot: /api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT"]
function oneShotUrl() {
  const symbolsJson = encodeURIComponent(JSON.stringify(SYMBOLS));
  return `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsJson}`;
}

function tvSymbol(sym) {
  // 현물 차트
  return `BINANCE:${sym}`;
}

function openTradingView(sym) {
  const tv = tvSymbol(sym);
  const web = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`;

  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    const deep = `tradingview://chart?symbol=${encodeURIComponent(tv)}`;
    try {
      window.location.href = deep;
      setTimeout(() => (window.location.href = web), 650);
      return;
    } catch {
      window.location.href = web;
      return;
    }
  }
  window.open(web, "_blank", "noopener,noreferrer");
}

function fmtPrice(n) {
  if (typeof n !== "number" || !isFinite(n)) return "-";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function fmtPct(n) {
  if (typeof n !== "number" || !isFinite(n)) return "-";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function FuturesTicker() {
  const [data, setData] = useState({});
  const [note, setNote] = useState("");
  const timer = useRef(null);
  const inflight = useRef(false);

  async function tick() {
    if (inflight.current) return;
    inflight.current = true;

    try {
      setNote("");
      const r = await fetch(oneShotUrl(), { cache: "no-store" });
      if (!r.ok) throw new Error(`binance status=${r.status}`);

      const arr = await r.json();
      const map = {};

      if (Array.isArray(arr)) {
        for (const it of arr) {
          const sym = String(it?.symbol || "").toUpperCase();
          if (!SYMBOLS.includes(sym)) continue;

          map[sym] = {
            price: Number(it?.lastPrice ?? NaN),
            pct: Number(it?.priceChangePercent ?? NaN),
          };
        }
      }

      // 누락은 NaN 처리(표기는 -)
      for (const s of SYMBOLS) if (!map[s]) map[s] = { price: NaN, pct: NaN };

      setData(map);
    } catch (e) {
      setNote(String(e?.message || e));
    } finally {
      inflight.current = false;
    }
  }

  useEffect(() => {
    tick();
    timer.current = setInterval(tick, 1000); // ✅ 1초마다
    return () => timer.current && clearInterval(timer.current);
  }, []);

  const rows = useMemo(() => {
    return SYMBOLS.map((s) => {
      const it = data?.[s] || {};
      const price = Number(it.price);
      const pct = Number(it.pct);

      const up = isFinite(pct) && pct >= 0;
      const color = !isFinite(pct)
        ? "var(--text-muted, rgba(233,236,241,0.72))"
        : up
          ? "rgba(139,226,139,0.95)"
          : "rgba(255,122,122,0.95)";

      return { symbol: s, price, pct, color };
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
        borderTop: "1px solid var(--line-soft, rgba(233,236,241,0.18))",
        background: "rgba(0,0,0,0.18)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
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
              gap: 10,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid var(--line-soft, rgba(233,236,241,0.18))",
              background: "rgba(210,194,165,0.10)",
              minWidth: 220,
              justifyContent: "space-between",
              color: "var(--text-primary, #e9ecf1)", // ✅ “안 보임” 방지
              fontWeight: 900,
            }}
          >
            <span style={{ letterSpacing: 0.3 }}>
              {r.symbol.replace("USDT", "")}
            </span>

            {/* ✅ 요구: 가격(좌) / 퍼센트(우) */}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmtPrice(r.price)}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: r.color }}>
              {fmtPct(r.pct)}
            </span>
          </button>
        ))}
      </div>

      {note ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted, rgba(233,236,241,0.72))" }}>
          Ticker note: {note}
        </div>
      ) : null}
    </div>
  );
}
JS

npm run build
git add components/widgets/FuturesTicker.jsx
git commit -m "fix: ticker uses one-shot Binance Spot 24hr (client fetch) + visible text" || true
git push
vercel --prod
