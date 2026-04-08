"use client";
import React from "react";
import type { MonthlyPnlPoint } from "@/types/dashboard";

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

export function MonthlyPnlTable({ data }: { data: MonthlyPnlPoint[] }) {
  if (!data?.length) return null;
  const maxAbs = Math.max(...data.map(d => Math.abs(d.pnl)), 1);
  return (
    <div style={panel}>
      <div style={sectionTitle}>◈ 월별 PnL</div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
        {[...data].reverse().map(d => {
          const barW = Math.round((Math.abs(d.pnl) / maxAbs) * 100);
          const isPos = d.pnl >= 0;
          return (
            <div key={d.month} style={{ display: "grid", gridTemplateColumns: "72px 1fr 90px", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 11, opacity: 0.5, fontFamily: "var(--font-mono,monospace)", whiteSpace: "nowrap" as const }}>
                {d.month}
              </div>
              <div style={{ height: 18, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden", position: "relative" as const }}>
                <div style={{
                  width: `${barW}%`, height: "100%", borderRadius: 4,
                  background: isPos ? "rgba(0,192,118,0.55)" : "rgba(255,77,77,0.55)",
                }} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 12, textAlign: "right" as const,
                color: pnlColor(d.pnl), fontFamily: "var(--font-mono,monospace)" }}>
                {sign(d.pnl)}{fmt(d.pnl)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
