"use client";
import React from "react";
import type { DashboardStats } from "@/types/dashboard";

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

function fmtDur(min: number | null) {
  if (min == null) return "—";
  if (min < 60) return `${min}분`;
  if (min < 1440) return `${Math.floor(min/60)}시간 ${min%60}분`;
  return `${Math.floor(min/1440)}일 ${Math.floor((min%1440)/60)}시간`;
}

export function TradingKPI({ stats, pnlFrom }: { stats: DashboardStats; pnlFrom?: string }) {
  const { longCount, shortCount, maxConsecWin, maxConsecLoss, avgDurationMin } = stats;
  const total   = (longCount || 0) + (shortCount || 0);
  const longPct  = total > 0 ? Math.round(((longCount || 0) / total) * 100) : 0;
  const shortPct = 100 - longPct;

  const kpis = [
    { label: "LONG / SHORT 비율", value: total > 0 ? `${longPct}% / ${shortPct}%` : "—",
      sub: `L ${longCount || 0}건 · S ${shortCount || 0}건` },
    { label: "최장 연승 / 연패", value: `${maxConsecWin || 0}연승 / ${maxConsecLoss || 0}연패`,
      sub: pnlFrom ? "사이클 기준" : "전체 기준" },
    { label: "평균 보유 시간", value: fmtDur(avgDurationMin), sub: "closed_at 기준" },
  ];

  return (
    <div style={panel}>
      <div style={sectionTitle}>◈ 트레이딩 패턴</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            padding: "12px 14px", borderRadius: 10,
            border: "1px solid var(--line-soft)", background: "rgba(255,255,255,0.03)",
          }}>
            <div style={{ fontSize: 10, opacity: 0.4, fontWeight: 600, letterSpacing: 0.8,
              textTransform: "uppercase" as const, fontFamily: "var(--font-mono,monospace)", marginBottom: 6 }}>
              {k.label}
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, fontFamily: "var(--font-mono,monospace)" }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 10, opacity: 0.4, marginTop: 4 }}>{k.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
