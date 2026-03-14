"use client";
import { useEffect, useMemo, useState, useCallback } from "react";

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const barPct = (cur: number, tgt: number) => tgt > 0 ? clamp((cur / tgt) * 100, 0, 100) : 0;
const displayPct = (cur: number, tgt: number) => tgt > 0 ? (cur / tgt) * 100 : 0;

function Bar({ cur, tgt }: { cur: number; tgt: number }) {
  const p    = barPct(cur, tgt);
  const over = cur > tgt && tgt > 0;
  return (
    <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${p}%`, height: "100%", borderRadius: 999,
        background: over ? "var(--green, #0b7949)" : "var(--accent,#B89A5A)",
        transition: "width 0.3s" }} />
    </div>
  );
}

const iStyle: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 10,
  border: "1px solid var(--line-soft)",
  background: "rgba(255,255,255,0.06)", color: "inherit",
  outline: "none", width: "100%", fontSize: 15,
};
const btnBase: React.CSSProperties = {
  borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: "pointer", padding: "7px 12px",
};

export default function GoalsPage() {
  const [goals,   setGoals]   = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState("");

  const [title,  setTitle]  = useState("");
  const [type,   setType]   = useState<"pnl"|"withdrawal"|"counter"|"boolean">("pnl");
  const [target, setTarget] = useState("");

  const [editProgress, setEditProgress] = useState<Record<string, string>>({});
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editTitle,    setEditTitle]    = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/goals-v2?includeCompleted=1", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "불러오기 실패"); return; }
      setGoals(j.goals || []);
      setHistory(j.history || []);
    } catch (e: any) { setErr(e?.message || "네트워크 오류"); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!title.trim()) { setErr("목표 제목을 입력해줘"); return; }
    if (type !== "boolean" && n(target) <= 0) { setErr("목표 수치를 0보다 크게 입력해줘"); return; }
    setErr(""); setBusy(true);
    try {
      const payload: any = { title: title.trim(), type, period: "monthly" };
      if (type !== "boolean") payload.target_value = n(target);
      const r = await fetch("/api/goals-v2", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "생성 실패"); return; }
      setTitle(""); setTarget("");
      await load();
    } finally { setBusy(false); }
  }

  async function updateProgress(g: any) {
    const val = editProgress[g.id] ?? "";
    if (val === "") { setErr("값을 입력해줘"); return; }
    const cur = Number(val);
    if (!Number.isFinite(cur)) { setErr("숫자를 입력해줘"); return; }
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/goals-v2", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: g.id, current_value: cur }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "저장 실패"); return; }
      setEditProgress(p => ({ ...p, [g.id]: "" }));
      await load();
    } finally { setBusy(false); }
  }

  async function saveTitle(g: any) {
    const t = (editTitle[g.id] ?? "").trim();
    if (!t) { setErr("제목이 비어있어"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/goals-v2", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: g.id, title: t }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "저장 실패"); return; }
      setEditingId(null);
      await load();
    } finally { setBusy(false); }
  }

  async function markDone(g: any) {
    setBusy(true);
    try {
      const r = await fetch("/api/goals-v2", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: g.id, current_value: g.type === "boolean" ? 1 : n(g.target_value) }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "완료 처리 실패"); return; }
      await load();
    } finally { setBusy(false); }
  }

  async function archiveGoal(g: any) {
    if (!confirm("숨김 처리할까요?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/goals-v2?id=${encodeURIComponent(g.id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "실패"); return; }
      await load();
    } finally { setBusy(false); }
  }

  async function hardDelete(g: any) {
    if (!confirm("⚠️ 완전 삭제할까요? 복구 불가능합니다.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/goals-v2?id=${encodeURIComponent(g.id)}&hard=1`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "실패"); return; }
      await load();
    } finally { setBusy(false); }
  }

  const active    = useMemo(() => goals.filter(g => g.status === "active"),    [goals]);
  const completed = useMemo(() => goals.filter(g => g.status === "completed"), [goals]);

  const totalAchievedPnl = useMemo(() =>
    history.filter(h => h.type === "pnl")
      .reduce((s: number, h: any) => s + n(h.current_value ?? h.target_value), 0), [history]);
  const totalWithdrawal = useMemo(() =>
    history.filter(h => h.type === "withdrawal")
      .reduce((s: number, h: any) => s + n(h.current_value ?? h.target_value), 0), [history]);

  const typeLabel = (t: string) =>
    t === "pnl" ? "수익" : t === "withdrawal" ? "출금" : t === "counter" ? "횟수" : "체크";
  const unitLabel = (t: string) =>
    t === "pnl" || t === "withdrawal" ? "USDT" : t === "counter" ? "회" : "";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 900 }}>Goals</h1>

      {err && (
        <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 12,
          border: "1px solid rgba(192,57,43,.2)", color: "var(--red, #c0392b)",
          background: "rgba(192,57,43,.06)", fontSize: 13,
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{err}</span>
          <button onClick={() => setErr("")} style={{ opacity: 0.5, background: "none",
            border: "none", cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>
      )}

      {/* 누적 성과 */}
      <div style={{ border: "1px solid var(--line-soft)", padding: "12px 14px",
        borderRadius: 12, marginBottom: 14, background: "var(--panel)" }}>
        <div style={{ fontWeight: 900, marginBottom: 8, fontSize: 14 }}>누적 성과</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
          {[
            ["수익 달성 합계", `+${totalAchievedPnl.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} USDT`],
            ["출금 달성 합계", `${totalWithdrawal.toLocaleString("ko-KR",   { maximumFractionDigits: 2 })} USDT`],
            ["목표 완료 횟수", `${history.length}회`],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 2 }}>{label}</div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 새 목표 만들기 */}
      <div style={{ border: "1px solid var(--line-soft)", padding: "12px 14px",
        borderRadius: 12, marginBottom: 16, background: "var(--panel)" }}>
        <div style={{ fontWeight: 900, marginBottom: 10, fontSize: 14 }}>새 목표 만들기</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <input placeholder="목표 제목" value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            style={iStyle} />
          <input placeholder={type === "boolean" ? "수치 없음" : "목표 수치"}
            value={target} type="number" min="0"
            onChange={e => setTarget(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            disabled={type === "boolean"}
            style={iStyle} />
          <select value={type} onChange={e => setType(e.target.value as any)} style={iStyle}>
            <option value="pnl">수익(PnL) — 자동</option>
            <option value="withdrawal">출금 — 수동</option>
            <option value="counter">횟수 — 수동</option>
            <option value="boolean">1회성 체크</option>
          </select>
          <button onClick={create} disabled={busy} style={{
            padding: "9px 14px", borderRadius: 10, border: "none",
            background: busy ? "rgba(255,255,255,0.08)" : "var(--accent,#F0B429)",
            color: "#0a0a0a", fontWeight: 900, fontSize: 14,
            cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "처리중…" : "생성"}
          </button>
        </div>
        <div style={{ fontSize: 11, opacity: 0.45, marginTop: 6 }}>
          수익(PnL) 목표는 이달 거래기록 PnL이 자동 반영됩니다.
        </div>
      </div>

      {/* 진행중 */}
      <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 900 }}>진행중 ({active.length})</h2>
      {active.length === 0 && <div style={{ opacity: 0.6, fontSize: 14, marginBottom: 12 }}>없음</div>}

      {active.map((g: any) => {
        const cur    = n(g.current_value);
        const tgt    = n(g.target_value);
        const isBool = g.type === "boolean";
        const isAuto = g.mode === "auto";
        const unit   = unitLabel(String(g.type));
        const dpct   = displayPct(cur, tgt);
        const isOver = !isBool && cur > tgt && tgt > 0;
        const isEdit = editingId === g.id;

        return (
          <div key={g.id} style={{
            border: "1px solid var(--line-soft)",
            borderLeft: isOver ? "3px solid var(--green, #0b7949)" : undefined,
            padding: "12px 14px", borderRadius: 12, marginBottom: 10,
            background: "var(--panel)" }}>

            {/* 제목 */}
            <div style={{ display: "flex", justifyContent: "space-between",
              gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {isEdit ? (
                <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
                  <input value={editTitle[g.id] ?? g.title ?? ""}
                    onChange={e => setEditTitle(p => ({ ...p, [g.id]: e.target.value }))}
                    style={{ ...iStyle, flex: 1, minWidth: 120 }} />
                  <button onClick={() => saveTitle(g)} disabled={busy}
                    style={{ ...btnBase, border: "1px solid var(--line-soft)", background: "transparent" }}>저장</button>
                  <button onClick={() => setEditingId(null)}
                    style={{ ...btnBase, border: "1px solid var(--line-soft)", background: "transparent", fontWeight: 600 }}>취소</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 900, fontSize: 14 }}>{g.title || "(untitled)"}</span>
                  <button onClick={() => { setEditingId(g.id); setEditTitle(p => ({ ...p, [g.id]: g.title || "" })); }}
                    style={{ padding: "3px 7px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                      border: "1px solid var(--line-soft)", background: "transparent" }}>수정</button>
                </div>
              )}
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {isAuto && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 5,
                    background: "rgba(184,154,90,0.12)", color: "var(--accent,#B89A5A)",
                    border: "1px solid rgba(184,154,90,0.25)" }}>자동</span>
                )}
                {isOver && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 5,
                    background: "rgba(11,121,73,0.1)", color: "var(--green, #0b7949)",
                    border: "1px solid rgba(11,121,73,0.2)" }}>목표 초과</span>
                )}
                <span style={{ fontSize: 11, opacity: 0.55 }}>{typeLabel(String(g.type))}</span>
              </div>
            </div>

            {/* 진행률 */}
            <div style={{ marginTop: 8 }}>
              {isBool ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>미완료</div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                    <span>
                      {cur.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                      {" / "}
                      {tgt.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                      {" "}{unit}
                    </span>
                    <span style={{ color: isOver ? "var(--green, #0b7949)" : undefined, fontWeight: isOver ? 800 : undefined }}>
                      {dpct.toFixed(1)}%
                    </span>
                  </div>
                  <Bar cur={cur} tgt={tgt} />
                </>
              )}
            </div>

            {/* 액션 */}
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {isBool ? (
                <button onClick={() => markDone(g)} disabled={busy}
                  style={{ ...btnBase, border: "1px solid var(--accent,#B89A5A)",
                    background: "rgba(184,154,90,0.1)", cursor: busy ? "not-allowed" : "pointer" }}>달성</button>
              ) : isAuto ? (
                <span style={{ fontSize: 12, opacity: 0.5, fontStyle: "italic" }}>
                  ◈ 이달 거래기록 PnL 자동 반영 중
                </span>
              ) : (
                <>
                  <input style={{ ...iStyle, width: 150, padding: "7px 10px", fontSize: 13 }}
                    placeholder={`${typeLabel(String(g.type))} 입력`}
                    type="number"
                    value={editProgress[g.id] ?? ""}
                    onChange={e => setEditProgress(p => ({ ...p, [g.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && updateProgress(g)} />
                  <button onClick={() => updateProgress(g)} disabled={busy}
                    style={{ ...btnBase, border: "1px solid var(--accent,#B89A5A)",
                      background: "rgba(184,154,90,0.1)", cursor: busy ? "not-allowed" : "pointer" }}>저장</button>
                  <button onClick={() => markDone(g)} disabled={busy}
                    style={{ ...btnBase, border: "1px solid var(--line-soft)",
                      background: "transparent", fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>완료 처리</button>
                </>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => archiveGoal(g)} disabled={busy}
                style={{ ...btnBase, padding: "5px 10px", fontSize: 12, fontWeight: 600,
                  border: "1px solid var(--line-soft)", background: "transparent",
                  opacity: 0.7, cursor: busy ? "not-allowed" : "pointer" }}>숨김</button>
              <button onClick={() => hardDelete(g)} disabled={busy}
                style={{ ...btnBase, padding: "5px 10px", fontSize: 12,
                  border: "1px solid rgba(188,10,7,.2)", color: "var(--red, #c0392b)",
                  background: "transparent", cursor: busy ? "not-allowed" : "pointer" }}>삭제</button>
            </div>
          </div>
        );
      })}

      {/* 완료된 목표 */}
      {completed.length > 0 && (
        <>
          <h2 style={{ margin: "16px 0 10px", fontSize: 15, fontWeight: 900 }}>
            완료된 목표 ({completed.length})
          </h2>
          {completed.map((g: any) => {
            const achieved = n(g.current_value) > 0 ? g.current_value : g.target_value;
            const unit = unitLabel(String(g.type));
            return (
              <div key={g.id} style={{ border: "1px solid var(--line-soft)",
                padding: "10px 14px", borderRadius: 12, marginBottom: 8,
                opacity: 0.75, background: "var(--panel)" }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{g.title}</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    {g.type === "boolean"
                      ? "✓ 완료"
                      : `${n(achieved).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} ${unit} 달성`}
                  </span>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button onClick={() => archiveGoal(g)}
                    style={{ ...btnBase, padding: "5px 10px", fontSize: 12, fontWeight: 600,
                      border: "1px solid var(--line-soft)", background: "transparent" }}>숨김</button>
                  <button onClick={() => hardDelete(g)}
                    style={{ ...btnBase, padding: "5px 10px", fontSize: 12,
                      border: "1px solid rgba(188,10,7,.2)", color: "var(--red, #c0392b)",
                      background: "transparent" }}>삭제</button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
