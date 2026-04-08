"use client";
import React from "react";
import {
  ComposedChart, AreaChart, Area, Bar, Cell, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
  LineChart,
} from "recharts";
import type { DailyPnlPoint, DdSeriesPoint } from "@/types/dashboard";

export const panel: React.CSSProperties = {
  border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
  borderRadius: 14, padding: "16px 18px",
  background: "var(--panel,rgba(255,255,255,0.04))",
  backdropFilter: "blur(8px)",
};
export const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, opacity: 0.45,
  letterSpacing: 1.2, textTransform: "uppercase" as const,
  fontFamily: "var(--font-mono,monospace)", marginBottom: 12,
};

const tooltipStyle: React.CSSProperties = {
  background: "var(--panel,#1a1a1a)",
  border: "1px solid var(--line-soft,rgba(255,255,255,0.12))",
  borderRadius: 10, fontSize: 12, padding: "10px 14px",
  color: "var(--text-primary,rgba(255,255,255,0.9))",
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
};

const fmt = (v: number) => v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

// ── 스파크라인 (StatCard 배경 미니차트) ─────────────────────────
export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const pts = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={pts} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── 통합 차트: 일별 PnL(Bar) + 누적 PnL(Area) — ComposedChart ──
export function CombinedPnlChart({
  daily, dd, pnlFrom,
}: {
  daily:    DailyPnlPoint[];
  dd:       DdSeriesPoint[];
  pnlFrom?: string;
}) {
  if (!daily?.length) return null;

  // 날짜 기준으로 daily PnL과 누적 PnL 병합
  const ddMap  = Object.fromEntries(dd.map(d => [d.date, d.cumPnl]));
  const merged = daily.map(d => ({
    date:   d.date,
    pnl:    d.pnl,
    cumPnl: ddMap[d.date] ?? null,
  }));

  // 누적 PnL의 마지막 값으로 라인 색상 결정
  const lastCum  = dd.length ? dd[dd.length - 1].cumPnl : 0;
  const cumColor = lastCum >= 0 ? "rgba(0,192,118,0.9)" : "rgba(255,77,77,0.9)";
  const gradStop = lastCum >= 0 ? "rgba(0,192,118," : "rgba(255,77,77,";

  return (
    <div style={panel}>
      <div style={sectionTitle}>
        {`◈ PnL 차트${pnlFrom ? ` — ${pnlFrom} 이후` : ""}`}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={merged} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={`${gradStop}0.35)`} />
              <stop offset="95%" stopColor={`${gradStop}0.02)`} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--line-soft,rgba(255,255,255,0.06))"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={d => d.slice(5)}
            tick={{ fontSize: 10, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false}
            interval="preserveStartEnd"
          />
          {/* 왼쪽 Y축: 일별 PnL */}
          <YAxis
            yAxisId="pnl"
            tick={{ fontSize: 10, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false} width={48}
            tickFormatter={v => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`}
          />
          {/* 오른쪽 Y축: 누적 PnL */}
          <YAxis
            yAxisId="cum"
            orientation="right"
            tick={{ fontSize: 10, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false} width={48}
            tickFormatter={v => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`}
          />

          <ReferenceLine
            yAxisId="pnl" y={0}
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="4 4"
          />

          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number, name: string) => [
              `${v >= 0 ? "+" : ""}${fmt(v)} USDT`,
              name,
            ]}
            labelFormatter={l => `📅 ${l}`}
            separator=": "
          />
          <Legend
            iconType="circle" iconSize={8}
            wrapperStyle={{ fontSize: 11, opacity: 0.55, paddingTop: 6 }}
          />

          {/* 일별 PnL — Bar (양수 초록, 음수 빨강) */}
          <Bar
            yAxisId="pnl" dataKey="pnl" name="일별 PnL"
            radius={[3, 3, 0, 0]} maxBarSize={22}
          >
            {merged.map((d, i) => (
              <Cell
                key={i}
                fill={d.pnl >= 0 ? "rgba(0,192,118,0.8)" : "rgba(255,77,77,0.8)"}
              />
            ))}
          </Bar>

          {/* 누적 PnL — Area (마지막 값 기준 색상) */}
          <Area
            yAxisId="cum" dataKey="cumPnl" name="누적 PnL"
            type="monotone"
            stroke={cumColor} strokeWidth={2}
            fill="url(#cumGrad)"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 드로다운 차트 ──────────────────────────────────────────────
export function DrawdownChart({ data }: { data: DdSeriesPoint[] }) {
  if (!data?.length || data.length < 2) return null;
  return (
    <div style={panel}>
      <div style={sectionTitle}>◈ 드로다운 추이</div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="rgba(255,77,77,0.45)" />
              <stop offset="95%" stopColor="rgba(255,77,77,0.02)" />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--line-soft,rgba(255,255,255,0.06))"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={d => d.slice(5)}
            tick={{ fontSize: 10, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgba(128,128,128,0.6)" }}
            axisLine={false} tickLine={false} width={40}
            tickFormatter={v => `${v.toFixed(1)}%`}
            reversed
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => [`${(v as number).toFixed(2)}%`, "드로다운"]}
            labelFormatter={l => `📅 ${l}`}
          />
          <Area
            type="monotone" dataKey="dd"
            stroke="rgba(255,77,77,0.85)" strokeWidth={2}
            fill="url(#ddGrad)" dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// 하위 호환 stub
export function DailyBarChart() { return null; }
export function CumPnlChart()   { return null; }
