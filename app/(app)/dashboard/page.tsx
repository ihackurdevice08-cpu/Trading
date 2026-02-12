"use client";

import { useEffect, useMemo, useState } from "react";

type DashStats = {
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

type GoalV2 = {
  id: string;
  title: string;
  type: "pnl" | "withdrawal" | "counter" | "boolean" | "discipline" | string;
  mode: "auto" | "manual" | "hybrid" | string;
  period: "daily" | "weekly" | "monthly" | "none" | string;
  target_value: number | null;
  current_value: number | null;
  unit: string;
  status: "active" | "completed" | "archived" | string;
};

function fmt(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function pct(cur: number, target: number) {
  if (!Number.isFinite(cur) || !Number.isFinite(target) || target === 0) return 0;
  const p = (cur / target) * 100;
  return Math.max(0, Math.min(200, p)); // 200% cap
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [goals, setGoals] = useState<GoalV2[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const [a, b] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/goals-v2", { cache: "no-store" }).then((r) => r.json()),
      ]);

      if (!a.ok) throw new Error(a.error || "dashboard api error");
      if (!b.ok) throw new Error(b.error || "goals-v2 api error");

      setStats(a.stats);
      setGoals(b.goals || []);
    } catch (e: any) {
      setErr(e?.message || "error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeGoals = useMemo(
    () => (goals || []).filter((g) => (g.status || "active") === "active"),
    [goals]
  );

  if (err) return <div style={{ padding: 20 }}>Error: {err}</div>;
  if (!stats) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Dashboard</h1>
        <button onClick={load} style={S.btn}>새로고침</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 18 }}>
        <Card title="오늘 PnL" value={fmt(stats.todayPnL)} />
        <Card title="이번 주 PnL" value={fmt(stats.weekPnL)} />
        <Card title="이번 달 PnL" value={fmt(stats.monthPnL)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 16 }}>
        <Card title="총 거래수" value={String(stats.tradesCount)} />
        <Card title="승률" value={(stats.winRate * 100).toFixed(1) + "%"} />
        <Card title="평균 PnL" value={fmt(stats.avgPnl)} />
      </div>

      {/* ✅ Goals 연결 섹션 */}
      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Active Goals</h2>
          <a href="/goals-engine" style={{ ...S.link }}>Goals Engine 열기</a>
        </div>

        {activeGoals.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.7 }}>
            활성 목표가 없습니다. Goals Engine에서 목표를 생성하세요.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 12 }}>
            {activeGoals.map((g) => {
              const cur = Number(g.current_value ?? 0);
              const tar = Number(g.target_value ?? 0);
              const progress = pct(cur, tar);
              const right = tar ? `${fmt(cur)} / ${fmt(tar)} ${g.unit || ""}` : `${fmt(cur)} ${g.unit || ""}`;

              return (
                <div key={g.id} style={S.goalCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 900 }}>{g.title}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {g.type}{g.type === "pnl" ? ` · ${g.period}` : ""}{g.mode ? ` · ${g.mode}` : ""}
                    </div>
                  </div>

                  <div style={{ marginTop: 8, opacity: 0.85 }}>{right}</div>

                  <div style={S.barWrap}>
                    <div style={{ ...S.barFill, width: `${progress}%` }} />
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                    Progress: {progress.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

const S: any = {
  btn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,.10)",
    background: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  link: {
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
    borderBottom: "1px solid rgba(0,0,0,.25)",
    color: "#111",
    paddingBottom: 2,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,.08)",
    background: "white",
  },
  goalCard: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,.08)",
    background: "white",
  },
  barWrap: {
    height: 10,
    borderRadius: 999,
    background: "rgba(0,0,0,.06)",
    overflow: "hidden",
    marginTop: 10,
  },
  barFill: {
    height: "100%",
    background: "rgba(0,0,0,.55)",
  },
};
