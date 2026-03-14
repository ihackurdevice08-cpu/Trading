"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAppearance } from "@/components/providers/AppearanceProvider";

const RiskMiniWidget = dynamic(() => import("@/components/RiskMiniWidget"), { ssr: false });

const toN  = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt  = (v: any, d = 2) => toN(v).toLocaleString("ko-KR", { maximumFractionDigits: d });
const sign = (v: number) => v > 0 ? "+" : "";
const pnlColor = (v: number) => v > 0 ? "var(--green,#0b7949)" : v < 0 ? "var(--red,#c0392b)" : "inherit";

const DOW_LABELS = ["월","화","수","목","금","토","일"];

function StatCard({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
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
        textTransform: "uppercase", fontFamily: "var(--font-mono,monospace)",
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

// ── 일별 PnL 바 차트 ──────────────────────────────────────
function DailyBarChart({ data }: { data: { date: string; pnl: number }[] }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => Math.abs(d.pnl)), 1);
  return (
    <div style={panel}>
      <div style={sectionTitle}>◈ 이번 달 일별 PnL</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60, overflowX: "auto" }}>
        {data.map(d => {
          const h = Math.max(4, Math.abs(d.pnl) / max * 56);
          return (
            <div key={d.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", minWidth: 20 }}
              title={`${d.date}: ${sign(d.pnl)}${fmt(d.pnl)} USDT`}>
              <div style={{ width: 14, height: h, borderRadius: 3,
                background: d.pnl >= 0 ? "var(--green,#0b7949)" : "var(--red,#c0392b)", opacity: 0.8 }} />
              <div style={{ fontSize: 9, opacity: 0.4, marginTop: 2 }}>{d.date.slice(8)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 드로다운 차트 ──────────────────────────────────────────
function DrawdownChart({ data }: { data: { date: string; dd: number; cumPnl: number }[] }) {
  if (!data?.length || data.length < 2) return null;
  const W = 560, H = 80, PAD = { t: 6, b: 18, l: 32, r: 8 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxDD  = Math.max(...data.map(d => d.dd), 0.1);

  const pts = data.map((d, i) => {
    const x = PAD.l + (i / (data.length - 1)) * innerW;
    const y = PAD.t + (d.dd / maxDD) * innerH;
    return `${x},${y}`;
  }).join(" ");

  const firstPt = `${PAD.l},${PAD.t + innerH}`;
  const lastPt  = `${PAD.l + innerW},${PAD.t + innerH}`;

  // x축 날짜 레이블 (4개)
  const ticks = [0, Math.floor(data.length/3), Math.floor(data.length*2/3), data.length-1]
    .filter((v,i,a) => a.indexOf(v) === i);

  return (
    <div style={panel}>
      <div style={sectionTitle}>◈ 드로다운 추이</div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 280, height: "auto", display: "block" }}>
          {/* 그리드 라인 */}
          {[0.25, 0.5, 0.75, 1].map(r => (
            <line key={r} x1={PAD.l} x2={PAD.l+innerW}
              y1={PAD.t + r*innerH} y2={PAD.t + r*innerH}
              stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
          ))}
          {/* y축 레이블 */}
          {[0, 0.5, 1].map(r => (
            <text key={r} x={PAD.l - 3} y={PAD.t + r*innerH + 3}
              fontSize={8} fill="rgba(0,0,0,0.35)" textAnchor="end">
              {(r * maxDD).toFixed(1)}%
            </text>
          ))}
          {/* 채움 영역 */}
          <polygon
            points={`${firstPt} ${pts} ${lastPt}`}
            fill="rgba(255,77,77,0.12)" />
          {/* 라인 */}
          <polyline points={pts} fill="none" stroke="rgba(255,77,77,0.75)" strokeWidth="2"
            style={{ filter: "drop-shadow(0 0 4px rgba(255,77,77,0.4))" }} />
          {/* x축 레이블 */}
          {ticks.map(i => (
            <text key={i} x={PAD.l + (i/(data.length-1))*innerW} y={H-3}
              fontSize={8} fill="rgba(0,0,0,0.35)" textAnchor="middle">
              {data[i].date.slice(5)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── 누적 PnL 차트 ─────────────────────────────────────────
function CumPnlChart({ data }: { data: { date: string; cumPnl: number }[] }) {
  if (!data?.length || data.length < 2) return null;
  const W = 560, H = 80, PAD = { t: 6, b: 18, l: 40, r: 8 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const vals   = data.map(d => d.cumPnl);
  const minV   = Math.min(...vals);
  const maxV   = Math.max(...vals);
  const range  = Math.max(maxV - minV, 1);
  const zeroY  = PAD.t + ((maxV) / range) * innerH;

  const pts = data.map((d, i) => {
    const x = PAD.l + (i / (data.length - 1)) * innerW;
    const y = PAD.t + ((maxV - d.cumPnl) / range) * innerH;
    return `${x},${y}`;
  }).join(" ");

  const ticks = [0, Math.floor(data.length/3), Math.floor(data.length*2/3), data.length-1]
    .filter((v,i,a) => a.indexOf(v) === i);

  const lastVal = vals[vals.length - 1];
  const lineColor = lastVal >= 0 ? "rgba(0,192,118,0.85)" : "rgba(255,77,77,0.85)";
  const fillColor = lastVal >= 0 ? "rgba(0,192,118,0.12)" : "rgba(255,77,77,0.10)";

  const firstX = PAD.l, lastX = PAD.l + innerW;
  const firstY = PAD.t + ((maxV - vals[0]) / range) * innerH;
  const lastY  = PAD.t + ((maxV - vals[vals.length-1]) / range) * innerH;

  return (
    <div style={panel}>
      <div style={sectionTitle}>◈ 누적 PnL 추이</div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 280, height: "auto", display: "block" }}>
          {[0, 0.5, 1].map(r => (
            <line key={r} x1={PAD.l} x2={PAD.l+innerW}
              y1={PAD.t + r*innerH} y2={PAD.t + r*innerH}
              stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
          ))}
          {/* 제로 라인 */}
          {minV < 0 && maxV > 0 && (
            <line x1={PAD.l} x2={PAD.l+innerW} y1={zeroY} y2={zeroY}
              stroke="rgba(0,0,0,0.2)" strokeWidth="1" strokeDasharray="3,3" />
          )}
          {[minV, (minV+maxV)/2, maxV].map((v, i) => (
            <text key={i} x={PAD.l - 3} y={PAD.t + (1 - i * 0.5) * innerH + 3}
              fontSize={8} fill="rgba(0,0,0,0.35)" textAnchor="end">
              {v >= 0 ? "+" : ""}{v.toFixed(0)}
            </text>
          ))}
          <polygon points={`${firstX},${firstY} ${pts} ${lastX},${lastY} ${lastX},${Math.min(zeroY, PAD.t+innerH)} ${firstX},${Math.min(zeroY, PAD.t+innerH)}`}
            fill={fillColor} />
          <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2"
            style={{ filter: `drop-shadow(0 0 4px ${lineColor})` }} />
          {ticks.map(i => (
            <text key={i} x={PAD.l + (i/(data.length-1))*innerW} y={H-3}
              fontSize={8} fill="rgba(0,0,0,0.35)" textAnchor="middle">
              {data[i].date.slice(5)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── 요일×시간대 히트맵 ────────────────────────────────────
function HourlyHeatmap({ data }: { data: { dow: number; hour: number; winRate: number | null; total: number; pnl: number }[] }) {
  if (!data?.length) return null;

  // 거래가 있는 시간대만 표시
  const activeHours = Array.from(new Set(
    data.filter(d => d.total > 0).map(d => d.hour)
  )).sort((a,b) => a - b);

  if (activeHours.length === 0) return null;

  function cellColor(wr: number | null, total: number) {
    if (total === 0 || wr === null) return "rgba(0,0,0,0.03)";
    if (wr >= 70) return `rgba(11,121,73,${0.15 + (wr-70)/30 * 0.45})`;
    if (wr >= 50) return `rgba(11,121,73,${0.08 + (wr-50)/20 * 0.07})`;
    if (wr >= 30) return `rgba(192,57,43,${0.08 + (50-wr)/20 * 0.07})`;
    return `rgba(192,57,43,${0.15 + (30-wr)/30 * 0.35})`;
  }

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={sectionTitle}>◈ 요일×시간대 승률 (최근 90일)</div>
        <div style={{ display: "flex", gap: 8, fontSize: 10, opacity: .5 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(11,121,73,0.5)", display: "inline-block" }} />승률 高
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(192,57,43,0.5)", display: "inline-block" }} />승률 低
          </span>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 10, width: "100%", minWidth: Math.max(280, activeHours.length * 34 + 40) }}>
          <thead>
            <tr>
              <th style={{ width: 28, padding: "2px 4px", opacity: .4, fontWeight: 600 }}></th>
              {activeHours.map(h => (
                <th key={h} style={{ padding: "2px 3px", opacity: .45, fontWeight: 600, textAlign: "center", minWidth: 28 }}>
                  {h}시
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOW_LABELS.map((dow, d) => (
              <tr key={d}>
                <td style={{ padding: "2px 4px", fontWeight: 700, opacity: .6, whiteSpace: "nowrap" }}>{dow}</td>
                {activeHours.map(h => {
                  const cell = data.find(x => x.dow === d && x.hour === h);
                  const wr   = cell?.winRate ?? null;
                  const tot  = cell?.total ?? 0;
                  const pnl  = cell?.pnl ?? 0;
                  return (
                    <td key={h} style={{ padding: "2px 3px", textAlign: "center" }}
                      title={tot > 0 ? `${dow} ${h}시: ${tot}건 | 승률 ${wr ?? "—"}% | PnL ${pnl >= 0 ? "+" : ""}${fmt(pnl)}` : ""}>
                      <div style={{
                        width: 26, height: 22, borderRadius: 4, margin: "0 auto",
                        background: cellColor(wr, tot),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700,
                        color: tot === 0 ? "transparent" : wr !== null && (wr >= 60 || wr <= 40) ? "white" : "inherit",
                        opacity: tot === 0 ? 0.3 : 1,
                      }}>
                        {wr !== null ? `${wr}` : tot > 0 ? tot : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 6, fontSize: 10, opacity: .4 }}>셀 숫자 = 승률(%), 거래 2건 미만은 공백 (마우스 오버로 상세)</div>
    </div>
  );
}

// ── 심볼별 분석 ────────────────────────────────────────────
function SymbolTable({ symbols }: { symbols: any[] }) {
  if (!symbols?.length) return null;
  return (
    <div style={panel}>
      <div style={sectionTitle}>◉ 심볼별 분석 (이번 달)</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line-soft,rgba(0,0,0,.08))" }}>
              {["심볼","PnL","건수","승/패","승률","평균 익절","평균 손절"].map(h => (
                <th key={h} style={{ padding: "5px 8px", textAlign: h === "심볼" ? "left" : "right", opacity: .5, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map(sym => (
              <tr key={sym.symbol} style={{ borderBottom: "1px solid var(--line-soft,rgba(0,0,0,.05))" }}>
                <td style={{ padding: "7px 8px", fontWeight: 800 }}>{sym.symbol}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 800, color: pnlColor(sym.pnl) }}>
                  {sign(sym.pnl)}{fmt(sym.pnl)}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", opacity: .7 }}>{sym.count}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", opacity: .7 }}>{sym.wins}W/{sym.losses}L</td>
                <td style={{ padding: "7px 8px", textAlign: "right" }}>
                  <span style={{
                    fontWeight: 800, padding: "2px 7px", borderRadius: 6, fontSize: 11,
                    background: sym.winRate >= 60 ? "rgba(11,121,73,0.12)" : sym.winRate < 40 ? "rgba(192,57,43,0.12)" : "rgba(0,0,0,0.06)",
                    color: sym.winRate >= 60 ? "var(--green,#0b7949)" : sym.winRate < 40 ? "var(--red,#c0392b)" : "inherit",
                  }}>{sym.winRate}%</span>
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--green,#0b7949)", fontWeight: 700 }}>
                  {sym.avgWin != null ? `+${fmt(sym.avgWin)}` : "—"}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--red,#c0392b)", fontWeight: 700 }}>
                  {sym.avgLoss != null ? fmt(sym.avgLoss) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 드로다운 리커버리 카드 ────────────────────────────────
function DDCard({ stats }: { stats: any }) {
  const { currentDD, maxDD, recoveryNeeded } = stats;
  if (maxDD == null || maxDD <= 0) return null;
  const isInDD = currentDD > 0.5;
  return (
    <div style={{ ...panel, border: isInDD ? "1px solid rgba(255,77,77,0.3)" : "1px solid var(--line-soft,rgba(255,255,255,.08))",
      background: isInDD ? "rgba(255,77,77,0.06)" : "var(--panel,rgba(255,255,255,0.04))" }}>
      <div style={sectionTitle}>◈ 드로다운 현황</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 10, opacity: .5, fontWeight: 700 }}>현재 DD</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: isInDD ? "var(--red,#c0392b)" : "inherit" }}>
            {currentDD.toFixed(2)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, opacity: .5, fontWeight: 700 }}>최대 DD (기간 내)</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--red,#c0392b)" }}>{maxDD.toFixed(2)}%</div>
        </div>
        {isInDD && (
          <div>
            <div style={{ fontSize: 10, opacity: .5, fontWeight: 700 }}>원금 회복 필요 수익률</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--red,#c0392b)" }}>+{recoveryNeeded.toFixed(2)}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { appearance, patchAppearance } = useAppearance();
  const rw = appearance.riskWidget ?? { dashboard: true, trades: true };

  const [stats,        setStats]        = useState<any>(null);
  const [goals,        setGoals]        = useState<any[]>([]);
  const [recent,       setRecent]       = useState<any[]>([]);
  const [topSymbols,   setTopSymbols]   = useState<any[]>([]);
  const [dailyPnl,     setDailyPnl]     = useState<any[]>([]);
  const [ddSeries,     setDdSeries]     = useState<any[]>([]);
  const [heatmapData,  setHeatmapData]  = useState<any[]>([]);
  const [err,          setErr]          = useState("");
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [pnlFrom,      setPnlFrom]      = useState<string>(() =>
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
        setDdSeries(a.ddSeries || []);
        setHeatmapData(a.heatmapData || []);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>대시보드</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {lastUpdated && <span style={{ fontSize: 11, opacity: .4 }}>{lastUpdated.toLocaleTimeString("ko-KR")} 기준</span>}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, opacity: 0.5, whiteSpace: "nowrap" }}>누적 기준</span>
            <input type="date" value={pnlFrom} max={new Date().toISOString().slice(0, 10)}
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
        <StatCard label="누적 PnL"    value={`${sign(s.cumPnl)}${fmt(s.cumPnl)}`}
          sub={pnlFrom ? `${pnlFrom} 이후` : "전체 기간"} color={pnlColor(s.cumPnl)} />
      </div>

      {/* 계좌 현황 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 12 }}>
        <StatCard label="최초 시드"    value={`${fmt(s.seed)} USDT`} />
        <StatCard label="현재 자산"    value={`${fmt(s.equityNow)} USDT`}
          sub={`시드 대비 ${sign(s.equityNow - s.seed)}${fmt(s.equityNow - s.seed)}`}
          color={pnlColor(s.equityNow - s.seed)} />
        <StatCard label="총 출금"      value={`${fmt(s.totalWithdrawal)} USDT`} />
        <StatCard label="이번 달 승률" value={`${s.winRate != null ? s.winRate.toFixed(1) : "—"}%`}
          sub={`${s.wins}승 ${s.losses}패 / ${s.realizedTrades}건`} />
      </div>

      {/* 드로다운 카드 */}
      <DDCard stats={s} />

      {/* 차트 2개 나란히 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 0 }}>
        <DailyBarChart data={dailyPnl} />
        <CumPnlChart data={ddSeries} />
      </div>

      {/* 드로다운 차트 */}
      <DrawdownChart data={ddSeries} />

      {/* 히트맵 */}
      <HourlyHeatmap data={heatmapData} />

      {/* 심볼별 분석 */}
      <SymbolTable symbols={topSymbols} />

      {/* 최근 거래 */}
      {recent.length > 0 && (
        <div style={panel}>
          <div style={sectionTitle}>◎ 최근 거래</div>
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
              const cur = toN(g.current_value), tgt = toN(g.target_value || 1);
              const p   = Math.min(100, tgt > 0 ? (cur / tgt) * 100 : 0);
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
                      <div style={{ width: p + "%", height: "100%", background: "var(--accent,#B89A5A)", borderRadius: 999, transition: "width 0.3s" }} />
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

const panel: React.CSSProperties = {
  padding: "16px 18px", borderRadius: 14, marginBottom: 12,
  border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
  background: "var(--panel,rgba(255,255,255,0.04))",
  backdropFilter: "blur(8px)",
};
const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, opacity: 0.4, marginBottom: 12,
  letterSpacing: 1.2, textTransform: "uppercase",
  fontFamily: "var(--font-mono,monospace)",
};
