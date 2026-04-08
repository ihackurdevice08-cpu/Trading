"use client";
import useSWR from "swr";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useLocalStorage } from "@/hooks/useLocalStorage";

// 분리된 컴포넌트
import { StatCard }         from "@/components/dashboard/StatCard";
import { DDCard }           from "@/components/dashboard/DDCard";
import { TradingKPI }       from "@/components/dashboard/TradingKPI";
import { HourlyHeatmap }    from "@/components/dashboard/HourlyHeatmap";
import { SymbolTable }      from "@/components/dashboard/SymbolTable";
import { MonthlyPnlTable }  from "@/components/dashboard/MonthlyPnlTable";
import { DailyBarChart, DrawdownChart, CumPnlChart } from "@/components/dashboard/Charts";

// 타입
import type { DashboardResponse, Goal } from "@/types/dashboard";

const RiskMiniWidget = dynamic(() => import("@/components/RiskMiniWidget"), { ssr: false });

const toN      = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt      = (v: unknown, d = 2) => toN(v).toLocaleString("ko-KR", { maximumFractionDigits: d });
const sign     = (v: number) => v > 0 ? "+" : "";
const pnlColor = (v: number) => v > 0 ? "var(--green,#0b7949)" : v < 0 ? "var(--red,#c0392b)" : "inherit";

// SWR fetcher
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(r => r.json());

const panel: React.CSSProperties = {
  padding: "16px 18px", borderRadius: 14, marginBottom: 12,
  border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
  background: "var(--panel,rgba(255,255,255,0.04))",
  backdropFilter: "blur(8px)",
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, opacity: 0.45, marginBottom: 12,
  letterSpacing: 1.2, textTransform: "uppercase" as const,
  fontFamily: "var(--font-mono,monospace)",
};

export default function DashboardPage() {
  const { appearance, patchAppearance } = useAppearance();
  const rw = appearance.riskWidget ?? { dashboard: true, trades: true };

  // Phase 1: localStorage Hydration Mismatch 방지 — useLocalStorage 커스텀 훅
  const [pnlFrom, setPnlFrom] = useLocalStorage<string>("pnl_from", "");

  const dashQs = pnlFrom ? `?from=${encodeURIComponent(pnlFrom)}` : "";

  // Phase 1: SWR — refetchOnWindowFocus + 활성 탭일 때만 60초 폴링
  const { data: dashData, error: dashErr, mutate: mutateDash } =
    useSWR<DashboardResponse>(`/api/dashboard${dashQs}`, fetcher, {
      refreshInterval:      60_000,   // 활성 탭일 때만 1분 폴링
      revalidateOnFocus:    true,     // 탭 복귀 시 즉시 갱신
      revalidateOnReconnect:true,     // 네트워크 복구 시 갱신
    });

  const { data: goalsData } = useSWR("/api/goals-v2", fetcher, {
    refreshInterval:   300_000,  // 목표는 5분마다 (잘 안 바뀜)
    revalidateOnFocus: true,
  });

  // 거래 업데이트 이벤트 수신 → SWR 즉시 재검증
  useEffect(() => {
    const handler = () => mutateDash();
    window.addEventListener("trades-updated", handler);
    return () => window.removeEventListener("trades-updated", handler);
  }, [mutateDash]);

  function handlePnlFromChange(val: string) {
    setPnlFrom(val);
    // SWR 캐시 키가 바뀌므로 자동으로 재요청됨
  }

  function toggleRiskWidget() {
    const next = !rw.dashboard;
    if (!next && !rw.trades) return;
    patchAppearance({ riskWidget: { ...rw, dashboard: next } });
  }

  if (dashErr) return (
    <div style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14,
      background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,.2)",
      color: "var(--red,#c0392b)" }}>◬ 데이터 로드 실패</div>
  );
  if (!dashData?.ok) return (
    <div style={{ padding: 20, opacity: .5, fontSize: 14 }}>불러오는 중…</div>
  );

  const s          = dashData.stats;
  const recent     = dashData.recent ?? [];
  const topSymbols = dashData.topSymbols ?? [];
  const dailyPnl   = dashData.dailyPnl ?? [];
  const ddSeries   = dashData.ddSeries ?? [];
  const heatmap    = dashData.heatmapData ?? [];
  const monthlyPnl = dashData.monthlyPnl ?? [];
  const goals      = (goalsData?.goals ?? []) as Goal[];
  const activeGoals = goals.filter(g => !g.completed);

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>대시보드</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, opacity: 0.5, whiteSpace: "nowrap" as const }}>누적 기준</span>
            <input type="date" value={pnlFrom} max={new Date().toISOString().slice(0, 10)}
              onChange={e => handlePnlFromChange(e.target.value)}
              style={{ padding: "3px 8px", borderRadius: 7, fontSize: 11,
                border: "1px solid var(--line-soft,rgba(0,0,0,.12))",
                background: "rgba(255,255,255,0.06)", color: "inherit", outline: "none" }} />
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
            background: rw.dashboard ? "rgba(240,180,41,0.12)" : "transparent",
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
        <StatCard label="누적 PnL"    value={`${sign(s.cumPnl)}${fmt(s.cumPnl)}`}
          sub={pnlFrom ? `${pnlFrom} 이후` : "전체 기간"} color={pnlColor(s.cumPnl)} />
      </div>

      {/* 계좌 현황 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 12 }}>
        <StatCard label="최초 시드"  value={`${fmt(s.seed)} USDT`} />
        <StatCard label="현재 자산"  value={`${fmt(s.equityNow)} USDT`}
          sub={`시드 대비 ${sign(s.equityNow - s.seed)}${fmt(s.equityNow - s.seed)}`}
          color={pnlColor(s.equityNow - s.seed)} />
        <StatCard label="총 출금"    value={`${fmt(s.totalWithdrawal)} USDT`} />
        <StatCard
          label={pnlFrom ? "사이클 승률" : "전체 승률"}
          value={`${s.cycleWinRate != null ? s.cycleWinRate.toFixed(1) : s.winRate != null ? s.winRate.toFixed(1) : "—"}%`}
          sub={`${s.wins}승 ${s.losses}패 / ${s.realizedTrades}건`}
        />
      </div>

      {/* 드로다운 현황 */}
      <DDCard stats={s} />

      {/* 차트 2개 나란히 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <DailyBarChart data={dailyPnl} pnlFrom={pnlFrom} />
        <CumPnlChart   data={ddSeries} />
      </div>

      {/* 드로다운 추이 */}
      <DrawdownChart data={ddSeries} />

      {/* 히트맵 */}
      <HourlyHeatmap data={heatmap} />

      {/* 트레이딩 KPI */}
      <TradingKPI stats={s} pnlFrom={pnlFrom} />

      {/* 월별 PnL */}
      <MonthlyPnlTable data={monthlyPnl} />

      {/* 심볼별 분석 */}
      <SymbolTable symbols={topSymbols} pnlFrom={pnlFrom} />

      {/* 최근 거래 */}
      {recent.length > 0 && (
        <div style={panel}>
          <div style={sectionTitle}>◎ 최근 거래</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
            {recent.map(t => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{t.symbol}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, marginLeft: 5, padding: "1px 5px", borderRadius: 4,
                    background: t.side === "long" ? "rgba(11,121,73,0.12)" : "rgba(192,57,43,0.12)",
                    color: t.side === "long" ? "var(--green,#0b7949)" : "var(--red,#c0392b)" }}>
                    {t.side?.toUpperCase()}
                  </span>
                  <div style={{ fontSize: 10, opacity: 0.4, marginTop: 1 }}>{t.opened_at?.slice(0, 16).replace("T", " ")}</div>
                </div>
                <span style={{ fontWeight: 800, fontSize: 13, color: t.pnl != null ? pnlColor(toN(t.pnl)) : "inherit" }}>
                  {t.pnl != null ? `${sign(toN(t.pnl))}${fmt(t.pnl)}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 진행중 목표 */}
      {activeGoals.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.55, marginBottom: 8, letterSpacing: 0.3 }}>◎ 진행중 목표</div>
          <div style={{ display: "grid", gap: 8 }}>
            {activeGoals.map(g => {
              const cur = toN(g.current), tgt = toN(g.target || 1);
              const p   = Math.min(100, tgt > 0 ? (cur / tgt) * 100 : 0);
              const isBool = g.type === "boolean";
              return (
                <div key={g.id} style={{ padding: "11px 14px", borderRadius: 12,
                  border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
                  background: "var(--panel)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{g.title}</span>
                    <span style={{ opacity: .55, fontSize: 12 }}>
                      {isBool ? "체크" : `${cur.toLocaleString("ko-KR")} / ${tgt.toLocaleString("ko-KR")}`}
                    </span>
                  </div>
                  {!isBool && (
                    <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{ width: p + "%", height: "100%", background: "var(--accent,#B89A5A)",
                        borderRadius: 999, transition: "width 0.3s" }} />
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
