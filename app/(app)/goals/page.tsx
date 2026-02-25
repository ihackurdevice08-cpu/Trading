"use client";
import { useEffect, useMemo, useState } from "react";

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const pct = (cur: number, tgt: number) => tgt > 0 ? clamp((cur / tgt) * 100, 0, 200) : 0;

function Bar({ cur, tgt }: { cur: number; tgt: number }) {
  const p = pct(cur, tgt);
  return (
    <div style={{ height: 6, background: "rgba(0,0,0,0.08)", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${p}%`, height: "100%", background: "var(--accent,#B89A5A)", borderRadius: 999 }} />
    </div>
  );
}

const iStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid var(--line-soft, rgba(0,0,0,.12))",
  background: "rgba(0,0,0,.04)",
  color: "inherit",
  outline: "none",
  width: "100%",
  fontSize: 15,
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"pnl" | "withdrawal" | "counter" | "boolean">("pnl");
  const [target, setTarget] = useState("");
  const [editProgress, setEditProgress] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<Record<string, string>>({});

  async function load() {
    setErr("");
    const r = await fetch("/api/goals-v2?includeCompleted=1", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!j?.ok) { setErr(j?.error || "불러오기 실패"); return; }
    setGoals(j.goals || []);
    setHistory(j.history || []);
  }

  async function create() {
    setErr(""); setBusy(true);
    try {
      const payload: any = { title: title.trim(), type, period: "monthly" };
      if (!payload.title) { setErr("목표 제목을 입력해줘"); return; }
      if (type !== "boolean") {
        payload.target_value = n(target);
        if (!payload.target_value) { setErr("목표 수치를 입력해줘"); return; }
      }
      const r = await fetch("/api/goals-v2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "생성 실패"); return; }
      setTitle(""); setTarget(""); await load();
    } finally { setBusy(false); }
  }

  async function updateProgress(g: any) {
    setErr(""); setBusy(true);
    try {
      const cur = g.type === "boolean" ? 1 : n(editProgress[g.id]);
      const r = await fetch("/api/goals-v2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: g.id, current_value: cur }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "저장 실패"); return; }
      setEditProgress((p) => ({ ...p, [g.id]: "" }));
      await load();
    } finally { setBusy(false); }
  }

  async function saveTitle(g: any) {
    const t = (editTitle[g.id] ?? "").trim();
    if (!t) { setErr("제목이 비어있어"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/goals-v2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: g.id, title: t }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErr(j?.error || "저장 실패"); return; }
      setEditingId(null); await load();
    } finally { setBusy(false); }
  }

  async function markDone(g: any) {
    setBusy(true);
    try {
      await fetch("/api/goals-v2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: g.id, current_value: g.type === "boolean" ? 1 : g.target_value }),
      });
      await load();
    } finally { setBusy(false); }
  }

  async function archiveGoal(g: any) {
    if (!confirm("숨김 처리할까요?")) return;
    const r = await fetch(`/api/goals-v2?id=${encodeURIComponent(g.id)}`, { method: "DELETE" });
    const j = await r.json().catch(() => null);
    if (!j?.ok) { setErr(j?.error || "실패"); return; }
    await load();
  }

  async function hardDelete(g: any) {
    if (!confirm("⚠️ 완전 삭제할까요?")) return;
    const r = await fetch(`/api/goals-v2?id=${encodeURIComponent(g.id)}&hard=1`, { method: "DELETE" });
    const j = await r.json().catch(() => null);
    if (!j?.ok) { setErr(j?.error || "실패"); return; }
    await load();
  }

  useEffect(() => { load(); }, []);

  const active = useMemo(() => goals.filter((g) => g.status === "active"), [goals]);
  const completed = useMemo(() => goals.filter((g) => g.status === "completed"), [goals]);

  const totalAchieved = useMemo(() =>
    (history || []).filter((h: any) => String(h.unit) === "usd").reduce((a: number, b: any) => a + n(b.target_value), 0), [history]);
  const totalWithdrawal = useMemo(() =>
    (history || []).filter((h: any) => String(h.type) === "withdrawal").reduce((a: number, b: any) => a + n(b.target_value), 0), [history]);

  const typeLabel = (t: string) =>
    t === "pnl" ? "수익" : t === "withdrawal" ? "출금" : t === "counter" ? "횟수" : "체크";
  const unitLabel = (t: string) =>
    t === "pnl" || t === "withdrawal" ? "USDT" : t === "counter" ? "회" : "";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 900 }}>Goals</h1>

      {err && <div style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line-soft,#eee)", marginBottom: 12, color: "var(--red, #c0392b)", fontSize: 13 }}>{err}</div>}

      {/* 누적 통계 */}
      <div style={{ border: "1px solid var(--line-soft,#eee)", padding: "12px 14px", borderRadius: 12, marginBottom: 14, background: "var(--panel,white)" }}>
        <div style={{ fontWeight: 900, marginBottom: 8, fontSize: 14 }}>누적 성과</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
          {[
            ["달성 금액", `${totalAchieved.toLocaleString()} USDT`],
            ["출금 달성", `${totalWithdrawal.toLocaleString()} USDT`],
            ["완료 횟수", `${(history || []).length}회`],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, opacity: 0.55 }}>{label}</div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 새 목표 만들기 */}
      <div style={{ border: "1px solid var(--line-soft,#eee)", padding: "12px 14px", borderRadius: 12, marginBottom: 16, background: "var(--panel,white)" }}>
        <div style={{ fontWeight: 900, marginBottom: 10, fontSize: 14 }}>새 목표 만들기</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <input placeholder="목표 제목" value={title} onChange={(e) => setTitle(e.target.value)} style={iStyle} />
          <input
            placeholder={type === "boolean" ? "수치 없음" : "목표 수치"}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={type === "boolean"}
            style={iStyle}
          />
          <select value={type} onChange={(e) => setType(e.target.value as any)} style={iStyle}>
            <option value="pnl">수익(PnL)</option>
            <option value="withdrawal">출금</option>
            <option value="counter">횟수</option>
            <option value="boolean">1회성 체크</option>
          </select>
          <button onClick={create} disabled={busy} style={{
            padding: "9px 14px", borderRadius: 10, border: "none",
            background: "var(--text-primary,#111)", color: "white", fontWeight: 900, fontSize: 14, cursor: "pointer",
          }}>
            {busy ? "처리중..." : "생성"}
          </button>
        </div>
      </div>

      {/* 진행중 목표 */}
      <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 900 }}>진행중 ({active.length})</h2>
      {active.length === 0 && <div style={{ opacity: 0.6, fontSize: 14, marginBottom: 12 }}>없음</div>}

      {active.map((g: any) => {
        const cur = n(g.current_value);
        const tgt = n(g.target_value);
        const isBool = g.type === "boolean";
        const unit = unitLabel(String(g.type));
        const isEditing = editingId === g.id;

        return (
          <div key={g.id} style={{ border: "1px solid var(--line-soft,#eee)", padding: "12px 14px", borderRadius: 12, marginBottom: 10, background: "var(--panel,white)" }}>
            {/* 제목 */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {isEditing ? (
                <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
                  <input
                    value={editTitle[g.id] ?? g.title ?? ""}
                    onChange={(e) => setEditTitle((p) => ({ ...p, [g.id]: e.target.value }))}
                    style={{ ...iStyle, flex: 1, minWidth: 120 }}
                  />
                  <button onClick={() => saveTitle(g)} disabled={busy} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line-soft,#eee)", fontWeight: 800, background: "transparent", cursor: "pointer" }}>저장</button>
                  <button onClick={() => setEditingId(null)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line-soft,#eee)", background: "transparent", cursor: "pointer" }}>취소</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 900, fontSize: 14 }}>{g.title || "(untitled)"}</span>
                  <button onClick={() => { setEditingId(g.id); setEditTitle((p) => ({ ...p, [g.id]: g.title || "" })); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--line-soft,#eee)", fontSize: 11, background: "transparent", cursor: "pointer" }}>수정</button>
                </div>
              )}
              <span style={{ fontSize: 11, opacity: 0.55 }}>{typeLabel(String(g.type))}</span>
            </div>

            {/* 진행률 */}
            <div style={{ marginTop: 8 }}>
              {isBool ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>미완료</div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                    <span>{cur.toLocaleString()} / {tgt.toLocaleString()} {unit}</span>
                    <span>{pct(cur, tgt).toFixed(1)}%</span>
                  </div>
                  <Bar cur={cur} tgt={tgt} />
                </>
              )}
            </div>

            {/* 액션 */}
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {isBool ? (
                <button onClick={() => markDone(g)} disabled={busy} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--accent,#B89A5A)", fontWeight: 900, background: "rgba(184,154,90,0.1)", cursor: "pointer", fontSize: 13 }}>달성</button>
              ) : (
                <>
                  <input
                    style={{ ...iStyle, width: 140, padding: "7px 10px" }}
                    placeholder={`${typeLabel(String(g.type))} 입력`}
                    value={editProgress[g.id] ?? ""}
                    onChange={(e) => setEditProgress((p) => ({ ...p, [g.id]: e.target.value }))}
                  />
                  <button onClick={() => updateProgress(g)} disabled={busy} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--accent,#B89A5A)", fontWeight: 900, background: "rgba(184,154,90,0.1)", cursor: "pointer", fontSize: 13 }}>저장</button>
                  <button onClick={() => markDone(g)} disabled={busy} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--line-soft,#eee)", background: "transparent", cursor: "pointer", fontSize: 13 }}>완료 처리</button>
                </>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => archiveGoal(g)} disabled={busy} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line-soft,#eee)", background: "transparent", cursor: "pointer", fontSize: 12, opacity: 0.7 }}>숨김</button>
              <button onClick={() => hardDelete(g)} disabled={busy} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(188,10,7,.2)", color: "var(--red, #c0392b)", background: "transparent", cursor: "pointer", fontSize: 12 }}>삭제</button>
            </div>
          </div>
        );
      })}

      {/* 완료된 목표 */}
      {completed.length > 0 && (
        <>
          <h2 style={{ margin: "16px 0 10px", fontSize: 15, fontWeight: 900 }}>완료된 목표 ({completed.length})</h2>
          {completed.map((g: any) => (
            <div key={g.id} style={{ border: "1px solid var(--line-soft,#eee)", padding: "10px 14px", borderRadius: 12, marginBottom: 8, opacity: 0.7, background: "var(--panel,white)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>{g.title}</span>
                <span style={{ fontSize: 12 }}>{g.type === "boolean" ? "완료" : `${n(g.target_value).toLocaleString()} 달성`}</span>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button onClick={() => archiveGoal(g)} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--line-soft,#eee)", background: "transparent", cursor: "pointer", fontSize: 12 }}>숨김</button>
                <button onClick={() => hardDelete(g)} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(188,10,7,.2)", color: "var(--red, #c0392b)", background: "transparent", cursor: "pointer", fontSize: 12 }}>삭제</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
