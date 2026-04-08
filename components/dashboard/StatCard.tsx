import React from "react";

interface Props {
  label: string;
  value: React.ReactNode;
  sub?:  string;
  color?: string;
}

export function StatCard({ label, value, sub, color }: Props) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 14,
      border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
      background: "var(--panel,rgba(255,255,255,0.04))",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{
        fontSize: 10, opacity: 0.4, fontWeight: 600,
        marginBottom: 8, letterSpacing: 0.8,
        textTransform: "uppercase" as const, fontFamily: "var(--font-mono,monospace)",
      }}>{label}</div>
      <div style={{
        fontWeight: 800, fontSize: 24,
        color: color || "var(--text-primary,rgba(255,255,255,.92))",
        fontFamily: "var(--font-mono,monospace)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.5px", lineHeight: 1.1,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, opacity: 0.38, marginTop: 5, fontFamily: "var(--font-mono,monospace)" }}>{sub}</div>}
    </div>
  );
}
