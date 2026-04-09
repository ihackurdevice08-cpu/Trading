"use client";
import useSWR from "swr";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useLocalStorage } from "@/hooks/useLocalStorage";

import { StatCard }         from "@/components/dashboard/StatCard";
import { DDCard }           from "@/components/dashboard/DDCard";
import { TradingKPI }       from "@/components/dashboard/TradingKPI";
import { HourlyHeatmap }    from "@/components/dashboard/HourlyHeatmap";
import { SymbolTable }      from "@/components/dashboard/SymbolTable";
import { MonthlyPnlTable }  from "@/components/dashboard/MonthlyPnlTable";
import { CombinedPnlChart, DrawdownChart } from "@/components/dashboard/Charts";

import type { DashboardResponse, Goal } from "@/types/dashboard";
import { StatCardSkeleton, ChartSkeleton } from "@/components/ui/Skeleton";
import { CycleSelector } from "@/components/dashboard/CycleSelector";
import type { Cycle } from "@/types/dashboard";

const RiskMiniWidget = dynamic(() => import("@/components/RiskMiniWidget"), { ssr: false });

const toN      = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt      = (v: unknown, d = 2) => toN(v).toLocaleString("ko-KR", { maximumFractionDigits: d });
const sign     = (v: number) => v > 0 ? "+" : "";
const pnlColor = (v: number) => v > 0 ? "var(--green,#0b7949)" : v < 0 ? "var(--red,#c0392b)" : "inherit";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(r => r.json());

// ── 탭 정의 ──────────────────────────────────────────────────
const TABS = [
  { id: "charts",  label: "수익 & 차트" },
  { id: "symbols", label: "심볼 & 시간대" },
  { id: "trades",  label: "거래 & 목표" },
] as const;
type TabId = typeof TABS[number]["id"];

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

  const [pnlFrom, setPnlFrom]   = useLocalStorage<string>("pnl_from", "");
  const [activeTab, setActiveTab] = useLocalStorage<TabId>("dash_tab", "charts");

  const dashQs = pnlFrom ? `?from=${encodeURIComponent(pnlFrom)}` : "";

  const { data: dashData, error: dashErr, mutate: mutateDash } =
    useSWR<DashboardResponse>(`/api/dashboard${dashQs}`, fetcher, {
      refreshInterval:      60_000,
      revalidateOnFocus:    true,
      revalidateOnReconnect:true,
    });

  const { data: goalsData } = useSWR("/api/goals-v2", fetcher, {
    refreshInterval:   300_000,
    revalidateOnFocus: true,
  });

  const { data: cyclesData, mutate: mutateCycles } = useSWR("/api/cycles", fetcher, {
    refreshInterval:   300_000,
    revalidateOnFocus: true,
  });

  useEffect(() => {
    const handler = () => mutateDash();
    window.addEventListener("trades-updated", handler);
    return () => window.removeEventListener("trades-updated", handler);
  }, [mutateDash]);

  // 스파크라인용 최근 7일 일별 PnL 배열
  const dailyVals7 = useMemo(() => {
    const arr = dashData?.dailyPnl ?? [];
    return arr.slice(-7).map(d => d.pnl);
  }, [dashData]);

  // 트렌드: 어제 대비 오늘 PnL 변화율
  const todayTrend = useMemo(() => {
    const arr = dashData?.dailyPnl ?? [];
    if (arr.length < 2) return undefined;
    const yesterday = arr[arr.length - 2].pnl;
    const today     = arr[arr.length - 1].pnl;
    if (yesterday === 0) return undefined;
    return ((today - yesterday) / Math.abs(yesterday)) * 100;
  }, [dashData]);

  if (dashErr) return (
    <div style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14,
      background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,.2)",
      color: "var(--red,#c0392b)" }}>◬ 데이터 로드 실패</div>
  );
  if (!dashData?.ok) return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        {[...Array(3)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 16 }}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <ChartSkeleton height={280} />
    </div>
  );

  const s          = dashData.stats;
  const recent     = dashData.recent ?? [];
  const topSymbols = dashData.topSymbols ?? [];
  const dailyPnl   = dashData.dailyPnl ?? [];
  const ddSeries   = dashData.ddSeries ?? [];
  const heatmap    = dashData.heatmapData ?? [];
  const monthlyPnl = dashData.monthlyPnl ?? [];
  const goals      = (goalsData?.goals ?? []) as Goal[];
  const cycles     = (cyclesData?.cycles ?? []) as Cycle[];
  const activeCycle = cycles.find(c => !c.end_date) ?? null;
  const activeGoals = goals.filter(g => !g.completed);

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* ── 헤더 ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>대시보드</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => patchAppearance({ riskWidget: { ...rw, dashboard: !rw.dashboard } })}
            style={{
              padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
              cursor: "pointer", border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
              background: rw.dashboard ? "color-mix(in srgb,var(--accent,#F0B429) 12%,transparent)" : "transparent",
              opacity: rw.dashboard ? 1 : .5, color: "inherit",
            }}>◬ 리스크</button>
        </div>
      </div>

      {rw.dashboard && <RiskMiniWidget />}

      {/* ── 사이클 선택기 ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "10px 14px", borderRadius: 10, marginBottom: 14,
        border: "1px solid var(--line-soft,rgba(255,255,255,.06))",
        background: "var(--panel,rgba(255,255,255,0.03))",
      }}>
        <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap" as const }}>
          사이클
        </span>
        <CycleSelector
          cycles={cycles}
          activeCycle={activeCycle}
          pnlFrom={pnlFrom}
          onSelect={val => setPnlFrom(val)}
          onCreated={() => { mutateCycles(); mutateDash(); }}
          equityNow={s?.equityNow ?? 0}
        />
        {pnlFrom && (
          <span style={{ fontSize: 11, opacity: 0.55, fontVariantNumeric: "tabular-nums" }}>
            📅 <strong>{pnlFrom}</strong> 부터 적용 중
          </span>
        )}
      </div>

      {/* ── Hero 위젯 — 핵심 지표 3개 크게 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 10 }}>
        <StatCard
          label="현재 자산"
          value={<>{fmt(s.equityNow)} <span style={{ fontSize: 14, fontWeight: 500 }}>USDT</span></>}
          sub={`시드 ${fmt(s.seed)} USDT 대비 ${sign(s.equityNow - s.seed)}${fmt(s.equityNow - s.seed)}`}
          color={pnlColor(s.equityNow - s.seed)}
          sparkline={dailyVals7}
        />
        <StatCard
          label="오늘 PnL"
          value={<>{sign(s.todayPnL)}{fmt(s.todayPnL)} <span style={{ fontSize: 14, fontWeight: 500 }}>USDT</span></>}
          sub="오늘 실현 손익"
          color={pnlColor(s.todayPnL)}
          trend={todayTrend}
          sparkline={dailyVals7}
        />
        <StatCard
          label={pnlFrom ? `누적 PnL (사이클)` : "누적 PnL"}
          value={<>{sign(s.cumPnl)}{fmt(s.cumPnl)} <span style={{ fontSize: 14, fontWeight: 500 }}>USDT</span></>}
          sub={pnlFrom ? `${pnlFrom} 이후` : "전체 기간"}
          color={pnlColor(s.cumPnl)}
          sparkline={dailyVals7}
        />
      </div>

      {/* ── 보조 지표 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 16 }}>
        <StatCard label="이번 주 PnL"  value={`${sign(s.weekPnL)}${fmt(s.weekPnL)}`}   sub="USDT" color={pnlColor(s.weekPnL)} />
        <StatCard label="이번 달 PnL"  value={`${sign(s.monthPnL)}${fmt(s.monthPnL)}`}  sub="USDT" color={pnlColor(s.monthPnL)} />
        <StatCard label="총 출금"       value={`${fmt(s.totalWithdrawal)} USDT`} />
        <StatCard
          label={pnlFrom ? "사이클 승률" : "전체 승률"}
          value={`${s.cycleWinRate != null ? s.cycleWinRate.toFixed(1) : s.winRate != null ? s.winRate.toFixed(1) : "—"}%`}
          sub={`${s.wins}승 ${s.losses}패 / ${s.realizedTrades}건`}
        />
      </div>

      {/* ── 드로다운 현황 ── */}
      <DDCard stats={s} />

      {/* ── 탭 네비게이션 ── */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 16,
        borderBottom: "1px solid var(--line-soft,rgba(255,255,255,.08))",
        paddingBottom: 0,
      }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              all: "unset", cursor: "pointer",
              padding: "9px 16px", fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              borderBottom: activeTab === tab.id
                ? "2px solid var(--accent,#F0B429)"
                : "2px solid transparent",
              color: activeTab === tab.id
                ? "var(--accent,#F0B429)"
                : "var(--text-secondary,rgba(255,255,255,0.5))",
              transition: "all 0.15s",
              marginBottom: -1,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 수익 & 차트 ── */}
      {activeTab === "charts" && (
        <div>
          <CombinedPnlChart daily={dailyPnl} dd={ddSeries} pnlFrom={pnlFrom} />
          <DrawdownChart data={ddSeries} />
          <MonthlyPnlTable data={monthlyPnl} />
        </div>
      )}

      {/* ── 탭 2: 심볼 & 시간대 분석 ── */}
      {activeTab === "symbols" && (
        <div>
          <SymbolTable symbols={topSymbols} pnlFrom={pnlFrom} />
          <HourlyHeatmap data={heatmap} />
          <TradingKPI stats={s} pnlFrom={pnlFrom} />
        </div>
      )}

      {/* ── 탭 3: 거래 & 목표 ── */}
      {activeTab === "trades" && (
        <div>
          {/* 최근 거래 */}
          {recent.length > 0 ? (
            <div style={panel}>
              <div style={sectionTitle}>◎ 최근 거래</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {recent.map(t => (
                  <div key={t.id} style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 10,
                    border: "1px solid var(--line-soft)", background: "rgba(255,255,255,0.02)",
                  }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{t.symbol}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, marginLeft: 6, padding: "2px 6px", borderRadius: 4,
                        background: t.side === "long" ? "rgba(11,121,73,0.12)" : "rgba(192,57,43,0.12)",
                        color: t.side === "long" ? "var(--green,#0b7949)" : "var(--red,#c0392b)",
                      }}>{t.side?.toUpperCase()}</span>
                      <div style={{ fontSize: 10, opacity: 0.4, marginTop: 2 }}>
                        {t.opened_at?.slice(0, 16).replace("T", " ")}
                      </div>
                    </div>
                    <span style={{
                      fontWeight: 800, fontSize: 15,
                      color: t.pnl != null ? pnlColor(toN(t.pnl)) : "inherit",
                      fontFamily: "var(--font-mono,monospace)",
                    }}>
                      {t.pnl != null ? `${sign(toN(t.pnl))}${fmt(t.pnl)}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ ...panel, opacity: 0.5, textAlign: "center", fontSize: 13 }}>최근 거래 없음</div>
          )}

          {/* 진행중 목표 */}
          {activeGoals.length > 0 && (
            <div style={panel}>
              <div style={sectionTitle}>◎ 진행중 목표 ({activeGoals.length}개)</div>
              <div style={{ display: "grid", gap: 8 }}>
                {activeGoals.map(g => {
                  const cur  = toN(g.current);
                  const tgt  = toN(g.target || 1);
                  const p    = Math.min(100, tgt > 0 ? (cur / tgt) * 100 : 0);
                  const isBool = g.type === "boolean";
                  return (
                    <div key={g.id} style={{ padding: "12px 14px", borderRadius: 10,
                      border: "1px solid var(--line-soft)", background: "rgba(255,255,255,0.02)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{g.title}</span>
                        <span style={{ opacity: .55, fontSize: 12, fontFamily: "var(--font-mono,monospace)" }}>
                          {isBool ? "체크" : `${cur.toLocaleString("ko-KR")} / ${tgt.toLocaleString("ko-KR")}`}
                        </span>
                      </div>
                      {!isBool && (
                        <>
                          <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                            <div style={{ width: `${p}%`, height: "100%", background: "var(--accent,#B89A5A)",
                              borderRadius: 999, transition: "width 0.4s" }} />
                          </div>
                          <div style={{ fontSize: 10, opacity: 0.4, marginTop: 4, textAlign: "right" }}>
                            {p.toFixed(1)}%
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeGoals.length === 0 && (
            <div style={{ ...panel, opacity: 0.5, textAlign: "center", fontSize: 13 }}>진행중 목표 없음</div>
          )}
        </div>
      )}
    </div>
  );
}
