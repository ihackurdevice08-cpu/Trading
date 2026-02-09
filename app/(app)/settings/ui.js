"use client";

import { useMemo, useState } from "react";

function safeJsonParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

export default function SettingsClient({ initial }) {
  const [saving, setSaving] = useState(false);

  const [exchange_url, setExchange] = useState(initial?.exchange_url || "");
  const [ddari_url, setDdari] = useState(initial?.ddari_url || "");
  const [spotify_url, setSpotify] = useState(initial?.spotify_url || "");
  const [docs_url, setDocs] = useState(initial?.docs_url || "");
  const [sheets_url, setSheets] = useState(initial?.sheets_url || "");

  const checklistInit = Array.isArray(initial?.checklist) ? initial.checklist : [];
  const emergencyInit = initial?.emergency && typeof initial.emergency === "object" ? initial.emergency : {};

  const [checklistText, setChecklistText] = useState(
    checklistInit.length ? checklistInit.join("\n") : "1H/4H 존 확인\n리스크% 확인\n진입 근거 2개 이상"
  );

  const [emergencyStepsText, setEmergencyStepsText] = useState(
    Array.isArray(emergencyInit.steps) ? emergencyInit.steps.join("\n")
      : "포지션 추가 진입 금지\n10분 쿨다운\n체크리스트 재확인"
  );
  const [emergencyQuotesText, setEmergencyQuotesText] = useState(
    Array.isArray(emergencyInit.quotes) ? emergencyInit.quotes.join("\n")
      : "No trade is also a trade.\nProtect the account."
  );

  const payload = useMemo(() => {
    const checklist = checklistText.split("\n").map(s => s.trim()).filter(Boolean);
    const emergency = {
      steps: emergencyStepsText.split("\n").map(s => s.trim()).filter(Boolean),
      quotes: emergencyQuotesText.split("\n").map(s => s.trim()).filter(Boolean),
    };
    return { exchange_url, ddari_url, spotify_url, docs_url, sheets_url, checklist, emergency };
  }, [exchange_url, ddari_url, spotify_url, docs_url, sheets_url, checklistText, emergencyStepsText, emergencyQuotesText]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save_failed");
      alert("saved");
    } catch {
      alert("save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={S.page}>
      <header style={S.header}>
        <h1 style={{margin:0}}>Settings</h1>
        <div style={{display:"flex", gap:10}}>
          <a href="/dashboard" style={S.btn}>Dashboard</a>
          <a href="/journal" style={S.btn}>Journal</a>
          <a href="/goals" style={S.btn}>Goals</a>
        </div>
      </header>

      <section style={S.card}>
        <div style={S.title}>Quick Links</div>
        <div style={S.grid}>
          <Field label="Exchange URL" value={exchange_url} setValue={setExchange} />
          <Field label="Ddari URL" value={ddari_url} setValue={setDdari} />
          <Field label="Spotify URL" value={spotify_url} setValue={setSpotify} />
          <Field label="Google Docs URL" value={docs_url} setValue={setDocs} />
          <Field label="Google Sheets URL" value={sheets_url} setValue={setSheets} />
        </div>
      </section>

      <section style={S.card}>
        <div style={S.title}>Trade Gate Checklist (한 줄 = 한 항목)</div>
        <textarea style={S.ta} value={checklistText} onChange={(e)=>setChecklistText(e.target.value)} />
      </section>

      <section style={S.card}>
        <div style={S.title}>Emergency Steps (한 줄 = 한 항목)</div>
        <textarea style={S.ta} value={emergencyStepsText} onChange={(e)=>setEmergencyStepsText(e.target.value)} />
        <div style={{height:10}} />
        <div style={S.title}>Emergency Quotes (한 줄 = 한 항목)</div>
        <textarea style={S.ta} value={emergencyQuotesText} onChange={(e)=>setEmergencyQuotesText(e.target.value)} />
      </section>

      <button style={S.primary} onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </main>
  );
}

function Field({ label, value, setValue }) {
  return (
    <label style={S.field}>
      <div style={S.label}>{label}</div>
      <input style={S.input} value={value} onChange={(e)=>setValue(e.target.value)} placeholder="https://..." />
    </label>
  );
}

const S = {
  page: { padding: 24, fontFamily: "system-ui", display: "grid", gap: 12 },
  header: { display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" },
  btn: { padding:"10px 14px", border:"1px solid #ddd", borderRadius:10, textDecoration:"none", color:"black", background:"white" },
  primary: { padding:"12px 16px", border:"1px solid #111", borderRadius:10, background:"#111", color:"white", cursor:"pointer", width:"fit-content" },
  card: { border:"1px solid #eee", borderRadius:14, padding:16, background:"white" },
  title: { fontWeight:800, marginBottom:10 },
  grid: { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:12 },
  field: { display:"grid", gap:6 },
  label: { fontWeight:700, opacity:0.8 },
  input: { padding:"10px 12px", border:"1px solid #ddd", borderRadius:10 },
  ta: { minHeight:120, padding:"10px 12px", border:"1px solid #ddd", borderRadius:10, fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }
};
