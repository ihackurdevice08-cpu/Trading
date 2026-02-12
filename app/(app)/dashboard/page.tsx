"use client";

import { useEffect, useState } from "react";

type Stats = {
  monthPnL: number;
  weekPnL: number;
  todayPnL: number;
  tradesCount: number;
  realizedCount: number;
  win: number;
  loss: number;
  winRate: number;
  avgPnl: number;
};

function fmt(n: number) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "API error");
      setStats(j.stats);
    } catch (e: any) {
      setErr(e?.message || "error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (err) {
    return <div style={{ padding: 20 }}>Error: {err}</div>;
  }

  if (!stats) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 20 }}>
        <Card title="오늘 PnL" value={fmt(stats.todayPnL)} />
        <Card title="이번 주 PnL" value={fmt(stats.weekPnL)} />
        <Card title="이번 달 PnL" value={fmt(stats.monthPnL)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 20 }}>
        <Card title="총 거래수" value={stats.tradesCount.toString()} />
        <Card title="승률" value={(stats.winRate * 100).toFixed(1) + "%"} />
        <Card title="평균 PnL" value={fmt(stats.avgPnl)} />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,.08)",
      background: "white"
    }}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}
