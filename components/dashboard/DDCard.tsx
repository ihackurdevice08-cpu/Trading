"use client";
import React from "react";
import type { DashboardStats } from "@/types/dashboard";

const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, opacity: 0.45,
  letterSpacing: 1.2, textTransform: "uppercase" as const,
  fontFamily: "var(--font-mono,monospace)", marginBottom: 0,
};

export function DDCard({ stats }: { stats: DashboardStats }) {
  const { currentDD, maxDD, recoveryNeeded } = stats;
  if (maxDD == null || maxDD <= 0) return null;
  const isInDD = currentDD > 0.5;
  const panelStyle: React.CSSProperties = {
    padding: "16px 18px", borderRadius: 14, marginBottom: 12,
    border: isInDD ? "1px solid rgba(255,77,77,0.3)" : "1px solid var(--line-soft,rgba(255,255,255,.08))",
    background: isInDD ? "rgba(255,77,77,0.06)" : "var(--panel,rgba(255,255,255,0.04))",
    backdropFilter: "blur(8px)",
  };
  return (
    <div style={panelStyle}>
      <div style={sectionTitle}>◈ 드로다운 현황</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 10, opacity: .5, fontWeight: 700 }}>현재 DD</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: isInDD ? "var(--red,#c0392b)" : "inherit" }}>
            {currentDD.toFixed(2)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, opacity: .5, fontWeight: 700 }}>최대 DD (기간 내)</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--red,#c0392b)" }}>{maxDD.toFixed(2)}%</div>
        </div>
        {isInDD && (
          <div>
            <div style={{ fontSize: 10, opacity: .5, fontWeight: 700 }}>원금 회복 필요 수익률</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--red,#c0392b)" }}>+{recoveryNeeded.toFixed(2)}%</div>
          </div>
        )}
      </div>
    </div>
  );
}
