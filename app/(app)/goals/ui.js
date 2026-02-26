"use client";

import { useMemo, useState } from "react";

function pretty(obj){ return JSON.stringify(obj, null, 2); }
function parseJson(s, fallback){ try { return JSON.parse(s); } catch { return fallback; } }

export default function GoalsClient({ initial }) {
  const [saving, setSaving] = useState(false);

  const y0 = initial?.y ?? { target: "연간 목표", progress: 0 };
  const m0 = initial?.m ?? { target: "월간 목표", progress: 0 };
  const w0 = initial?.w ?? { target: "주간 목표", progress: 0 };
  const d0 = initial?.d ?? { target: "일간 목표", progress: 0 };

  const [y, setY] = useState(pretty(y0));
  const [m, setM] = useState(pretty(m0));
  const [w, setW] = useState(pretty(w0));
  const [d, setD] = useState(pretty(d0));

  const payload = useMemo(() => ({
    y: parseJson(y, y0),
    m: parseJson(m, m0),
    w: parseJson(w, w0),
    d: parseJson(d, d0),
  }), [y,m,w,d]);

  async function save(){
    setSaving(true);
    try{
      const res = await fetch("/api/goals", {
        method:"POST",
        headers:{ "content-type":"application/json" },
        body: JSON.stringify(payload),
      });
      if(!res.ok) throw new Error("save_failed");
      alert("saved");
    }catch{
      alert("save failed (JSON 문법 확인)");
    }finally{
      setSaving(false);
    }
  }

  return (
    <main style={S.page}>
      <header style={S.header}>
        <h1 style={{margin:0}}>Goals</h1>
        <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
          <a href="/dashboard" style={S.btn}>Dashboard</a>
          <a href="/risk" style={S.btn}>Risk</a>
          <a href="/settings" style={S.btn}>Settings</a>
          <a href="/journal" style={S.btn}>Journal</a>
        </div>
      </header>

      <section style={S.card}>
        <div style={S.title}>Y (JSON)</div>
        <textarea style={S.ta} value={y} onChange={(e)=>setY(e.target.value)} />
      </section>
      <section style={S.card}>
        <div style={S.title}>M (JSON)</div>
        <textarea style={S.ta} value={m} onChange={(e)=>setM(e.target.value)} />
      </section>
      <section style={S.card}>
        <div style={S.title}>W (JSON)</div>
        <textarea style={S.ta} value={w} onChange={(e)=>setW(e.target.value)} />
      </section>
      <section style={S.card}>
        <div style={S.title}>D (JSON)</div>
        <textarea style={S.ta} value={d} onChange={(e)=>setD(e.target.value)} />
      </section>

      <button style={S.primary} onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </main>
  );
}

const S = {
  page:{ padding:24, fontFamily:"inherit", display:"grid", gap:12 },
  header:{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" },
  btn:{ padding:"10px 14px", border:"1px solid #ddd", borderRadius:10, textDecoration:"none", color:"black", background:"white" },
  primary:{ padding:"12px 16px", border:"1px solid #111", borderRadius:10, background:"#111", color:"white", cursor:"pointer", width:"fit-content" },
  card:{ border:"1px solid #eee", borderRadius:14, padding:16, background:"white" },
  title:{ fontWeight:800, marginBottom:10 },
  ta:{ minHeight:110, padding:"10px 12px", border:"1px solid #ddd", borderRadius:10, fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
};
