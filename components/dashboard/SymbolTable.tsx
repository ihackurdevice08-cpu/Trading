"use client";
import React from "react";
import type { SymbolStat } from "@/types/dashboard";

const panel: React.CSSProperties = {
  border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
  borderRadius: 14, padding: "16px 18px",
  background: "var(--panel,rgba(255,255,255,0.04))",
  backdropFilter: "blur(8px)",
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, opacity: 0.45,
  letterSpacing: 1.2, textTransform: "uppercase" as const,
  fontFamily: "var(--font-mono,monospace)", marginBottom: 12,
};

const fmt  = (v: number) => v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const sign = (v: number) => v > 0 ? "+" : "";
const pnlColor = (v: number) => v > 0 ? "var(--green,#0b7949)" : v < 0 ? "var(--red,#c0392b)" : "inherit";

export function SymbolTable({ symbols, pnlFrom }: { symbols: SymbolStat[]; pnlFrom?: string }) {
  if (!symbols?.length) return null;
  return (
    <div style={panel}>
      <div style={sectionTitle}>{`◉ 심볼별 분석 (${pnlFrom ? "사이클 기간" : "전체 기간"})`}</div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
        {symbols.map(sym => (
          <div key={sym.symbol} style={{
            display: "grid", gridTemplateColumns: "120px 1fr auto",
            gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 8,
            background: "rgba(255,255,255,0.02)", border: "1px solid var(--line-soft)",
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, fontFamily: "var(--font-mono,monospace)" }}>
              {sym.symbol.replace("USDT", "")}
              <span style={{ opacity: .4, fontWeight: 400 }}>/USDT</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
              <span style={{ fontSize: 11, opacity: .5 }}>{sym.count}건</span>
              <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, fontWeight: 700,
                background: sym.winRate >= 60 ? "rgba(11,121,73,0.12)" : sym.winRate < 40 ? "rgba(192,57,43,0.12)" : "rgba(255,255,255,0.08)",
                color: sym.winRate >= 60 ? "var(--green,#0b7949)" : sym.winRate < 40 ? "var(--red,#c0392b)" : "inherit",
              }}>{sym.winRate}%</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 14, color: pnlColor(sym.pnl),
              fontFamily: "var(--font-mono,monospace)", textAlign: "right" as const }}>
              {sign(sym.pnl)}{fmt(sym.pnl)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
