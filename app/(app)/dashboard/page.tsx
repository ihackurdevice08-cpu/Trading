"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

function fmt(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  const sign = v > 0 ? "+" : "";
  return sign + v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function pct(cur: number, tar: number) {
  if (!tar) return 0;
  return Math.min(200, (cur / tar) * 100);
}

function PnLValue({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(Number(value))) return <span>-</span>;
  const v = Number(value);
  const color = v > 0 ? "#0b7949" : v < 0 ? "#bc0a07" : "inherit";
  return <span style={{ color, fontWeight: 700 }}>{fmt(v)}</span>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/goals-v2", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (a.ok) setStats(a.stats);
      else setErr(a.error || "대시보드 로드 실패");
      if (b.ok) setGoals(b.goals || []);
      setLastUpdated(new Date());
    } catch (e: any) {
      setErr(e?.message || "error");
    }
  }, []);

  useEffect(() => {
    load();

    // 30초 폴링 (15초→30초, 대시보드는 실시간 불필요)
    const id = setInterval(load, 30000);

    // 거래 추가/삭제 시 즉시 갱신
    window.addEventListener("trades-updated", load);

    return () => {
      clearInterval(id);
      window.removeEventListener("trades-updated", load);
    };
  }, [load]);

  if (err) return <div style={{ padding: 20, color: "#bc0a07" }}>오류: {err}</div>;
  if (!stats) return <div style={{ padding: 20, opacity: 0.7 }}>불러오는 중...</div>;

  const activeGoals = goals.filter((g) => g.status === "active");

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Dashboard</h1>
        {lastUpdated && (
          <span style={{ fontSize: 12, opacity: 0.55 }}>
            {lastUpdated.toLocaleTimeString("ko-KR")} 기준
          </span>
        )}
      </div>

      {/* PnL 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard title="오늘" value={<PnLValue value={stats.todayPnL} />} sub="USDT" />
        <StatCard title="이번 주" value={<PnLValue value={stats.weekPnL} />} sub="USDT" />
        <StatCard title="이번 달" value={<PnLValue value={stats.monthPnL} />} sub="USDT" />
      </div>

      {/* 거래 통계 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard
          title="총 거래"
          value={<span>{stats.totalTrades ?? "-"}</span>}
          sub="건"
        />
        <StatCard
          title="승률"
          value={
            <span>
              {stats.winRate != null ? `${stats.winRate.toFixed(1)}%` : "-"}
            </span>
          }
          sub={stats.wins != null ? `${stats.wins}승 ${stats.losses}패` : ""}
        />
        <StatCard
          title="실현된 거래"
          value={<span>{stats.realizedTrades ?? "-"}</span>}
          sub="PnL 입력됨"
        />
      </div>

      {/* 진행 중인 목표 */}
      {activeGoals.length > 0 && (
        <div>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 900 }}>진행중 목표</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {activeGoals.map((g) => {
              const cur = Number(g.current_value || 0);
              const tgt = Number(g.target_value || 1);
              const progress = pct(cur, tgt);
              const isBool = g.type === "boolean";
              return (
                <div key={g.id} style={{ border: "1px solid var(--line-soft,#eee)", padding: 12, borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <b>{g.title}</b>
                    <span style={{ opacity: 0.7, fontSize: 13 }}>
                      {isBool ? "체크" : `${cur.toLocaleString()} / ${tgt.toLocaleString()}`}
                    </span>
                  </div>
                  {!isBool && (
                    <div style={{ background: "rgba(0,0,0,0.08)", height: 6, borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: progress + "%", height: "100%", background: "var(--accent,#333)", borderRadius: 999 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{
      border: "1px solid var(--line-soft,#eee)",
      padding: 16,
      borderRadius: 12,
      background: "var(--panel,white)",
    }}>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
