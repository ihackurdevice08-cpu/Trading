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

const MISTAKE_TAGS = [
  { id: "fomo",       label: "FOMO 진입",       color: "#e67e22" },
  { id: "revenge",    label: "복수매매",         color: "#c0392b" },
  { id: "oversize",   label: "과도한 레버리지",  color: "#c0392b" },
  { id: "no-sl",      label: "손절 미이행",      color: "#c0392b" },
  { id: "early-exit", label: "조기 청산",        color: "#8e44ad" },
  { id: "late-entry", label: "늦은 진입",        color: "#e67e22" },
  { id: "good",       label: "✓ 좋은 거래",     color: "#0b7949" },
];

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
function genGroupId() { return "grp_" + Math.random().toString(36).slice(2, 10); }

export default function TradeRecordsPage() {
  const { appearance, patchAppearance } = useAppearance();
  const rw = appearance.riskWidget ?? { dashboard: true, trades: true };

  const [from, setFrom] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("trades_from") ?? "") : ""
  );
  const [to, setTo] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("trades_to") ?? "") : ""
  );
  const [symFilter,  setSymFilter]  = useState("");
  const [sideFilter, setSideFilter] = useState<""|"long"|"short">("");
  const [srcFilter,  setSrcFilter]  = useState<""|"bitget"|"manual">("");
  const [pnlFilter,  setPnlFilter]  = useState<""|"win"|"lose">("");

  const [trades,      setTrades]      = useState<Trade[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchedFrom, setFetchedFrom] = useState("");
  const [syncing,     setSyncing]     = useState(false);
  const [syncLog,     setSyncLog]     = useState("");

  const [groupMode,      setGroupMode]      = useState(false);
  const [selected,       setSelected]       = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [detailTrade,  setDetailTrade]  = useState<Trade | null>(null);
  const [detailNotes,  setDetailNotes]  = useState("");
  const [detailTags,   setDetailTags]   = useState<string[]>([]);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailMsg,    setDetailMsg]    = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [fSymbol,  setFSymbol]  = useState("BTCUSDT");
  const [fSide,    setFSide]    = useState<"long"|"short">("long");
  const [fTime,    setFTime]    = useState(() => new Date().toISOString().slice(0,16));
  const [fPnl,     setFPnl]     = useState("");
  const [fTags,    setFTags]    = useState("");
  const [fNotes,   setFNotes]   = useState("");
  const [formErr,  setFormErr]  = useState("");

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
    // UI에서 지정한 from 날짜 사용 (없으면 전체 기간)
    const syncFrom = from || null;
    setSyncLog(syncFrom ? `⏳ Bitget ${syncFrom} 이후 동기화 중…` : "⏳ Bitget 전체 기간 동기화 중…");
    try {
      const body: any = {};
      if (syncFrom) body.from = syncFrom;
      const r = await fetch("/api/sync-now", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        const newTrades = j.results?.reduce((s: number, r: any) => s + (r.aggregated || 0), 0) ?? 0;
        setSyncLog(newTrades > 0 ? `✅ ${newTrades}건 동기화 완료` : `✅ 동기화 완료 — 새 거래 없음`);
        window.dispatchEvent(new Event("trades-updated"));
      } else { setSyncLog(`❌ ${j.error}`); }
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

  async function groupSelected() {
    if (selected.size < 2) { alert("2개 이상 선택하세요"); return; }
    const gid = genGroupId();
    const r = await fetch("/api/manual-trades", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), group_id: gid }),
    });
    const j = await r.json();
    if (j.ok) {
      setSelected(new Set()); setGroupMode(false);
      setExpandedGroups(prev => new Set([...prev, gid]));
      await load();
    } else { alert("묶기 실패: " + j.error); }
  }

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

  function openDetail(t: Trade) {
    if (groupMode || t.symbol === "FUNDING") return;
    setDetailTrade(t);
    setDetailNotes(t.notes ?? "");
    setDetailTags(t.tags?.filter(tag => MISTAKE_TAGS.some(m => m.id === tag)) ?? []);
    setDetailMsg("");
  }

  async function saveDetail() {
    if (!detailTrade) return;
    setDetailSaving(true); setDetailMsg("");
    try {
      const sysTags = (detailTrade.tags ?? []).filter(tag => !MISTAKE_TAGS.some(m => m.id === tag));
      const newTags = [...sysTags, ...detailTags];
      const r = await fetch("/api/manual-trades", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [detailTrade.id], notes: detailNotes || null, tags: newTags }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setDetailMsg("✅ 저장됨");
      setTrades(prev => prev.map(t =>
        t.id === detailTrade.id ? { ...t, notes: detailNotes || null, tags: newTags } : t
      ));
      setDetailTrade(prev => prev ? { ...prev, notes: detailNotes || null, tags: newTags } : null);
    } catch (e: any) { setDetailMsg("❌ " + (e?.message ?? "저장 실패")); }
    finally { setDetailSaving(false); }
  }

  function toggleRiskWidget() {
    const next = !rw.trades;
    if (!next && !rw.dashboard) return;
    patchAppearance({ riskWidget: { ...rw, trades: next } });
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleExpand(gid: string) {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(gid) ? n.delete(gid) : n.add(gid); return n; });
  }

  const filtered = useMemo(() => trades.filter(t => {
    if (sideFilter && t.side !== sideFilter) return false;
    if (srcFilter === "bitget"  && !t.tags?.includes("bitget")) return false;
    if (srcFilter === "manual"  &&  t.tags?.includes("bitget")) return false;
    if (pnlFilter === "win"  && (t.pnl == null || t.pnl <= 0)) return false;
    if (pnlFilter === "lose" && (t.pnl == null || t.pnl >= 0)) return false;
    return true;
  }), [trades, sideFilter, srcFilter, pnlFilter]);

  const displayItems = useMemo(() => {
    const groups: Record<string, Trade[]> = {};
    const singles: Trade[] = [];
    for (const t of filtered) {
      if (t.group_id) { if (!groups[t.group_id]) groups[t.group_id] = []; groups[t.group_id].push(t); }
      else singles.push(t);
    }
    const groupItems: TradeGroup[] = Object.entries(groups).map(([gid, ts]) => {
      const sorted = [...ts].sort((a, b) => a.opened_at.localeCompare(b.opened_at));
      return { group_id: gid, trades: sorted, totalPnl: sorted.reduce((s, t) => s + (t.pnl ?? 0), 0), symbol: sorted[0].symbol, side: sorted[0].side, expanded: expandedGroups.has(gid) };
    });
    type Item = { time: string; type: "single"; trade: Trade } | { time: string; type: "group"; group: TradeGroup };
    const all: Item[] = [
      ...singles.map(t => ({ time: t.opened_at, type: "single" as const, trade: t })),
      ...groupItems.map(g => ({ time: g.trades[0].opened_at, type: "group" as const, group: g })),
    ];
    all.sort((a, b) => b.time.localeCompare(a.time));
    return all;
  }, [filtered, expandedGroups]);

  const stats = useMemo(() => {
    const real    = filtered.filter(t => t.symbol !== "FUNDING");
    const hasPnl  = real.filter(t => t.pnl != null);
    const wins    = hasPnl.filter(t => (t.pnl ?? 0) > 0);
    const losses  = hasPnl.filter(t => (t.pnl ?? 0) < 0);
    const totalPnl = filtered.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const avgW = wins.length   ? wins.reduce((s,t)=>s+(t.pnl??0),0)   / wins.length   : null;
    const avgL = losses.length ? losses.reduce((s,t)=>s+(t.pnl??0),0) / losses.length : null;
    const wr   = hasPnl.length ? wins.length / hasPnl.length * 100 : null;
    const rr   = avgW && avgL  ? Math.abs(avgW / avgL) : null;
    return { totalPnl, wins: wins.length, losses: losses.length, wr, rr, n: real.length };
  }, [filtered]);

  function TradeCard({ t, idx, inGroup = false }: { t: Trade; idx: number; inGroup?: boolean }) {
    const isFunding   = t.symbol === "FUNDING";
    const isAuto      = t.tags?.includes("bitget") ?? false;
    const mistakeTags = (t.tags ?? []).filter(tag => MISTAKE_TAGS.some(m => m.id === tag));
    const hasNotes    = !!t.notes;
    const isSelected  = selected.has(t.id);
    return (
      <div onClick={() => groupMode ? toggleSelect(t.id) : openDetail(t)}
        style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: inGroup ? "9px 14px 9px 20px" : "11px 14px", alignItems: "center",
          borderTop: idx > 0 ? "1px solid var(--line-soft)" : "none",
          cursor: isFunding ? "default" : "pointer",
          background: isSelected ? "rgba(180,150,80,0.08)" : isFunding ? "rgba(0,0,0,0.02)" : "transparent",
          opacity: isFunding ? 0.7 : 1, transition: "background .15s" }} className="tr-row">
        {groupMode && (
          <div style={{ position: "absolute" as const, left: inGroup ? 4 : 2 }}>
            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(t.id)} style={{ accentColor: "var(--accent,#B89A5A)", width: 15, height: 15 }} />
          </div>
        )}
        <div style={{ minWidth: 0, paddingLeft: groupMode ? 18 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {isFunding ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(100,100,200,0.12)", color: "#6464c8" }}>펀딩피</span>
            ) : (
              <span style={{ fontWeight: 800, fontSize: 14 }}>{t.symbol}</span>
            )}
            {isAuto && !isFunding && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "rgba(240,180,41,0.15)", color: "#F0B429", fontWeight: 700 }}>⚡</span>}
            {hasNotes && !isFunding && <span style={{ fontSize: 10, opacity: 0.4 }}>✎</span>}
          </div>
          <div style={{ fontSize: 11, opacity: .5, marginTop: 1 }}>{t.opened_at?.slice(0,16).replace("T"," ")}</div>
        </div>
        <div>
          {!isFunding && (
            <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
              background: t.side === "long" ? "rgba(11,121,73,0.12)" : "rgba(192,57,43,0.12)",
              color: t.side === "long" ? "var(--green, #0b7949)" : "var(--red, #c0392b)" }}>
              {t.side.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ textAlign: "right" as const, fontWeight: 800, fontSize: 14, color: pnlColor(t.pnl) }}>
          {t.pnl == null ? "—" : `${t.pnl > 0 ? "+" : ""}${fmt(t.pnl)}`}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {mistakeTags.map(tag => {
            const m = MISTAKE_TAGS.find(x => x.id === tag);
            return <span key={tag} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 5, background: (m?.color ?? "#888") + "20", color: m?.color, fontWeight: 700 }}>{m?.label ?? tag}</span>;
          })}
        </div>
        {!groupMode && !isFunding && <button onClick={e => { e.stopPropagation(); del(t.id); }} style={danger}>삭제</button>}
      </div>
    );
  }

  function GroupCard({ g }: { g: TradeGroup }) {
    const isExpanded = expandedGroups.has(g.group_id);
    return (
      <div style={{ border: `2px solid ${g.side === "long" ? "rgba(11,121,73,0.3)" : "rgba(192,57,43,0.3)"}`, borderRadius: 10, overflow: "hidden", marginBottom: 2, background: "var(--panel)" }}>
        <div onClick={() => toggleExpand(g.group_id)} style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "10px 14px", alignItems: "center", cursor: "pointer", background: g.side === "long" ? "rgba(11,121,73,0.05)" : "rgba(192,57,43,0.05)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{g.symbol}</span>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: g.side === "long" ? "rgba(11,121,73,0.15)" : "rgba(192,57,43,0.15)", color: g.side === "long" ? "var(--green,#0b7949)" : "var(--red,#c0392b)", fontWeight: 800 }}>분할청산 {g.trades.length}회</span>
            </div>
            <div style={{ fontSize: 11, opacity: .5, marginTop: 1 }}>{g.trades[0].opened_at?.slice(0,16).replace("T"," ")} → {g.trades[g.trades.length-1].opened_at?.slice(0,16).replace("T"," ")}</div>
          </div>
          <div><span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: g.side === "long" ? "rgba(11,121,73,0.12)" : "rgba(192,57,43,0.12)", color: g.side === "long" ? "var(--green,#0b7949)" : "var(--red,#c0392b)" }}>{g.side.toUpperCase()}</span></div>
          <div style={{ textAlign: "right" as const, fontWeight: 900, fontSize: 15, color: pnlColor(g.totalPnl) }}>{g.totalPnl >= 0 ? "+" : ""}{fmt(g.totalPnl)}</div>
          <div style={{ fontSize: 11, opacity: .5 }}>합산 PnL</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
            <button onClick={e => { e.stopPropagation(); ungroupTrades(g.trades.map(t => t.id)); }} style={{ ...chip, fontSize: 10, padding: "3px 8px", opacity: .6 }}>해제</button>
            <span style={{ fontSize: 13, opacity: .5 }}>{isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>
        {isExpanded && <div style={{ borderTop: "1px solid var(--line-soft)" }}>{g.trades.map((t, i) => <TradeCard key={t.id} t={t} idx={i} inGroup />)}</div>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>

      {/* 상세 패널 */}
      {detailTrade && (
        <div style={{ position: "fixed" as const, inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}
          onClick={() => setDetailTrade(null)}>
          <div style={{ background: "var(--modal-bg,rgba(18,20,27,0.98))", borderRadius: 16, padding: "20px", width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" as const }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 900, fontSize: 18 }}>{detailTrade.symbol}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 6, background: detailTrade.side === "long" ? "rgba(11,121,73,0.12)" : "rgba(192,57,43,0.12)", color: detailTrade.side === "long" ? "var(--green,#0b7949)" : "var(--red,#c0392b)" }}>{detailTrade.side.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, opacity: .5, marginTop: 4 }}>{detailTrade.opened_at?.slice(0,16).replace("T"," ")}</div>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <div style={{ fontWeight: 900, fontSize: 22, color: pnlColor(detailTrade.pnl) }}>{detailTrade.pnl == null ? "—" : `${detailTrade.pnl > 0 ? "+" : ""}${fmt(detailTrade.pnl)}`}</div>
                <div style={{ fontSize: 11, opacity: .45 }}>USDT</div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, opacity: .6, fontWeight: 700, marginBottom: 8 }}>거래 평가</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {MISTAKE_TAGS.map(m => {
                  const active = detailTags.includes(m.id);
                  return (
                    <button key={m.id} onClick={() => setDetailTags(prev => active ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                      style={{ padding: "5px 11px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: active ? 800 : 600, border: `1px solid ${active ? m.color : "var(--line-soft,rgba(0,0,0,.1))"}`, background: active ? m.color + "18" : "transparent", color: active ? m.color : "inherit", transition: "all .15s" }}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, opacity: .6, fontWeight: 700, marginBottom: 6 }}>메모</div>
              <textarea value={detailNotes} onChange={e => setDetailNotes(e.target.value)} placeholder="진입 이유, 실수한 점, 개선할 점…" rows={4} style={{ ...inp, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={saveDetail} disabled={detailSaving} style={btn1}>{detailSaving ? "저장 중…" : "저장"}</button>
              <button onClick={() => setDetailTrade(null)} style={btn2}>닫기</button>
              {detailMsg && <span style={{ fontSize: 12, opacity: .7 }}>{detailMsg}</span>}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>거래기록</h1>
          <div style={{ fontSize: 12, opacity: .5, marginTop: 2 }}>청산 포지션만 표시{fetchedFrom ? ` · ${fetchedFrom} 이후` : ""}</div>
        </div>
        <button onClick={toggleRiskWidget} style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid var(--line-soft)", background: rw.trades ? "rgba(240,180,41,0.12)" : "transparent", opacity: rw.trades ? 1 : .5 }}>◬ 리스크</button>
      </div>

      {rw.trades && <RiskMiniWidget />}

      <div style={panel}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={col}><span style={lbl}>시작일</span><input type="date" value={from} max={today()} onChange={e => { setFrom(e.target.value); localStorage.setItem("trades_from", e.target.value); }} style={inp} /></div>
          <div style={col}><span style={lbl}>종료일</span><input type="date" value={to} min={from} max={today()} onChange={e => { setTo(e.target.value); localStorage.setItem("trades_to", e.target.value); }} style={inp} /></div>
          <div style={col}><span style={lbl}>심볼</span><input value={symFilter} placeholder="전체" onChange={e => setSymFilter(e.target.value)} style={{ ...inp, width: 100 }} /></div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { label: "전체",   fn: () => { setFrom(""); setTo(""); localStorage.setItem("trades_from",""); localStorage.setItem("trades_to",""); } },
              { label: "이번 달", fn: () => { const v=thisMonthStart(); setFrom(v); setTo(""); localStorage.setItem("trades_from",v); localStorage.setItem("trades_to",""); } },
              { label: "이번 주", fn: () => { const d=new Date(),day=d.getDay()||7,mon=new Date(d); mon.setDate(d.getDate()-day+1); const v=mon.toISOString().slice(0,10); setFrom(v); setTo(""); localStorage.setItem("trades_from",v); localStorage.setItem("trades_to",""); }},
              { label: "오늘",   fn: () => { const v=today(); setFrom(v); setTo(""); localStorage.setItem("trades_from",v); localStorage.setItem("trades_to",""); } },
              { label: "3개월",  fn: () => { const d=new Date(); d.setMonth(d.getMonth()-3); const v=d.toISOString().slice(0,10); setFrom(v); setTo(""); localStorage.setItem("trades_from",v); localStorage.setItem("trades_to",""); }},
            ].map(({ label, fn }) => <button key={label} onClick={fn} style={chip}>{label}</button>)}
          </div>
          <button onClick={syncAndLoad} disabled={syncing || loading} style={btn1}>{syncing ? "동기화 중…" : loading ? "로딩…" : from ? `⚡ ${from} 이후 동기화` : "⚡ 전체 동기화"}</button>
        </div>
        {syncLog && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.04)", border: "1px solid var(--line-soft)" }}>{syncLog}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 12 }}>
        {([
          ["청산",   `${stats.n}건`],
          ["PnL",    `${stats.totalPnl >= 0 ? "+" : ""}${fmt(stats.totalPnl)} USDT`, stats.totalPnl],
          ["승률",   stats.wr  != null ? `${fmt(stats.wr, 1)}%` : "—"],
          ["승/패",  `${stats.wins}W / ${stats.losses}L`],
          ["손익비", stats.rr  != null ? fmt(stats.rr, 2) : "—"],
        ] as [string, string, number?][]).map(([label, value, colorVal]) => (
          <div key={label} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line-soft,rgba(0,0,0,.1))", background: "var(--panel)" }}>
            <div style={{ fontSize: 10, opacity: .55, marginBottom: 3, fontWeight: 700 }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: 13, color: colorVal !== undefined ? pnlColor(colorVal) : "inherit" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: .5 }}>방향</span>
        {(["", "long", "short"] as const).map(v => (
          <button key={v} onClick={() => setSideFilter(v)} style={{ ...chip, fontWeight: sideFilter===v?900:600, background: sideFilter===v?"rgba(240,180,41,0.12)":"transparent", color: v==="long"&&sideFilter===v?"var(--green)":v==="short"&&sideFilter===v?"var(--red)":"inherit" }}>
            {v===""?"전체":v.toUpperCase()}
          </button>
        ))}
        <span style={{ fontSize: 12, opacity: .5, marginLeft: 6 }}>손익</span>
        {([{v:"" as const,l:"전체"},{v:"win" as const,l:"수익"},{v:"lose" as const,l:"손실"}]).map(({v,l}) => (
          <button key={v} onClick={() => setPnlFilter(v)} style={{ ...chip, fontWeight: pnlFilter===v?900:600, background: pnlFilter===v?"rgba(240,180,41,0.12)":"transparent", color: v==="win"&&pnlFilter===v?"var(--green)":v==="lose"&&pnlFilter===v?"var(--red)":"inherit" }}>{l}</button>
        ))}
        <span style={{ fontSize: 12, opacity: .5, marginLeft: 6 }}>소스</span>
        {(["", "bitget", "manual"] as const).map(v => (
          <button key={v} onClick={() => setSrcFilter(v)} style={{ ...chip, fontWeight: srcFilter===v?900:600, background: srcFilter===v?"rgba(240,180,41,0.12)":"transparent" }}>
            {v===""?"전체":v==="bitget"?"⚡ 자동":"✏️ 수동"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {groupMode ? (
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 12, alignSelf: "center", opacity: .7 }}>{selected.size}개 선택</span>
            <button onClick={groupSelected} style={btn1} disabled={selected.size < 2}>분할청산으로 묶기</button>
            <button onClick={() => { setGroupMode(false); setSelected(new Set()); }} style={btn2}>취소</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setGroupMode(true)} style={btn2}>◈ 분할청산 묶기</button>
            <button onClick={() => setFormOpen(v => !v)} style={btn1}>{formOpen ? "닫기" : "+ 수동 입력"}</button>
          </div>
        )}
      </div>

      {formOpen && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>새 거래 직접 입력</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            <div style={col}><span style={lbl}>심볼</span><input value={fSymbol} onChange={e => setFSymbol(e.target.value)} style={inp} /></div>
            <div style={col}><span style={lbl}>방향</span><select value={fSide} onChange={e => setFSide(e.target.value as any)} style={inp}><option value="long">LONG</option><option value="short">SHORT</option></select></div>
            <div style={col}><span style={lbl}>청산 시간</span><input type="datetime-local" value={fTime} onChange={e => setFTime(e.target.value)} style={inp} /></div>
            <div style={col}><span style={lbl}>실현 PnL</span><input value={fPnl} onChange={e => setFPnl(e.target.value)} placeholder="예: 120.5" style={inp} /></div>
            <div style={{ ...col, gridColumn: "1 / -1" }}><span style={lbl}>태그 (콤마 구분)</span><input value={fTags} onChange={e => setFTags(e.target.value)} placeholder="breakout, trend" style={inp} /></div>
            <div style={{ ...col, gridColumn: "1 / -1" }}><span style={lbl}>메모</span><textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></div>
          </div>
          {formErr && <div style={{ marginTop: 8, fontSize: 13, color: "var(--red, #c0392b)" }}>{formErr}</div>}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button onClick={addTrade} style={btn1}>저장</button>
            <button onClick={() => setFormOpen(false)} style={btn2}>취소</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" as const, opacity: .5, fontSize: 14 }}>불러오는 중…</div>
        ) : displayItems.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" as const, opacity: .5, fontSize: 14 }}>
            {from ? `${from} 이후 청산 기록 없음` : "청산 기록 없음 — Bitget 동기화를 눌러주세요"}
          </div>
        ) : displayItems.map((item) => {
          if (item.type === "group") return <GroupCard key={item.group.group_id} g={item.group} />;
          return (
            <div key={item.trade.id} style={{ border: item.trade.symbol === "FUNDING" ? "1px dashed rgba(120,120,255,0.25)" : "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden", background: "var(--panel)", position: "relative" as const }}>
              <TradeCard t={item.trade} idx={0} />
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <div style={{ marginTop: 10, padding: "9px 14px", border: "1px solid var(--line-soft)", borderRadius: 10, fontSize: 12, opacity: .65, display: "flex", gap: 16, flexWrap: "wrap", background: "var(--panel)" }}>
          <span>{filtered.length}건</span>
          <span>PnL: <b style={{ color: pnlColor(stats.totalPnl) }}>{stats.totalPnl >= 0 ? "+" : ""}{fmt(stats.totalPnl)}</b> USDT</span>
          <span style={{ opacity: .5 }}>거래 클릭 → 메모/평가</span>
        </div>
      )}

      <style>{`
        .tr-row:hover { background: rgba(0,0,0,0.025) !important; }
        @media (max-width: 640px) {
          .tr-row { grid-template-columns: 1fr auto !important; }
          .tr-row > *:nth-child(3), .tr-row > *:nth-child(4), .tr-row > *:nth-child(5) { display: none; }
        }
      `}</style>
    </div>
  );
}

const COLS = "1fr 80px 100px 1fr 52px";
const inp: React.CSSProperties = { padding: "8px 11px", borderRadius: 9, fontSize: 14, border: "1px solid var(--line-soft,rgba(255,255,255,.1))", background: "rgba(255,255,255,0.05)", outline: "none", width: "100%", color: "inherit" };
const lbl: React.CSSProperties = { fontSize: 10, opacity: .4, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" as const, fontFamily: "var(--font-mono,monospace)" };
const col: React.CSSProperties = { display: "grid", gap: 4 };
const panel: React.CSSProperties = { padding: "14px 16px", border: "1px solid var(--line-soft,rgba(255,255,255,.08))", borderRadius: 14, marginBottom: 12, background: "var(--panel,rgba(255,255,255,0.04))", backdropFilter: "blur(8px)" };
const btn1: React.CSSProperties = { padding: "9px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" as const, border: "1px solid rgba(240,180,41,0.3)", background: "rgba(240,180,41,0.12)", color: "var(--accent,#F0B429)", fontWeight: 700, fontSize: 13 };
const btn2: React.CSSProperties = { padding: "9px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" as const, border: "1px solid var(--line-soft,rgba(255,255,255,.1))", background: "transparent", fontWeight: 600, fontSize: 13 };
const chip: React.CSSProperties = { padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 12, border: "1px solid var(--line-soft,rgba(255,255,255,.1))", background: "transparent" };
const danger: React.CSSProperties = { padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11, border: "1px solid rgba(255,77,77,.25)", background: "rgba(255,77,77,.07)", color: "var(--red, #FF4D4D)", fontWeight: 700 };
