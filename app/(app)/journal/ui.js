"use client";

import { useEffect, useState } from "react";

export default function JournalClient({ initial }) {
  const [rows, setRows] = useState(initial || []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    try {
      const r = await fetch("/api/journal", { cache: "no-store" });
      const j = await r.json();
      if (j?.ok) setRows(j.rows || []);
    } catch (e) {
      // ignore
    }
  }

  async function add() {
    const v = (text || "").trim();
    if (!v) return;

    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: v }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setMsg(`추가 실패: ${(j && j.error) ? j.error : r.status}`);
        return;
      }
      setText("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function del(id) {
    const ok = confirm("이 항목을 삭제할까요? (복구 불가)");
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/journal?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setMsg(`삭제 실패: ${(j && j.error) ? j.error : r.status}`);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setRows(initial || []);
  }, [initial]);

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <h1 style={{ margin: 0 }}>Journal</h1>
        {/* NOTE: 전역 Nav가 있으므로 저널 내부 네비 버튼은 제거합니다 */}
      </div>

      <div style={S.card}>
        <div style={S.subTitle}>New entry</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="오늘 트레이딩/감정/근거/리스킹…"
          style={S.ta}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={add} disabled={busy} style={S.btn}>
            {busy ? "처리중..." : "Add"}
          </button>
          {msg ? <div style={{ fontSize: 12, opacity: 0.8 }}>{msg}</div> : null}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.subTitle}>Recent</div>
        {rows.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>No entries</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <div key={r.id} style={S.item}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                  </div>
                  <button
                    onClick={() => del(r.id)}
                    disabled={busy}
                    style={S.del}
                    title="삭제"
                  >
                    Delete
                  </button>
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
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

const S = {
  wrap: { padding: 20, display: "grid", gap: 14 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  card: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 14,
    background: "white",
  },
  subTitle: { fontWeight: 800, marginBottom: 10, fontSize: 13, opacity: 0.9 },
  ta: {
    width: "100%",
    minHeight: 120,
    resize: "vertical",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontFamily: "system-ui",
    marginBottom: 10,
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  item: {
    border: "1px solid #f0f0f0",
    borderRadius: 12,
    padding: 12,
    background: "#fafafa",
  },
  del: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "white",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },
};
