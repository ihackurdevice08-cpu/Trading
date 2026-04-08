"use client";
import React from "react";
import type { HeatmapCell } from "@/types/dashboard";

const DOW_LABELS = ["월","화","수","목","금","토","일"];

const panel: React.CSSProperties = {
  border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
  borderRadius: 14, padding: "16px 18px",
  background: "var(--panel,rgba(255,255,255,0.04))",
  backdropFilter: "blur(8px)",
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, opacity: 0.45,
  letterSpacing: 1.2, textTransform: "uppercase" as const,
  fontFamily: "var(--font-mono,monospace)", marginBottom: 0,
};

function cellColor(wr: number | null, total: number) {
  if (total === 0 || wr === null) return "rgba(255,255,255,0.03)";
  if (wr >= 70) return `rgba(11,121,73,${0.15 + (wr-70)/30 * 0.45})`;
  if (wr >= 50) return `rgba(11,121,73,${0.08 + (wr-50)/20 * 0.07})`;
  if (wr >= 30) return `rgba(192,57,43,${0.08 + (50-wr)/20 * 0.07})`;
  return `rgba(192,57,43,${0.15 + (30-wr)/30 * 0.35})`;
}

const fmt = (v: number) => v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

export function HourlyHeatmap({ data }: { data: HeatmapCell[] }) {
  if (!data?.length) return null;

  // 거래가 있는 시간대만 표시 (빈 시간대 제거)
  const activeHours = Array.from(new Set(
    data.filter(d => d.total > 0).map(d => d.hour)
  )).sort((a, b) => a - b);

  if (activeHours.length === 0) return null;

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={sectionTitle}>◈ 요일×시간대 승률 (최근 90일)</div>
        <div style={{ display: "flex", gap: 8, fontSize: 10, opacity: .5 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(11,121,73,0.5)", display: "inline-block" }} />승률 高
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(192,57,43,0.5)", display: "inline-block" }} />승률 低
          </span>
        </div>
      </div>
      <div style={{ overflowX: "auto" as const }}>
        <table style={{ borderCollapse: "collapse", fontSize: 10, width: "100%",
          minWidth: Math.max(280, activeHours.length * 34 + 40) }}>
          <thead>
            <tr>
              <th style={{ width: 28, padding: "2px 4px", opacity: .4, fontWeight: 600 }} />
              {activeHours.map(h => (
                <th key={h} style={{ padding: "2px 3px", opacity: .45, fontWeight: 600,
                  textAlign: "center" as const, minWidth: 28 }}>{h}시</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOW_LABELS.map((dow, d) => (
              <tr key={d}>
                <td style={{ padding: "2px 4px", fontWeight: 700, opacity: .6, whiteSpace: "nowrap" as const }}>{dow}</td>
                {activeHours.map(h => {
                  const cell = data.find(x => x.dow === d && x.hour === h);
                  const wr   = cell?.winRate ?? null;
                  const tot  = cell?.total ?? 0;
                  const pnl  = cell?.pnl ?? 0;
                  return (
                    <td key={h} style={{ padding: "2px 3px", textAlign: "center" as const }}
                      title={tot > 0 ? `${dow} ${h}시: ${tot}건 | 승률 ${wr ?? "—"}% | PnL ${pnl >= 0 ? "+" : ""}${fmt(pnl)}` : ""}>
                      <div style={{
                        width: 26, height: 22, borderRadius: 4, margin: "0 auto",
                        background: cellColor(wr, tot),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700,
                        color: tot === 0 ? "transparent" : wr !== null && (wr >= 60 || wr <= 40) ? "white" : "inherit",
                      }}>
                        {tot > 0 && wr !== null ? `${wr}%` : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
