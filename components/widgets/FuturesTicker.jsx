"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

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

function Pill({ sym, price, pct }) {
  const up = (pct ?? 0) >= 0;
  const pctColor = up ? "var(--pos)" : "var(--neg)";
  const bg = up ? "rgba(45,212,191,0.10)" : "rgba(255,77,77,0.10)";
  const border = up ? "rgba(45,212,191,0.35)" : "rgba(255,77,77,0.35)";

  return (
    <div
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
      }}
      title="Binance Futures 24h change"
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>{sym}</div>
        <div style={{ fontWeight: 900, color: pctColor }}>{fmtPct(pct)}</div>
      </div>

      <div style={{ fontWeight: 900 }}>
        {fmtPrice(price)}
      </div>
    </div>
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
        setData((prev) => ({
          ...prev,
          ...j.items,
        }));
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
      <Pill sym="BTCUSDT" price={data.BTCUSDT?.price} pct={data.BTCUSDT?.pct} />
      <Pill sym="ETHUSDT" price={data.ETHUSDT?.price} pct={data.ETHUSDT?.pct} />
      <Pill sym="SOLUSDT" price={data.SOLUSDT?.price} pct={data.SOLUSDT?.pct} />
    </div>
  );
}
