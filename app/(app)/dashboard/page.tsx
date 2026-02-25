"use client";

import { useEffect, useState, useCallback } from "react";

function fmt(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return sign + v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function pct(cur: number, tar: number) {
  if (!tar) return 0;
  return Math.min(100, (cur / tar) * 100);
}

function PnLBadge({ v }: { v: number | null }) {
  if (v == null || !Number.isFinite(v)) return <span style={{ opacity: 0.4 }}>—</span>;
  const color = v > 0 ? "var(--green)" : v < 0 ? "var(--red)" : "inherit";
  return <span style={{ color, fontWeight: 800 }}>{fmt(v)}</span>;
}

function StatCard({ icon, title, value, sub, accent }: {
  icon: string; title: string; value: React.ReactNode; sub?: string; accent?: boolean;
}) {
  return (
    <div style={{
      border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
      padding: "12px 14px", borderRadius: 12,
      background: accent ? "rgba(184,154,90,0.06)" : "var(--panel, rgba(255,255,255,0.72))",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 13, opacity: 0.5 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: 0.2 }}>{title}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch("/api/dashboard",  { cache: "no-store" }).then(r => r.json()),
        fetch("/api/goals-v2",   { cache: "no-store" }).then(r => r.json()),
      ]);
      if (a.ok) setStats(a.stats);
      else      setErr(a.error || "데이터를 불러오지 못했습니다");
      if (b.ok) setGoals(b.goals || []);
      setLastUpdated(new Date());
    } catch (e: any) {
      setErr(e?.message || "네트워크 오류");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    window.addEventListener("trades-updated", load);
    return () => { clearInterval(id); window.removeEventListener("trades-updated", load); };
  }, [load]);

  if (err)   return <ErrBox msg={err} />;
  if (!stats) return <Loading />;

  const activeGoals = goals.filter(g => g.status === "active");

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* 타이틀 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>대시보드</h1>
        {lastUpdated && (
          <span style={{ fontSize: 11, opacity: 0.4 }}>
            {lastUpdated.toLocaleTimeString("ko-KR")} 기준 · 30초마다 갱신
          </span>
        )}
      </div>

      {/* PnL 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, marginBottom: 10 }}>
        <StatCard icon="◈" title="오늘"    value={<PnLBadge v={stats.todayPnL}  />} sub="USDT" />
        <StatCard icon="◈" title="이번 주" value={<PnLBadge v={stats.weekPnL}   />} sub="USDT" />
        <StatCard icon="◈" title="이번 달" value={<PnLBadge v={stats.monthPnL}  />} sub="USDT" />
      </div>

      {/* 거래 통계 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, marginBottom: 20 }}>
        <StatCard icon="◉" title="총 거래"  value={stats.totalTrades ?? "—"} sub="건" />
        <StatCard icon="◎" title="승률"
          value={stats.winRate != null ? `${stats.winRate.toFixed(1)}%` : "—"}
          sub={stats.wins != null ? `${stats.wins}승 ${stats.losses}패` : ""} />
        <StatCard icon="◉" title="PnL 기록" value={stats.realizedTrades ?? "—"} sub="건 입력" />
      </div>

      {/* 진행중 목표 */}
      {activeGoals.length > 0 && (
        <section>
          <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 900, opacity: 0.7, letterSpacing: 0.3 }}>
            ◎ 진행중 목표
          </h2>
          <div style={{ display: "grid", gap: 8 }}>
            {activeGoals.map(g => {
              const cur = Number(g.current_value || 0);
              const tgt = Number(g.target_value || 1);
              const p = pct(cur, tgt);
              const isBool = g.type === "boolean";
              return (
                <div key={g.id} style={{
                  border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
                  padding: "11px 14px", borderRadius: 12,
                  background: "var(--panel, rgba(255,255,255,0.72))",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{g.title}</span>
                    <span style={{ opacity: 0.55, fontSize: 12 }}>
                      {isBool ? "체크" : `${cur.toLocaleString("ko-KR")} / ${tgt.toLocaleString("ko-KR")}`}
                    </span>
                  </div>
                  {!isBool && (
                    <div style={{ height: 5, borderRadius: 999, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                      <div style={{ width: p + "%", height: "100%",
                        background: "var(--accent, #B89A5A)", borderRadius: 999 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <style>{`
        :root { --green: #0b7949; --red: #c0392b; }
      `}</style>
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(192,57,43,0.08)",
      border: "1px solid rgba(192,57,43,0.2)", color: "#c0392b", fontSize: 14 }}>
      ◬ {msg}
    </div>
  );
}
function Loading() {
  return <div style={{ padding: 20, opacity: 0.5, fontSize: 14 }}>불러오는 중…</div>;
}
