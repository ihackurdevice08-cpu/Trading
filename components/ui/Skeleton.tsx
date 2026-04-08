"use client";
import React from "react";

interface SkeletonProps {
  width?:  string | number;
  height?: string | number;
  radius?: number;
  style?:  React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 20, radius = 8, style }: SkeletonProps) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "var(--line-soft,rgba(255,255,255,0.08))",
      animation: "skeleton-pulse 1.4s ease-in-out infinite",
      ...style,
    }} />
  );
}

// 대시보드 Hero 카드 스켈레톤
export function StatCardSkeleton() {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 14,
      border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
      background: "var(--panel,rgba(255,255,255,0.04))",
    }}>
      <Skeleton width={60} height={10} style={{ marginBottom: 12 }} />
      <Skeleton width="70%" height={28} style={{ marginBottom: 8 }} />
      <Skeleton width={90} height={10} />
    </div>
  );
}

// 차트 영역 스켈레톤
export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div style={{
      borderRadius: 14, padding: "16px 18px",
      border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
      background: "var(--panel,rgba(255,255,255,0.04))",
    }}>
      <Skeleton width={120} height={11} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={height} radius={10} />
    </div>
  );
}

// 거래 행 스켈레톤
export function TradeRowSkeleton() {
  return (
    <div style={{
      border: "1px solid var(--line-soft)", borderRadius: 10,
      padding: "12px 14px", display: "flex", justifyContent: "space-between",
      background: "var(--panel)",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton width={80} height={14} />
        <Skeleton width={110} height={10} />
      </div>
      <Skeleton width={60} height={18} />
    </div>
  );
}
