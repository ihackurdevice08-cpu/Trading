"use client";

import { useEffect, useState } from "react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

export default function FuturesTicker() {
  const [data, setData] = useState({});

  async function load() {
    try {
      const r = await fetch("/api/binance-tickers?symbols=" + SYMBOLS.join(","), {
        cache: "no-store",
      });
      const j = await r.json();
      if (j?.ok) setData(j.data || {});
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        zIndex: 9999,
        display: "flex",
        gap: 24,
        justifyContent: "center",
        padding: "10px 0",
        background: "rgba(20,18,15,0.9)",
        backdropFilter: "blur(10px)",
        borderTop: "1px solid rgba(210,194,165,0.25)",
        color: "#E8DCC8",
        fontWeight: 700,
      }}
    >
      {SYMBOLS.map((s) => {
        const it = data[s] || {};
        const pct = Number(it.pct);
        const price = Number(it.price);
        const color = pct >= 0 ? "#8BE28B" : "#FF7A7A";

        return (
          <div
            key={s}
            style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}
            onClick={() =>
              window.open(
                "https://www.tradingview.com/chart/?symbol=BINANCE:" + s,
                "_blank"
              )
            }
          >
            <span>{s.replace("USDT", "")}</span>
            <span style={{ color }}>
              {isNaN(pct) ? "-" : pct.toFixed(2) + "%"}
            </span>
            <span>
              {isNaN(price) ? "-" : price.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
