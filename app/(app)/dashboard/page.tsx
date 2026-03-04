"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAppearance } from "@/components/providers/AppearanceProvider";

const RiskMiniWidget = dynamic(() => import("@/components/RiskMiniWidget"), { ssr: false });

const toN  = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt  = (v: any, d = 2) => toN(v).toLocaleString("ko-KR", { maximumFractionDigits: d });
const sign = (v: number) => v > 0 ? "+" : "";
const pnlColor = (v: number) => v > 0 ? "var(--green,#0b7949)" : v < 0 ? "var(--red,#c0392b)" : "inherit";

function StatCard({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12,
      border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
      background: "var(--panel,rgba(255,255,255,0.72))" }}>
      <div style={{ fontSize: 10, opacity: 0.55, fontWeight: 700, marginBottom: 4, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 15, color: color || "inherit" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, opacity: 0.45, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function DailyBarChart({ data }: { data: { date: string; pnl: number }[] }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => Math.abs(d.pnl)), 1);
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, marginBottom: 12,
      border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
      background: "var(--panel,rgba(255,255,255,0.72))" }}>
      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.55, marginBottom: 10 }}>◈ 이번 달 일별 PnL</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60, overflowX: "auto" }}>
        {data.map(d => {
          const h   = Math.max(4, Math.abs(d.pnl) / max * 56);
          const pos = d.pnl >= 0;
          return (
            <div key={d.date} style={{ display: "flex", flexDirection: "column",
              alignItems: "center", flex: "0 0 auto", minWidth: 20 }}
              title={`${d.date}: ${sign(d.pnl)}${fmt(d.pnl)} USDT`}>
              <div style={{ width: 14, height: h, borderRadius: 3,
                background: pos ? "var(--green,#0b7949)" : "var(--red,#c0392b)", opacity: 0.8 }} />
              <div style={{ fontSize: 9, opacity: 0.4, marginTop: 2 }}>{d.date.slice(8)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { appearance, patchAppearance } = useAppearance();
  const rw = appearance.riskWidget ?? { dashboard: true, trades: true };

  const [stats,       setStats]       = useState<any>(null);
  const [goals,       setGoals]       = useState<any[]>([]);
  const [recent,      setRecent]      = useState<any[]>([]);
  const [topSymbols,  setTopSymbols]  = useState<any[]>([]);
  const [dailyPnl,    setDailyPnl]    = useState<any[]>([]);
  const [err,         setErr]         = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pnlFrom,     setPnlFrom]     = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("pnl_from") ?? "") : ""
  );

  const load = useCallback(async (from?: string) => {
    const f = from !== undefined ? from : (typeof window !== "undefined" ? localStorage.getItem("pnl_from") ?? "" : "");
    try {
      const qs = f ? `?from=${encodeURIComponent(f)}` : "";
      const [a, b] = await Promise.all([
        fetch(`/api/dashboard${qs}`, { cache: "no-store" }).then(r => r.json()),
        fetch("/api/goals-v2",       { cache: "no-store" }).then(r => r.json()),
      ]);
      if (a.ok) {
        setStats(a.stats);
        setRecent(a.recent || []);
        setTopSymbols(a.topSymbols || []);
        setDailyPnl(a.dailyPnl || []);
      } else { setErr(a.error || "불러오기 실패"); }
      if (b.ok) setGoals(b.goals || []);
      setLastUpdated(new Date());
    } catch (e: any) { setErr(e?.message || "네트워크 오류"); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    window.addEventListener("trades-updated", load);
    return () => { clearInterval(id); window.removeEventListener("trades-updated", load); };
  }, [load]);

  function handlePnlFromChange(val: string) {
    setPnlFrom(val);
    localStorage.setItem("pnl_from", val);
    load(val);
  }

  function toggleRiskWidget() {
    const next = !rw.dashboard;
    if (!next && !rw.trades) return;
    patchAppearance({ riskWidget: { ...rw, dashboard: next } });
  }

  if (err)    return <div style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14,
    background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,.2)",
    color: "var(--red,#c0392b)" }}>◬ {err}</div>;
  if (!stats) return <div style={{ padding: 20, opacity: .5, fontSize: 14 }}>불러오는 중…</div>;

  const s = stats;
  const activeGoals = goals.filter(g => g.status === "active");

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>대시보드</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, opacity: .4 }}>
              {lastUpdated.toLocaleTimeString("ko-KR")} 기준
            </span>
          )}
          {/* 누적 PnL 기산일 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, opacity: 0.5, whiteSpace: "nowrap" }}>누적 기준</span>
            <input type="date" value={pnlFrom}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => handlePnlFromChange(e.target.value)}
              style={{ padding: "3px 8px", borderRadius: 7, fontSize: 11,
                border: "1px solid var(--line-soft,rgba(0,0,0,.12))",
                background: "rgba(0,0,0,.04)", color: "inherit", outline: "none" }} />
            {pnlFrom && (
              <button onClick={() => handlePnlFromChange("")}
                style={{ padding: "3px 7px", borderRadius: 6, fontSize: 11,
                  border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
                  background: "transparent", cursor: "pointer", opacity: 0.5 }}>✕</button>
            )}
          </div>
          <button onClick={toggleRiskWidget} style={{
            padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
            cursor: "pointer", border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
            background: rw.dashboard ? "rgba(0,0,0,0.07)" : "transparent",
            opacity: rw.dashboard ? 1 : .5 }}>
            ◬ 리스크
          </button>
        </div>
      </div>

      {rw.dashboard && <RiskMiniWidget />}

      {/* PnL 요약 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 8 }}>
        <StatCard label="오늘 PnL"    value={`${sign(s.todayPnL)}${fmt(s.todayPnL)}`}  sub="USDT" color={pnlColor(s.todayPnL)} />
        <StatCard label="이번 주 PnL" value={`${sign(s.weekPnL)}${fmt(s.weekPnL)}`}    sub="USDT" color={pnlColor(s.weekPnL)} />
        <StatCard label="이번 달 PnL" value={`${sign(s.monthPnL)}${fmt(s.monthPnL)}`}  sub="USDT" color={pnlColor(s.monthPnL)} />
        <StatCard label="누적 PnL"
          value={`${sign(s.cumPnl)}${fmt(s.cumPnl)}`}
          sub={pnlFrom ? `${pnlFrom} 이후` : "전체 기간"}
          color={pnlColor(s.cumPnl)} />
      </div>

      {/* 계좌 현황 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 12 }}>
        <StatCard label="최초 시드"      value={`${fmt(s.seed)} USDT`} />
        <StatCard label="현재 자산"      value={`${fmt(s.equityNow)} USDT`}
          sub={`시드 대비 ${sign(s.equityNow - s.seed)}${fmt(s.equityNow - s.seed)}`}
          color={pnlColor(s.equityNow - s.seed)} />
        <StatCard label="총 출금"        value={`${fmt(s.totalWithdrawal)} USDT`} />
        <StatCard label="계좌 잔류 수익" value={`${sign(s.retainedProfit)}${fmt(s.retainedProfit)} USDT`}
          sub="현재자산 - 남은원금" color={pnlColor(s.retainedProfit)} />
        <StatCard label="이번 달 승률"   value={`${s.winRate != null ? s.winRate.toFixed(1) : "—"}%`}
          sub={`${s.wins}승 ${s.losses}패 / ${s.totalTrades}건`} />
      </div>

      <DailyBarChart data={dailyPnl} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {topSymbols.length > 0 && (
          <div style={{ padding: "14px 16px", borderRadius: 12,
            border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
            background: "var(--panel,rgba(255,255,255,0.72))" }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.55, marginBottom: 10 }}>◉ 심볼별 PnL (이번 달)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topSymbols.map(sym => (
                <div key={sym.symbol} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{sym.symbol}</span>
                    <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 6 }}>{sym.count}건 · {sym.winRate}%</span>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: pnlColor(sym.pnl) }}>
                    {sign(sym.pnl)}{fmt(sym.pnl)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {recent.length > 0 && (
          <div style={{ padding: "14px 16px", borderRadius: 12,
            border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
            background: "var(--panel,rgba(255,255,255,0.72))" }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.55, marginBottom: 10 }}>◎ 최근 거래</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recent.map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{t.symbol}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, marginLeft: 5, padding: "1px 5px", borderRadius: 4,
                      background: t.side === "long" ? "rgba(11,121,73,0.12)" : "rgba(192,57,43,0.12)",
                      color: t.side === "long" ? "var(--green,#0b7949)" : "var(--red,#c0392b)" }}>
                      {t.side?.toUpperCase()}
                    </span>
                    <div style={{ fontSize: 10, opacity: 0.4, marginTop: 1 }}>
                      {t.opened_at?.slice(0, 16).replace("T", " ")}
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: t.pnl != null ? pnlColor(toN(t.pnl)) : "inherit" }}>
                    {t.pnl != null ? `${sign(toN(t.pnl))}${fmt(t.pnl)}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeGoals.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.55, marginBottom: 8, letterSpacing: 0.3 }}>◎ 진행중 목표</div>
          <div style={{ display: "grid", gap: 8 }}>
            {activeGoals.map(g => {
              const cur = toN(g.current_value), tgt = toN(g.target_value || 1);
              const p = Math.min(100, tgt > 0 ? (cur / tgt) * 100 : 0);
              const isBool = g.type === "boolean";
              return (
                <div key={g.id} style={{ padding: "11px 14px", borderRadius: 12,
                  border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
                  background: "var(--panel,rgba(255,255,255,0.72))" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{g.title}</span>
                    <span style={{ opacity: .55, fontSize: 12 }}>
                      {isBool ? "체크" : `${cur.toLocaleString("ko-KR")} / ${tgt.toLocaleString("ko-KR")}`}
                    </span>
                  </div>
                  {!isBool && (
                    <div style={{ height: 5, borderRadius: 999, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                      <div style={{ width: p + "%", height: "100%",
                        background: "var(--accent,#B89A5A)", borderRadius: 999, transition: "width 0.3s" }} />
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
