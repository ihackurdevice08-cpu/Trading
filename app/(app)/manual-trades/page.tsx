"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAppearance } from "@/components/providers/AppearanceProvider";

const RiskMiniWidget = dynamic(() => import("@/components/RiskMiniWidget"), { ssr: false });

type Trade = {
  id: string;
  symbol: string;
  side: "long" | "short";
  opened_at: string;
  closed_at: string | null;
  pnl: number | null;
  tags: string[];
  notes: string | null;
  group_id: string | null;
};

type TradeGroup = {
  group_id: string;
  trades: Trade[];
  totalPnl: number;
  symbol: string;
  side: "long" | "short";
  expanded: boolean;
};

function thisMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() { return new Date().toISOString().slice(0, 10); }
function fmt(n: any, d = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pnlColor(v: number | null) {
  if (v == null || v === 0) return "inherit";
  return v > 0 ? "var(--green, #0b7949)" : "var(--red, #c0392b)";
}
function genGroupId() {
  return "grp_" + Math.random().toString(36).slice(2, 10);
}

export default function TradeRecordsPage() {
  const { appearance, patchAppearance } = useAppearance();
  const rw = appearance.riskWidget ?? { dashboard: true, trades: true };

  const [from, setFrom] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("trades_from") ?? "";
  });
  const [to, setTo] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("trades_to") ?? "";
  });
  const [symFilter, setSymFilter] = useState("");
  const [sideFilter, setSideFilter] = useState<""|"long"|"short">("");
  const [srcFilter, setSrcFilter]   = useState<""|"bitget"|"manual">("");

  const [trades,  setTrades]  = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedFrom, setFetchedFrom] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState("");

  // 묶기 모드
  const [groupMode, setGroupMode]     = useState(false);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [fSymbol, setFSymbol]   = useState("BTCUSDT");
  const [fSide,   setFSide]     = useState<"long"|"short">("long");
  const [fTime,   setFTime]     = useState(() => new Date().toISOString().slice(0,16));
  const [fPnl,    setFPnl]      = useState("");
  const [fTags,   setFTags]     = useState("");
  const [fNotes,  setFNotes]    = useState("");
  const [formErr, setFormErr]   = useState("");

  const load = useCallback(async (overrideFrom?: string) => {
    setLoading(true);
    try {
      const f = overrideFrom ?? from;
      const p = new URLSearchParams({ limit: "1000" });
      if (f)         p.set("from", f);
      if (to)        p.set("to", to);
      if (symFilter) p.set("symbol", symFilter);
      const r = await fetch(`/api/manual-trades?${p}`, { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setTrades(j.trades ?? []);
      setFetchedFrom(f);
    } catch (e: any) {
      setSyncLog("❌ " + (e?.message ?? "불러오기 실패"));
    } finally { setLoading(false); }
  }, [from, to, symFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("trades-updated", h);
    return () => window.removeEventListener("trades-updated", h);
  }, [load]);

  async function syncAndLoad() {
    setSyncing(true);
    // 동기화는 항상 최근 2일치만 — 조회 필터와 무관하게 빠르게
    const syncFrom = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
    setSyncLog("⏳ Bitget 최근 2일 동기화 중…");
    try {
      const r = await fetch("/api/sync-now", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: syncFrom }),
      });
      const j = await r.json();
      if (j.ok) {
        const newTrades = j.results?.reduce((s: number, r: any) => s + (r.aggregated || 0), 0) ?? 0;
        setSyncLog(
          newTrades > 0
            ? `✅ ${newTrades}건 동기화 완료`
            : `✅ 동기화 완료 — 새 거래 없음 (방금 종료했다면 1~2분 후 재시도)`
        );
        window.dispatchEvent(new Event("trades-updated"));
      } else {
        setSyncLog(`❌ ${j.error}`);
      }
    } catch (e: any) { setSyncLog("❌ " + e?.message); }
    finally { setSyncing(false); await load(); }
  }

  async function addTrade() {
    setFormErr("");
    if (!fSymbol.trim()) { setFormErr("심볼 입력"); return; }
    try {
      const r = await fetch("/api/manual-trades", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: fSymbol.trim().toUpperCase(), side: fSide,
          opened_at: new Date(fTime).toISOString(),
          pnl: fPnl !== "" ? Number(fPnl) : null,
          tags: fTags.split(",").map(s => s.trim()).filter(Boolean),
          notes: fNotes || null,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setFPnl(""); setFTags(""); setFNotes(""); setFormOpen(false);
      window.dispatchEvent(new Event("trades-updated"));
      await load();
    } catch (e: any) { setFormErr(e?.message ?? "저장 실패"); }
  }

  async function del(id: string) {
    if (!confirm("삭제할까요?")) return;
    const r = await fetch(`/api/manual-trades?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json();
    if (j.ok) { window.dispatchEvent(new Event("trades-updated")); await load(); }
    else setSyncLog("❌ " + j.error);
  }

  // 선택된 거래들을 하나의 그룹으로 묶기
  async function groupSelected() {
    if (selected.size < 2) { alert("2개 이상 선택하세요"); return; }
    const ids = Array.from(selected);
    const gid = genGroupId();
    const r = await fetch("/api/manual-trades", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, group_id: gid }),
    });
    const j = await r.json();
    if (j.ok) {
      setSelected(new Set());
      setGroupMode(false);
      setExpandedGroups(prev => new Set([...prev, gid]));
      await load();
    } else { alert("묶기 실패: " + j.error); }
  }

  // 그룹 해제
  async function ungroupTrades(ids: string[]) {
    if (!confirm("그룹을 해제할까요?")) return;
    const r = await fetch("/api/manual-trades", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, group_id: null }),
    });
    const j = await r.json();
    if (j.ok) await load();
    else alert("해제 실패: " + j.error);
  }

  function toggleRiskWidget() {
    const next = !rw.trades;
    if (!next && !rw.dashboard) return;
    patchAppearance({ riskWidget: { ...rw, trades: next } });
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleExpand(gid: string) {
    setExpandedGroups(prev => {
      const n = new Set(prev);
      n.has(gid) ? n.delete(gid) : n.add(gid);
      return n;
    });
  }

  const filtered = useMemo(() => trades.filter(t => {
    if (sideFilter && t.side !== sideFilter) return false;
    if (srcFilter === "bitget"  && !t.tags?.includes("bitget")) return false;
    if (srcFilter === "manual"  &&  t.tags?.includes("bitget")) return false;
    return true;
  }), [trades, sideFilter, srcFilter]);

  // 그룹핑: group_id 있는 것은 묶고, 없는 것은 개별
  const displayItems = useMemo(() => {
    const groups: Record<string, Trade[]> = {};
    const singles: Trade[] = [];

    for (const t of filtered) {
      if (t.group_id) {
        if (!groups[t.group_id]) groups[t.group_id] = [];
        groups[t.group_id].push(t);
      } else {
        singles.push(t);
      }
    }

    // 그룹 아이템들을 opened_at 기준으로 정렬
    const groupItems: TradeGroup[] = Object.entries(groups).map(([gid, ts]) => {
      const sorted = [...ts].sort((a, b) => a.opened_at.localeCompare(b.opened_at));
      return {
        group_id: gid,
        trades: sorted,
        totalPnl: sorted.reduce((s, t) => s + (t.pnl ?? 0), 0),
        symbol: sorted[0].symbol,
        side:   sorted[0].side,
        expanded: expandedGroups.has(gid),
      };
    });

    // 전체를 시간순 병합 (그룹은 첫 trade 시간 기준)
    type Item = { time: string; type: "single"; trade: Trade } | { time: string; type: "group"; group: TradeGroup };
    const all: Item[] = [
      ...singles.map(t => ({ time: t.opened_at, type: "single" as const, trade: t })),
      ...groupItems.map(g => ({ time: g.trades[0].opened_at, type: "group" as const, group: g })),
    ];
    all.sort((a, b) => b.time.localeCompare(a.time)); // 최신순
    return all;
  }, [filtered, expandedGroups]);

  const stats = useMemo(() => {
    const hasPnl = filtered.filter(t => t.pnl != null);
    const wins   = hasPnl.filter(t => (t.pnl ?? 0) > 0);
    const losses = hasPnl.filter(t => (t.pnl ?? 0) < 0);
    const totalPnl = hasPnl.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const avgW = wins.length   ? wins.reduce((s,t)=>s+(t.pnl??0),0)   / wins.length   : null;
    const avgL = losses.length ? losses.reduce((s,t)=>s+(t.pnl??0),0) / losses.length : null;
    const wr   = hasPnl.length ? wins.length / hasPnl.length * 100 : null;
    const rr   = avgW && avgL  ? Math.abs(avgW / avgL) : null;
    return { totalPnl, wins: wins.length, losses: losses.length, wr, rr, n: filtered.length };
  }, [filtered]);

  // ── 카드 렌더링 ──────────────────────────────────────────────
  function TradeCard({ t, idx, inGroup = false }: { t: Trade; idx: number; inGroup?: boolean }) {
    const isAuto   = t.tags?.includes("bitget") ?? false;
    const cleanTags = (t.tags ?? []).filter(tag => !["auto-sync","bitget","manual"].includes(tag));
    const isSelected = selected.has(t.id);

    return (
      <div
        onClick={groupMode ? () => toggleSelect(t.id) : undefined}
        style={{
          display: "grid", gridTemplateColumns: COLS, gap: 8,
          padding: inGroup ? "9px 14px 9px 20px" : "11px 14px",
          alignItems: "center",
          borderTop: idx > 0 ? "1px solid var(--line-soft,rgba(0,0,0,.06))" : "none",
          cursor: groupMode ? "pointer" : "default",
          background: isSelected ? "rgba(var(--accent-rgb,180,150,80),0.08)" : "transparent",
          transition: "background .15s",
        }}
        className="tr-row"
      >
        {/* 선택 체크박스 */}
        {groupMode && (
          <div style={{ position: "absolute", left: inGroup ? 4 : 2 }}>
            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(t.id)}
              style={{ accentColor: "var(--accent,#B89A5A)", width: 15, height: 15 }} />
          </div>
        )}

        <div style={{ minWidth: 0, paddingLeft: groupMode ? 18 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{t.symbol}</span>
            {isAuto && (
              <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4,
                background: "rgba(255,165,0,0.15)", color: "#b8860b", fontWeight: 700 }}>⚡</span>
            )}
          </div>
          <div style={{ fontSize: 11, opacity: .5, marginTop: 1 }}>
            {t.opened_at?.slice(0,16).replace("T"," ")}
          </div>
        </div>

        <div>
          <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
            background: t.side === "long" ? "rgba(11,121,73,0.12)" : "rgba(192,57,43,0.12)",
            color: t.side === "long" ? "var(--green, #0b7949)" : "var(--red, #c0392b)" }}>
            {t.side.toUpperCase()}
          </span>
        </div>

        <div style={{ textAlign: "right", fontWeight: 800, fontSize: 14, color: pnlColor(t.pnl) }}>
          {t.pnl == null ? "—" : `${t.pnl > 0 ? "+" : ""}${fmt(t.pnl)}`}
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {cleanTags.map(tag => (
            <span key={tag} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 5,
              background: "rgba(0,0,0,0.07)" }}>{tag}</span>
          ))}
        </div>

        {!groupMode && (
          <button onClick={() => del(t.id)} style={danger}>삭제</button>
        )}
      </div>
    );
  }

  // ── 그룹 카드 ────────────────────────────────────────────────
  function GroupCard({ g }: { g: TradeGroup }) {
    const isExpanded = expandedGroups.has(g.group_id);
    return (
      <div style={{
        border: `2px solid ${g.side === "long" ? "rgba(11,121,73,0.3)" : "rgba(192,57,43,0.3)"}`,
        borderRadius: 10, overflow: "hidden", marginBottom: 2,
        background: "var(--panel,rgba(255,255,255,0.72))",
      }}>
        {/* 그룹 헤더 */}
        <div
          onClick={() => toggleExpand(g.group_id)}
          style={{
            display: "grid", gridTemplateColumns: COLS, gap: 8,
            padding: "10px 14px", alignItems: "center",
            cursor: "pointer",
            background: g.side === "long" ? "rgba(11,121,73,0.05)" : "rgba(192,57,43,0.05)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{g.symbol}</span>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10,
                background: g.side === "long" ? "rgba(11,121,73,0.15)" : "rgba(192,57,43,0.15)",
                color: g.side === "long" ? "var(--green,#0b7949)" : "var(--red,#c0392b)",
                fontWeight: 800 }}>
                분할청산 {g.trades.length}회
              </span>
            </div>
            <div style={{ fontSize: 11, opacity: .5, marginTop: 1 }}>
              {g.trades[0].opened_at?.slice(0,16).replace("T"," ")}
              {" → "}
              {g.trades[g.trades.length-1].opened_at?.slice(0,16).replace("T"," ")}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
              background: g.side === "long" ? "rgba(11,121,73,0.12)" : "rgba(192,57,43,0.12)",
              color: g.side === "long" ? "var(--green,#0b7949)" : "var(--red,#c0392b)" }}>
              {g.side.toUpperCase()}
            </span>
          </div>

          <div style={{ textAlign: "right", fontWeight: 900, fontSize: 15, color: pnlColor(g.totalPnl) }}>
            {g.totalPnl >= 0 ? "+" : ""}{fmt(g.totalPnl)}
          </div>

          <div style={{ fontSize: 11, opacity: .5 }}>합산 PnL</div>

          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
            <button
              onClick={e => { e.stopPropagation(); ungroupTrades(g.trades.map(t => t.id)); }}
              style={{ ...chip, fontSize: 10, padding: "3px 8px", opacity: .6 }}
            >해제</button>
            <span style={{ fontSize: 13, opacity: .5 }}>{isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {/* 개별 청산 내역 */}
        {isExpanded && (
          <div style={{ borderTop: "1px solid var(--line-soft,rgba(0,0,0,.08))" }}>
            {g.trades.map((t, i) => (
              <TradeCard key={t.id} t={t} idx={i} inGroup />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>

      {/* 타이틀 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>거래기록</h1>
          <div style={{ fontSize: 12, opacity: .5, marginTop: 2 }}>
            청산 포지션만 표시{fetchedFrom ? ` · ${fetchedFrom} 이후` : ""}
          </div>
        </div>
        <button onClick={toggleRiskWidget}
          style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
            cursor: "pointer", border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
            background: rw.trades ? "rgba(0,0,0,0.07)" : "transparent",
            opacity: rw.trades ? 1 : .5 }}>
          ◬ 리스크
        </button>
      </div>

      {rw.trades && <RiskMiniWidget />}

      {/* 날짜 + 동기화 패널 */}
      <div style={panel}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={col}><span style={lbl}>시작일 <span style={{ opacity:.5 }}>(선택)</span></span>
            <input type="date" value={from} max={today()} onChange={e => { setFrom(e.target.value); localStorage.setItem("trades_from", e.target.value); }} style={inp} /></div>
          <div style={col}><span style={lbl}>종료일 <span style={{ opacity:.5 }}>(선택)</span></span>
            <input type="date" value={to} min={from} max={today()} onChange={e => { setTo(e.target.value); localStorage.setItem("trades_to", e.target.value); }} style={inp} /></div>
          <div style={col}><span style={lbl}>심볼 <span style={{ opacity:.5 }}>(선택)</span></span>
            <input value={symFilter} placeholder="전체" onChange={e => setSymFilter(e.target.value)} style={{ ...inp, width: 100 }} /></div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { label: "전체",   fn: () => { setFrom(""); setTo(""); localStorage.setItem("trades_from",""); localStorage.setItem("trades_to",""); } },
              { label: "이번 달", fn: () => { const v=thisMonthStart(); setFrom(v); setTo(""); localStorage.setItem("trades_from",v); localStorage.setItem("trades_to",""); } },
              { label: "이번 주", fn: () => {
                const d = new Date(); const day = d.getDay() || 7;
                const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
                const v = mon.toISOString().slice(0,10);
                setFrom(v); setTo(""); localStorage.setItem("trades_from",v); localStorage.setItem("trades_to","");
              }},
              { label: "오늘",   fn: () => { const v=today(); setFrom(v); setTo(""); localStorage.setItem("trades_from",v); localStorage.setItem("trades_to",""); } },
              { label: "3개월",  fn: () => {
                const d = new Date(); d.setMonth(d.getMonth() - 3);
                const v = d.toISOString().slice(0,10);
                setFrom(v); setTo(""); localStorage.setItem("trades_from",v); localStorage.setItem("trades_to","");
              }},
            ].map(({ label, fn }) => (
              <button key={label} onClick={fn} style={chip}>{label}</button>
            ))}
          </div>

          <button onClick={syncAndLoad} disabled={syncing || loading} style={btn1}>
            {syncing ? "동기화 중…" : loading ? "로딩…" : "⚡ 동기화 & 조회"}
          </button>
        </div>
        {syncLog && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13,
            background: "rgba(0,0,0,0.04)", border: "1px solid var(--line-soft,rgba(0,0,0,.08))" }}>
            {syncLog}
          </div>
        )}
      </div>

      {/* 통계 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 12 }}>
        {([
          ["청산",   `${stats.n}건`],
          ["PnL",    `${stats.totalPnl >= 0 ? "+" : ""}${fmt(stats.totalPnl)} USDT`, stats.totalPnl],
          ["승률",   stats.wr  != null ? `${fmt(stats.wr, 1)}%`    : "—"],
          ["승/패",  `${stats.wins}W / ${stats.losses}L`],
          ["손익비", stats.rr  != null ? fmt(stats.rr, 2) : "—"],
        ] as [string, string, number?][]).map(([label, value, colorVal]) => (
          <div key={label} style={{ padding: "10px 12px", borderRadius: 10,
            border: "1px solid var(--line-soft,rgba(0,0,0,.1))", background: "var(--panel,rgba(255,255,255,0.72))" }}>
            <div style={{ fontSize: 10, opacity: .55, marginBottom: 3, fontWeight: 700 }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: 13, color: colorVal !== undefined ? pnlColor(colorVal) : "inherit" }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* 필터 + 묶기 모드 버튼 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: .5, marginRight: 2 }}>방향</span>
        {(["", "long", "short"] as const).map(v => (
          <button key={v} onClick={() => setSideFilter(v)} style={{
            ...chip, fontWeight: sideFilter === v ? 900 : 600,
            background: sideFilter === v ? "rgba(0,0,0,0.10)" : "transparent",
            color: v === "long" && sideFilter === v ? "var(--green)" : v === "short" && sideFilter === v ? "var(--red)" : "inherit",
          }}>
            {v === "" ? "전체" : v.toUpperCase()}
          </button>
        ))}
        <span style={{ fontSize: 12, opacity: .5, marginLeft: 6, marginRight: 2 }}>소스</span>
        {(["", "bitget", "manual"] as const).map(v => (
          <button key={v} onClick={() => setSrcFilter(v)} style={{
            ...chip, fontWeight: srcFilter === v ? 900 : 600,
            background: srcFilter === v ? "rgba(0,0,0,0.10)" : "transparent",
          }}>
            {v === "" ? "전체" : v === "bitget" ? "⚡ 자동" : "✏️ 수동"}
          </button>
        ))}
        <div style={{ flex: 1 }} />

        {/* 묶기 모드 */}
        {groupMode ? (
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 12, alignSelf: "center", opacity: .7 }}>
              {selected.size}개 선택
            </span>
            <button onClick={groupSelected} style={btn1} disabled={selected.size < 2}>
              분할청산으로 묶기
            </button>
            <button onClick={() => { setGroupMode(false); setSelected(new Set()); }} style={btn2}>
              취소
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setGroupMode(true)} style={btn2}>◈ 분할청산 묶기</button>
            <button onClick={() => setFormOpen(v => !v)} style={btn1}>{formOpen ? "닫기" : "+ 수동 입력"}</button>
          </div>
        )}
      </div>

      {/* 수동 입력 폼 */}
      {formOpen && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>새 거래 직접 입력</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            <div style={col}><span style={lbl}>심볼</span>
              <input value={fSymbol} onChange={e => setFSymbol(e.target.value)} style={inp} /></div>
            <div style={col}><span style={lbl}>방향</span>
              <select value={fSide} onChange={e => setFSide(e.target.value as any)} style={inp}>
                <option value="long">LONG</option><option value="short">SHORT</option>
              </select></div>
            <div style={col}><span style={lbl}>청산 시간</span>
              <input type="datetime-local" value={fTime} onChange={e => setFTime(e.target.value)} style={inp} /></div>
            <div style={col}><span style={lbl}>실현 PnL</span>
              <input value={fPnl} onChange={e => setFPnl(e.target.value)} placeholder="예: 120.5" style={inp} /></div>
            <div style={{ ...col, gridColumn: "1 / -1" }}><span style={lbl}>태그 (콤마 구분)</span>
              <input value={fTags} onChange={e => setFTags(e.target.value)} placeholder="breakout, revenge" style={inp} /></div>
            <div style={{ ...col, gridColumn: "1 / -1" }}><span style={lbl}>메모</span>
              <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2}
                style={{ ...inp, resize: "vertical" }} /></div>
          </div>
          {formErr && <div style={{ marginTop: 8, fontSize: 13, color: "var(--red, #c0392b)" }}>{formErr}</div>}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button onClick={addTrade} style={btn1}>저장</button>
            <button onClick={() => setFormOpen(false)} style={btn2}>취소</button>
          </div>
        </div>
      )}

      {/* 리스트 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", opacity: .5, fontSize: 14 }}>불러오는 중…</div>
        ) : displayItems.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", opacity: .5, fontSize: 14 }}>
            {from ? `${from} 이후 청산 기록 없음` : "청산 기록 없음 — Bitget 동기화를 눌러주세요"}
          </div>
        ) : displayItems.map((item, i) => {
          if (item.type === "group") {
            return <GroupCard key={item.group.group_id} g={item.group} />;
          }
          return (
            <div key={item.trade.id} style={{
              border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
              borderRadius: 10, overflow: "hidden",
              background: "var(--panel,rgba(255,255,255,0.72))",
              position: "relative",
            }}>
              <TradeCard t={item.trade} idx={0} />
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <div style={{ marginTop: 10, padding: "9px 14px",
          border: "1px solid var(--line-soft,rgba(0,0,0,.08))", borderRadius: 10,
          fontSize: 12, opacity: .65, display: "flex", gap: 16, flexWrap: "wrap",
          background: "var(--panel,rgba(255,255,255,0.72))" }}>
          <span>{filtered.length}건</span>
          <span>PnL: <b style={{ color: pnlColor(stats.totalPnl) }}>
            {stats.totalPnl >= 0 ? "+" : ""}{fmt(stats.totalPnl)}
          </b> USDT</span>
        </div>
      )}

      <style>{`
        .th-row { display: grid; }
        @media (max-width: 640px) {
          .th-row { display: none !important; }
          .tr-row { grid-template-columns: 1fr auto !important; }
          .tr-row > *:nth-child(3),
          .tr-row > *:nth-child(4),
          .tr-row > *:nth-child(5) { display: none; }
        }
      `}</style>
    </div>
  );
}

const COLS = "1fr 80px 100px 1fr 52px";
const inp: React.CSSProperties = {
  padding: "8px 11px", borderRadius: 9, fontSize: 14,
  border: "1px solid var(--line-soft,rgba(0,0,0,.12))",
  background: "rgba(0,0,0,0.05)", outline: "none", width: "100%", color: "inherit",
};
const lbl: React.CSSProperties  = { fontSize: 11, opacity: .65, fontWeight: 700 };
const col: React.CSSProperties  = { display: "grid", gap: 4 };
const panel: React.CSSProperties = {
  padding: "12px 14px", border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
  borderRadius: 12, marginBottom: 12, background: "var(--panel,rgba(255,255,255,0.72))",
};
const btn1: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap",
  border: "1px solid var(--line-hard,rgba(0,0,0,.18))",
  background: "var(--text-primary,#111)", color: "white", fontWeight: 800, fontSize: 13,
};
const btn2: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap",
  border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
  background: "transparent", fontWeight: 700, fontSize: 13,
};
const chip: React.CSSProperties = {
  padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 12,
  border: "1px solid var(--line-soft,rgba(0,0,0,.1))", background: "transparent",
};
const danger: React.CSSProperties = {
  padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11,
  border: "1px solid rgba(192,57,43,.25)",
  background: "rgba(192,57,43,.07)", color: "var(--red, #c0392b)", fontWeight: 700,
};
