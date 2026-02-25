"use client";

import { useEffect, useState } from "react";

export default function JournalClient({ initial }) {
  const [rows,   setRows]   = useState(initial || []);
  const [text,   setText]   = useState("");
  const [busy,   setBusy]   = useState(false);
  const [msg,    setMsg]    = useState("");

  async function refresh() {
    try {
      const r = await fetch("/api/journal", { cache: "no-store" });
      const j = await r.json();
      if (j?.ok) setRows(j.rows || []);
    } catch {}
  }

  async function add() {
    const v = (text || "").trim();
    if (!v) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: v }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setMsg(`저장 실패: ${j?.error ?? r.status}`); return; }
      setText("");
      await refresh();
    } finally { setBusy(false); }
  }

  async function del(id) {
    if (!confirm("이 항목을 삭제할까요? 복구할 수 없습니다.")) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/journal?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setMsg(`삭제 실패: ${j?.error ?? r.status}`); return; }
      await refresh();
    } finally { setBusy(false); }
  }

  // Enter(Ctrl+Enter or Cmd+Enter) 단축키
  function handleKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); add(); }
  }

  useEffect(() => { setRows(initial || []); }, [initial]);

  return (
    <div style={{ maxWidth: 800, display: "grid", gap: 14 }}>

      {/* 타이틀 */}
      <div>
        <h1 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 900 }}>저널</h1>
        <div style={{ fontSize: 12, opacity: 0.5 }}>거래 감정 · 근거 · 회고를 자유롭게 기록하세요</div>
      </div>

      {/* 입력 */}
      <div style={card}>
        <div style={sectionHead}>✦ 새 기록</div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="오늘의 트레이딩, 감정, 진입 근거, 반성…"
          rows={4}
          style={{
            width: "100%", padding: "10px 12px",
            borderRadius: 10, border: "1px solid var(--line-soft, rgba(0,0,0,.12))",
            background: "rgba(0,0,0,0.04)", outline: "none",
            fontFamily: "inherit", fontSize: 14, lineHeight: 1.6,
            resize: "vertical", marginBottom: 10, color: "inherit",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={add} disabled={busy} style={btnSt}>
            {busy ? "저장 중…" : "기록 저장"}
          </button>
          <span style={{ fontSize: 11, opacity: 0.4 }}>Cmd+Enter로도 저장됩니다</span>
          {msg && <span style={{ fontSize: 13, color: "#c0392b" }}>{msg}</span>}
        </div>
      </div>

      {/* 목록 */}
      <div style={card}>
        <div style={sectionHead}>✦ 최근 기록</div>
        {rows.length === 0 ? (
          <div style={{ opacity: 0.5, fontSize: 14 }}>아직 기록이 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map(r => (
              <div key={r.id} style={{
                border: "1px solid var(--line-soft, rgba(0,0,0,.08))",
                borderRadius: 10, padding: "11px 13px",
                background: "rgba(0,0,0,0.03)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, opacity: 0.5 }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString("ko-KR") : ""}
                  </span>
                  <button onClick={() => del(r.id)} disabled={busy} style={delSt}>
                    삭제
                  </button>
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>
                  {r.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const card = {
  border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
  borderRadius: 12, padding: "14px",
  background: "var(--panel, rgba(255,255,255,0.72))",
};
const sectionHead = { fontWeight: 800, marginBottom: 10, fontSize: 13, opacity: 0.6, letterSpacing: 0.2 };
const btnSt = {
  padding: "9px 16px", borderRadius: 9,
  border: "1px solid var(--line-hard, rgba(0,0,0,.18))",
  background: "var(--text-primary, #111)", color: "white",
  fontWeight: 800, fontSize: 13, cursor: "pointer",
};
const delSt = {
  padding: "5px 10px", borderRadius: 8,
  border: "1px solid rgba(192,57,43,.2)",
  background: "rgba(192,57,43,.07)", color: "#c0392b",
  fontWeight: 700, fontSize: 12, cursor: "pointer",
};
