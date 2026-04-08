"use client";
import React from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { DailyPnlPoint, DdSeriesPoint } from "@/types/dashboard";

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

const fmt = (v: number) => v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

// ── 일별 PnL 바 차트 (Recharts) ──────────────────────────────
export function DailyBarChart({ data, pnlFrom }: { data: DailyPnlPoint[]; pnlFrom?: string }) {
  if (!data?.length) return null;
  return (
    <div style={panel}>
      <div style={sectionTitle}>{`◈ 일별 PnL${pnlFrom ? " (사이클 기간)" : ""}`}</div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={d => d.slice(5)}
            tick={{ fontSize: 9, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false} width={36}
            tickFormatter={v => v >= 0 ? `+${v}` : `${v}`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--panel,#1a1a1a)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, fontSize: 12,
            }}
            formatter={(v: number) => [`${v >= 0 ? "+" : ""}${fmt(v)} USDT`, "PnL"]}
            labelFormatter={l => l}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? "rgba(0,192,118,0.75)" : "rgba(255,77,77,0.75)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 드로다운 차트 (Recharts AreaChart) ────────────────────────
export function DrawdownChart({ data }: { data: DdSeriesPoint[] }) {
  if (!data?.length || data.length < 2) return null;
  return (
    <div style={panel}>
      <div style={sectionTitle}>◈ 드로다운 추이</div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="rgba(255,77,77,0.5)" />
              <stop offset="95%" stopColor="rgba(255,77,77,0.02)" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={d => d.slice(5)}
            tick={{ fontSize: 9, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false} width={36}
            tickFormatter={v => `${v.toFixed(1)}%`}
            reversed
          />
          <Tooltip
            contentStyle={{
              background: "var(--panel,#1a1a1a)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, fontSize: 12,
            }}
            formatter={(v: number, name: string) => {
              if (name === "dd") return [`${v.toFixed(2)}%`, "드로다운"];
              return [`${v >= 0 ? "+" : ""}${fmt(v)} USDT`, "누적 PnL"];
            }}
            labelFormatter={l => l}
          />
          <Area
            type="monotone" dataKey="dd"
            stroke="rgba(255,77,77,0.85)" strokeWidth={2}
            fill="url(#ddGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 누적 PnL 차트 (Recharts AreaChart) ────────────────────────
export function CumPnlChart({ data }: { data: DdSeriesPoint[] }) {
  if (!data?.length || data.length < 2) return null;
  const lastVal = data[data.length - 1].cumPnl;
  const isPos   = lastVal >= 0;
  const color   = isPos ? "rgba(0,192,118,0.85)" : "rgba(255,77,77,0.85)";
  const gradId  = isPos ? "cumPnlGreenGrad" : "cumPnlRedGrad";

  return (
    <div style={panel}>
      <div style={sectionTitle}>◈ 누적 PnL 추이</div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={d => d.slice(5)}
            tick={{ fontSize: 9, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false} width={44}
            tickFormatter={v => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              background: "var(--panel,#1a1a1a)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, fontSize: 12,
            }}
            formatter={(v: number) => [`${v >= 0 ? "+" : ""}${fmt(v)} USDT`, "누적 PnL"]}
            labelFormatter={l => l}
          />
          <Area
            type="monotone" dataKey="cumPnl"
            stroke={color} strokeWidth={2}
            fill={`url(#${gradId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
