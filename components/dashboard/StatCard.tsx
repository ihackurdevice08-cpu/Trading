"use client";
import React from "react";
import { Sparkline } from "./Charts";

interface Props {
  label:       string;
  value:       React.ReactNode;
  sub?:        string;
  color?:      string;
  trend?:      number;        // 전일 대비 % (양수=상승, 음수=하락)
  sparkline?:  number[];      // 최근 7일 값 배열
}

export function StatCard({ label, value, sub, color, trend, sparkline }: Props) {
  const sparkColor = trend == null
    ? "rgba(128,128,128,0.4)"
    : trend >= 0 ? "rgba(0,192,118,0.6)" : "rgba(255,77,77,0.6)";

  return (
    <div style={{
      padding: "14px 16px", borderRadius: 14,
      border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
      background: "var(--panel,rgba(255,255,255,0.04))",
      backdropFilter: "blur(8px)",
      position: "relative", overflow: "hidden",
    }}>
      {/* 스파크라인 배경 */}
      {sparkline && sparkline.length > 1 && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, opacity: 0.35, pointerEvents: "none" }}>
          <Sparkline data={sparkline} color={sparkColor} />
        </div>
      )}

      {/* 레이블 + 트렌드 배지 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{
          fontSize: 10, opacity: 0.4, fontWeight: 600,
          letterSpacing: 0.8, textTransform: "uppercase" as const,
          fontFamily: "var(--font-mono,monospace)",
        }}>{label}</div>
        {trend != null && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
            background: trend >= 0 ? "rgba(0,192,118,0.12)" : "rgba(255,77,77,0.12)",
            color: trend >= 0 ? "var(--green,#0b7949)" : "var(--red,#c0392b)",
          }}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>

      {/* 값 */}
      <div style={{
        fontWeight: 800, fontSize: 22,
        color: color || "var(--text-primary,rgba(255,255,255,.92))",
        fontFamily: "var(--font-mono,monospace)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.5px", lineHeight: 1.1,
        position: "relative",
      }}>{value}</div>

      {sub && (
        <div style={{
          fontSize: 11, opacity: 0.38, marginTop: 5,
          fontFamily: "var(--font-mono,monospace)",
          position: "relative",
        }}>{sub}</div>
      )}
    </div>
  );
}
