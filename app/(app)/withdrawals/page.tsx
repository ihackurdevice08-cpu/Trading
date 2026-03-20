"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";

const toN = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const fmt = (v: any, d = 2) => toN(v).toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
function today() { return new Date().toISOString().slice(0, 10); }

const SOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  profit:  { label: "수익 출금",  color: "var(--green, #0b7949)",  bg: "rgba(11,121,73,0.1)"  },
  seed:    { label: "원금 회수",  color: "#d97706",                 bg: "rgba(217,119,6,0.1)"  },
  rebate:  { label: "리베이트",   color: "var(--accent, #B89A5A)", bg: "rgba(184,154,90,0.1)" },
};

const iStyle: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 10,
  border: "1px solid var(--line-soft)",
  background: "rgba(255,255,255,0.06)", color: "inherit",
  outline: "none", width: "100%", fontSize: 14,
};
const btn1: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 9, border: "none",
  background: "var(--accent,#F0B429)", color: "#0a0a0a",
  fontWeight: 800, fontSize: 13, cursor: "pointer",
};
const btn2: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 9,
  border: "1px solid var(--line-soft)",
  background: "transparent", fontWeight: 700, fontSize: 13, cursor: "pointer",
};

type SortKey = "date_asc" | "date_desc" | "amount_asc" | "amount_desc";

export default function WithdrawalsPage() {
  const [list,     setList]     = useState<any[]>([]);
  const [totals,   setTotals]   = useState<any>({});
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // 정렬 / 필터
  const [sortKey,   setSortKey]   = useState<SortKey>("date_asc");
  const [filterFrom, setFilterFrom] = useState("");

  // 입력 폼
  const [fAmount, setFAmount] = useState("");
  const [fSource, setFSource] = useState<"profit"|"seed"|"rebate">("profit");
  const [fNote,   setFNote]   = useState("");
  const [fDate,   setFDate]   = useState(today);

  // 인라인 편집
  const [editId,     setEditId]     = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote,   setEditNote]   = useState("");

  // 드래그앤드롭
  const dragIdx   = useRef<number | null>(null);
  const dragOver  = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/withdrawals", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (j?.ok) { setList(j.withdrawals || []); setTotals(j.totals || {}); }
    else setErr(j?.error || "불러오기 실패");
  }, []);

  useEffect(() => { load(); }, [load]);

  // 정렬 + 날짜 필터 적용
  const displayed = useMemo(() => {
    let items = [...list];

    // 날짜 필터
    if (filterFrom) {
      items = items.filter(w => (w.withdrawn_at || "") >= filterFrom);
    }

    // 정렬
    switch (sortKey) {
      case "date_asc":
        items.sort((a, b) => {
          const diff = (a.withdrawn_at||"").localeCompare(b.withdrawn_at||"");
          return diff !== 0 ? diff : (a.created_at||"").localeCompare(b.created_at||"");
        });
        break;
      case "date_desc":
        items.sort((a, b) => {
          const diff = (b.withdrawn_at||"").localeCompare(a.withdrawn_at||"");
          return diff !== 0 ? diff : (b.created_at||"").localeCompare(a.created_at||"");
        });
        break;
      case "amount_asc":
        items.sort((a, b) => toN(a.amount) - toN(b.amount));
        break;
      case "amount_desc":
        items.sort((a, b) => toN(b.amount) - toN(a.amount));
        break;
    }
    return items;
  }, [list, sortKey, filterFrom]);

  // 월별 그룹 (displayed 기준)
  const grouped = useMemo(() => {
    const monthMap: Record<string, any[]> = {};
    const order: string[] = [];
    for (const w of displayed) {
      const key = (w.withdrawn_at || "")?.slice(0, 7) || "unknown";
      if (!monthMap[key]) { monthMap[key] = []; order.push(key); }
      monthMap[key].push(w);
    }
    return order.map(k => [k, monthMap[k]] as [string, any[]]);
  }, [displayed]);

  async function submit() {
    if (!fAmount || toN(fAmount) <= 0) { setErr("금액을 입력해줘"); return; }
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/withdrawals", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: toN(fAmount), source: fSource, note: fNote, withdrawn_at: fDate }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "저장 실패"); return; }
      setFAmount(""); setFNote(""); setFDate(today()); setFormOpen(false);
      await load();
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm("삭제할까요?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/withdrawals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "삭제 실패"); return; }
      await load();
    } finally { setBusy(false); }
  }

  function startEdit(w: any) {
    setEditId(w.id);
    setEditAmount(String(w.amount));
    setEditNote(w.note ?? "");
  }

  async function saveEdit(id: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/withdrawals", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, amount: toN(editAmount), note: editNote }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "수정 실패"); return; }
      setEditId(null);
      await load();
    } finally { setBusy(false); }
  }

  function onDragStart(idx: number) { dragIdx.current = idx; setDragging(idx); }
  function onDragEnter(idx: number) { dragOver.current = idx; }
  function onDragEnd() {
    setDragging(null);
    if (dragIdx.current === null || dragOver.current === null || dragIdx.current === dragOver.current) {
      dragIdx.current = dragOver.current = null; return;
    }
    const newList = [...list];
    const fromI = list.indexOf(displayed[dragIdx.current]);
    const toI   = list.indexOf(displayed[dragOver.current]);
    dragIdx.current = dragOver.current = null;
    if (fromI < 0 || toI < 0) return;
    const [moved] = newList.splice(fromI, 1);
    newList.splice(toI, 0, moved);
    setList(newList);
    const sort_orders: Record<string, number> = {};
    newList.forEach((w, i) => { sort_orders[w.id] = i; });
    fetch("/api/withdrawals", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sort_orders }),
    });
  }

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "date_asc",    label: "날짜 오름차순" },
    { key: "date_desc",   label: "날짜 내림차순" },
    { key: "amount_asc",  label: "금액 오름차순" },
    { key: "amount_desc", label: "금액 내림차순" },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>출금 기록</h1>
        <button onClick={() => setFormOpen(v => !v)} style={btn1}>
          {formOpen ? "닫기" : "+ 출금 기록"}
        </button>
      </div>

      {err && (
        <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 12,
          border: "1px solid rgba(192,57,43,.2)", color: "var(--red,#c0392b)",
          background: "rgba(192,57,43,.06)", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>{err}</span>
          <button onClick={() => setErr("")} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.5 }}>✕</button>
        </div>
      )}

      {/* 누적 요약 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 8, marginBottom: 16 }}>
        {([
          ["누적 출금 합계", totals.total,  "inherit"],
          ["수익 출금",      totals.profit, "var(--green,#0b7949)"],
          ["원금 회수",      totals.seed,   "#d97706"],
          ["리베이트",       totals.rebate, "var(--accent,#B89A5A)"],
        ] as [string, any, string][]).map(([label, val, color]) => (
          <div key={label} style={{ padding: "12px 14px", borderRadius: 12,
            border: "1px solid var(--line-soft)", background: "var(--panel)" }}>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>{label}</div>
            <div style={{ fontWeight: 900, fontSize: 16, color }}>
              {fmt(val || 0)} <span style={{ fontSize: 11, fontWeight: 500 }}>USDT</span>
            </div>
          </div>
        ))}
      </div>

      {/* 입력 폼 */}
      {formOpen && (
        <div style={{ padding: "14px 16px", borderRadius: 12, marginBottom: 16,
          border: "1px solid var(--line-soft)", background: "var(--panel)" }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 12 }}>출금 기록 추가</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>금액 (USDT)</span>
              <input type="number" min="0" placeholder="예: 500" value={fAmount}
                onChange={e => setFAmount(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()} style={iStyle} />
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>출금 종류</span>
              <select value={fSource} onChange={e => setFSource(e.target.value as any)} style={iStyle}>
                <option value="profit">수익 출금</option>
                <option value="seed">원금 회수</option>
                <option value="rebate">리베이트</option>
              </select>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>날짜</span>
              <input type="date" value={fDate} max={today()}
                onChange={e => setFDate(e.target.value)} style={iStyle} />
            </div>
            <div style={{ display: "grid", gap: 4, gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>메모 (선택)</span>
              <input placeholder="예: 월세, 생활비..." value={fNote}
                onChange={e => setFNote(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()} style={iStyle} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={submit} disabled={busy} style={btn1}>{busy ? "저장 중…" : "저장"}</button>
            <button onClick={() => setFormOpen(false)} style={btn2}>취소</button>
          </div>
        </div>
      )}

      {/* 정렬 + 날짜 필터 바 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" as const, alignItems: "center" }}>
        <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
          style={{ ...iStyle, width: "auto", fontSize: 12, padding: "6px 10px" }}>
          {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.5, whiteSpace: "nowrap" as const }}>날짜 시작</span>
          <input type="date" value={filterFrom} max={today()}
            onChange={e => setFilterFrom(e.target.value)}
            style={{ ...iStyle, width: "auto", fontSize: 12, padding: "6px 10px" }} />
          {filterFrom && (
            <button onClick={() => setFilterFrom("")}
              style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.5, fontSize: 13 }}>✕</button>
          )}
        </div>
        <span style={{ fontSize: 11, opacity: 0.4, marginLeft: "auto" }}>
          {displayed.length}건 · ↕ 드래그 순서 변경
        </span>
      </div>

      {/* 월별 리스트 */}
      {grouped.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center" as const, opacity: 0.5, fontSize: 14 }}>
          {filterFrom ? "해당 기간 출금 기록이 없습니다." : "출금 기록이 없습니다."}
        </div>
      ) : grouped.map(([month, rows]) => {
        const monthTotal = rows.reduce((s, r) => s + toN(r.amount), 0);
        return (
          <div key={month} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.6 }}>{month}</span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>합계 {fmt(monthTotal)} USDT</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              {rows.map((w) => {
                const dispIdx = displayed.indexOf(w);
                const meta = SOURCE_LABELS[w.source] || SOURCE_LABELS.profit;
                const isEditing = editId === w.id;
                return (
                  <div key={w.id}
                    draggable
                    onDragStart={() => onDragStart(dispIdx)}
                    onDragEnter={() => onDragEnter(dispIdx)}
                    onDragEnd={onDragEnd}
                    onDragOver={e => e.preventDefault()}
                    style={{
                      padding: "12px 14px", borderRadius: 12,
                      border: dragging === dispIdx ? "1px dashed var(--accent,#F0B429)" : "1px solid var(--line-soft)",
                      background: dragging === dispIdx ? "rgba(240,180,41,0.05)" : "var(--panel)",
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", gap: 12, flexWrap: "wrap" as const,
                      cursor: "grab", opacity: dragging === dispIdx ? 0.5 : 1,
                      transition: "all 0.1s",
                    }}>
                    <span style={{ fontSize: 14, opacity: 0.3, cursor: "grab", flexShrink: 0 }}>⠿</span>

                    {isEditing ? (
                      <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" as const }}>
                        <input type="number" value={editAmount} min="0"
                          onChange={e => setEditAmount(e.target.value)}
                          style={{ ...iStyle, width: 100, fontSize: 13 }} autoFocus />
                        <input type="text" value={editNote} placeholder="메모"
                          onChange={e => setEditNote(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && saveEdit(w.id)}
                          style={{ ...iStyle, flex: 1, minWidth: 80, fontSize: 13 }} />
                        <button onClick={() => saveEdit(w.id)} disabled={busy}
                          style={{ ...btn1, padding: "7px 12px", fontSize: 12 }}>저장</button>
                        <button onClick={() => setEditId(null)}
                          style={{ ...btn2, padding: "7px 10px", fontSize: 12 }}>취소</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const, flex: 1 }}
                          onDoubleClick={() => startEdit(w)} title="더블클릭으로 수정">
                          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6,
                            fontWeight: 800, color: meta.color, background: meta.bg }}>
                            {meta.label}
                          </span>
                          <span style={{ fontWeight: 900, fontSize: 16 }}>
                            {fmt(w.amount)} <span style={{ fontSize: 11, fontWeight: 500 }}>USDT</span>
                          </span>
                          {w.note && <span style={{ fontSize: 12, opacity: 0.6 }}>{w.note}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ fontSize: 11, opacity: 0.5 }}>{w.withdrawn_at?.slice(0, 10)}</span>
                          <button onClick={() => startEdit(w)}
                            style={{ padding: "4px 9px", borderRadius: 7, fontSize: 11,
                              border: "1px solid var(--line-soft)", background: "transparent",
                              cursor: "pointer", fontWeight: 700, opacity: 0.6 }}>수정</button>
                          <button onClick={() => del(w.id)} disabled={busy}
                            style={{ padding: "4px 9px", borderRadius: 7, fontSize: 11,
                              border: "1px solid rgba(192,57,43,.25)",
                              background: "rgba(192,57,43,.07)", color: "var(--red,#c0392b)",
                              cursor: "pointer", fontWeight: 700 }}>삭제</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// built: 20260320060859
