"use client";

import { useState } from "react";

export default function JournalClient({ initial }) {
  const [items, setItems] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const content = text.trim();
    if (!content) return;

    setBusy(true);
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("add_failed");
      const row = await res.json();
      setItems([row, ...items]);
      setText("");
    } catch {
      alert("add failed");
    } finally {
      setBusy(false);
    }
  }

  async function del(id) {
    if (!confirm("delete?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/journal?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("del_failed");
      setItems(items.filter(x => x.id !== id));
    } catch {
      alert("delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={S.page}>
      <header style={S.header}>
        <h1 style={{margin:0}}>Journal</h1>
        <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
          <a href="/dashboard" style={S.btn}>Dashboard</a>
          <a href="/settings" style={S.btn}>Settings</a>
          <a href="/goals" style={S.btn}>Goals</a>
        </div>
      </header>

      <section style={S.card}>
        <div style={S.title}>New entry</div>
        <textarea style={S.ta} value={text} onChange={(e)=>setText(e.target.value)} placeholder="오늘 트레이드/감정/근거/리스크..." />
        <button style={S.primary} onClick={add} disabled={busy}>
          {busy ? "..." : "Add"}
        </button>
      </section>

      <section style={S.card}>
        <div style={S.title}>Recent</div>
        <div style={{display:"grid", gap:10}}>
          {items.map((x) => (
            <div key={x.id} style={S.item}>
              <div style={S.meta}>
                <span>{new Date(x.created_at).toLocaleString()}</span>
                <button style={S.small} onClick={() => del(x.id)} disabled={busy}>Delete</button>
              </div>
              <div style={S.body}>{x.content}</div>
            </div>
          ))}
          {items.length === 0 && <div style={{opacity:0.7}}>No entries</div>}
        </div>
      </section>
    </main>
  );
}

const S = {
  page: { padding:24, fontFamily:"system-ui", display:"grid", gap:12 },
  header:{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" },
  btn:{ padding:"10px 14px", border:"1px solid #ddd", borderRadius:10, textDecoration:"none", color:"black", background:"white" },
  primary:{ padding:"10px 14px", border:"1px solid #111", borderRadius:10, background:"#111", color:"white", cursor:"pointer", width:"fit-content" },
  card:{ border:"1px solid #eee", borderRadius:14, padding:16, background:"white" },
  title:{ fontWeight:800, marginBottom:10 },
  ta:{ minHeight:120, padding:"10px 12px", border:"1px solid #ddd", borderRadius:10, fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  item:{ border:"1px solid #eee", borderRadius:12, padding:12 },
  meta:{ display:"flex", justifyContent:"space-between", opacity:0.7, fontSize:13, marginBottom:8, gap:10 },
  body:{ whiteSpace:"pre-wrap" },
  small:{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:10, background:"white", cursor:"pointer" },
};
