"use client";
import { useEffect, useState, useCallback, useMemo } from "react";

const toN = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const fmt = (v: any, d = 2) => {
  const n = toN(v);
  return n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
};
function today() { return new Date().toISOString().slice(0, 10); }

const SOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  profit:  { label: "수익 출금",   color: "var(--green, #0b7949)",  bg: "rgba(11,121,73,0.1)"  },
  seed:    { label: "원금 회수",   color: "#d97706",                 bg: "rgba(217,119,6,0.1)"  },
  rebate:  { label: "리베이트",    color: "var(--accent, #B89A5A)", bg: "rgba(184,154,90,0.1)" },
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

export default function WithdrawalsPage() {
  const [list,    setList]    = useState<any[]>([]);
  const [totals,  setTotals]  = useState<any>({});
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const [fAmount, setFAmount] = useState("");
  const [fSource, setFSource] = useState<"profit"|"seed"|"rebate">("profit");
  const [fNote,   setFNote]   = useState("");
  const [fDate,   setFDate]   = useState(today);

  const load = useCallback(async () => {
    const r = await fetch("/api/withdrawals", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (j?.ok) { setList(j.withdrawals || []); setTotals(j.totals || {}); }
    else setErr(j?.error || "불러오기 실패");
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!fAmount || toN(fAmount) <= 0) { setErr("금액을 입력해줘"); return; }
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/withdrawals", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: toN(fAmount), source: fSource,
          note: fNote, withdrawn_at: fDate,
        }),
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

  // 월별 그룹
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const w of list) {
      const key = (w.withdrawn_at || w.date || "")?.slice(0, 7) || "unknown";
      if (!map[key]) map[key] = [];
      map[key].push(w);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [list]);

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
          <button onClick={() => setErr("")} style={{ background: "none", border: "none",
            cursor: "pointer", opacity: 0.5 }}>✕</button>
        </div>
      )}

      {/* 누적 요약 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))",
        gap: 8, marginBottom: 16 }}>
        {[
          ["누적 출금 합계",  totals.total,   "inherit"],
          ["수익 출금",       totals.profit,  "var(--green,#0b7949)"],
          ["원금 회수",       totals.seed,    "#d97706"],
          ["리베이트",        totals.rebate,  "var(--accent,#B89A5A)"],
        ].map(([label, val, color]) => (
          <div key={label as string} style={{ padding: "12px 14px", borderRadius: 12,
            border: "1px solid var(--line-soft)",
            background: "var(--panel)" }}>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>{label}</div>
            <div style={{ fontWeight: 900, fontSize: 16, color: color as string }}>
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
                onKeyDown={e => e.key === "Enter" && submit()}
                style={iStyle} />
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>출금 종류</span>
              <select value={fSource} onChange={e => setFSource(e.target.value as any)} style={iStyle}>
                <option value="profit">수익 출금 — 거래 수익에서</option>
                <option value="seed">원금 회수 — 초기 시드에서</option>
                <option value="rebate">리베이트 — 거래소 리베이트</option>
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
                onKeyDown={e => e.key === "Enter" && submit()}
                style={iStyle} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={submit} disabled={busy} style={btn1}>{busy ? "저장 중…" : "저장"}</button>
            <button onClick={() => setFormOpen(false)} style={btn2}>취소</button>
          </div>
        </div>
      )}

      {/* 월별 리스트 */}
      {grouped.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center" as const, opacity: 0.5, fontSize: 14 }}>
          출금 기록이 없습니다.
        </div>
      ) : grouped.map(([month, rows]) => {
        const monthTotal = rows.reduce((s, r) => s + toN(r.amount), 0);
        return (
          <div key={month} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.6 }}>{month}</span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>합계 {fmt(monthTotal)} USDT</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              {rows.map(w => {
                const meta = SOURCE_LABELS[w.source] || SOURCE_LABELS.profit;
                return (
                  <div key={w.id} style={{ padding: "12px 14px", borderRadius: 12,
                    border: "1px solid var(--line-soft)",
                    background: "var(--panel)",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
                      <span style={{ fontSize: 11, opacity: 0.5 }}>
                        {w.withdrawn_at?.slice(0, 10)}
                      </span>
                      <button onClick={() => del(w.id)} disabled={busy}
                        style={{ padding: "4px 9px", borderRadius: 7, fontSize: 11,
                          border: "1px solid rgba(192,57,43,.25)",
                          background: "rgba(192,57,43,.07)", color: "var(--red,#c0392b)",
                          cursor: "pointer", fontWeight: 700 }}>삭제</button>
                    </div>
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
