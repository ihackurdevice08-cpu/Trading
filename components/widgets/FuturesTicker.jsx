"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

function tvSymbol(sym) {
  // TradingView Perp 표기: BINANCE:BTCUSDT.P (대부분 이 심볼로 연결됨)
  return `BINANCE:${sym}.P`;
}

function openTradingView(sym) {
  const tv = tvSymbol(sym);
  const web = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`;

  // 모바일: 딥링크 시도 후 fallback
  // (TV 앱이 있으면 tradingview:// 가 먹히는 기기가 있음. 안 먹으면 웹으로 감.)
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    const deep = `tradingview://chart?symbol=${encodeURIComponent(tv)}`;
    try {
      window.location.href = deep;
      setTimeout(() => {
        window.location.href = web;
      }, 650);
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
  // 코인별 자릿수 자동 느낌
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
  const inflight = useRef(false);
  const timer = useRef(null);

  const rows = useMemo(() => {
    return SYMBOLS.map((s) => {
      const it = data[s] || {};
      const price = Number(it.price);
      const pct = Number(it.pct);
      const up = isFinite(pct) && pct >= 0;
      const color = !isFinite(pct) ? "var(--text-muted)" : up ? "rgba(139,226,139,0.95)" : "rgba(255,122,122,0.95)";
      return { symbol: s, price, pct, color };
    });
  }, [data]);

  async function tick() {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const r = await fetch("/api/binance-tickers", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok && j.data) setData(j.data);
    } catch {
      // ignore
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
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        borderTop: "1px solid var(--line-soft)",
        background: "rgba(0,0,0,0.18)",
        backdropFilter: "blur(10px)",
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
              border: "1px solid var(--line-soft)",
              background: "rgba(210,194,165,0.10)",
              minWidth: 210,
              justifyContent: "space-between",
            }}
            title="Open in TradingView"
          >
            <span style={{ fontWeight: 900, letterSpacing: 0.3 }}>
              {r.symbol.replace("USDT", "")}
            </span>

            {/* ✅ 요구: 가격(좌) / 퍼센트(우) */}
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900 }}>
              {fmtPrice(r.price)}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900, color: r.color }}>
              {fmtPct(r.pct)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
