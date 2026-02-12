"use client";

import { useMemo, useState } from "react";

export default function DashboardClient({ email, settings }) {
  const links = useMemo(() => ([
    { label: "Exchange", url: settings.exchange_url },
    { label: "Ddari", url: settings.ddari_url },
    { label: "Spotify", url: settings.spotify_url },
    { label: "Google Docs", url: settings.docs_url },
    { label: "Google Sheets", url: settings.sheets_url },
  ]), [settings]);

  const checklist = Array.isArray(settings.checklist) ? settings.checklist : [];
  const [checks, setChecks] = useState(() => checklist.map(() => false));
  const allDone = checklist.length === 0 ? true : checks.every(Boolean);

  const [showGate, setShowGate] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);

  const emergency = settings.emergency || {};
  const steps = Array.isArray(emergency.steps) ? emergency.steps : [];
  const quotes = Array.isArray(emergency.quotes) ? emergency.quotes : [];

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div>
          <h1 style={S.h1}>Man Cave</h1>
          <div style={S.sub}>로그인됨: {email}</div>
        </div>
        <div style={S.headerBtns}>
          <a href="/risk" style={S.btn}>Risk</a>
          <a href="/settings" style={S.btn}>Settings</a>
          <a href="/goals" style={S.btn}>Goals</a>
          <a href="/journal" style={S.btn}>Journal</a>
          <a href="/auth/signout" style={S.btn}>Logout</a>
        </div>
      </header>

      <section style={S.card}>
        <div style={S.cardTitle}>Quick Links</div>
        <div style={S.grid}>
          {links.map((x) => (
            <a key={x.label} href={x.url || "#"} target="_blank" rel="noreferrer"
               style={{...S.linkCard, opacity: x.url ? 1 : 0.5, pointerEvents: x.url ? "auto" : "none"}}>
              <div style={S.linkLabel}>{x.label}</div>
              <div style={S.linkUrl}>{x.url || "설정에서 URL 저장"}</div>
            </a>
          ))}
        </div>
      </section>

      <section style={S.row}>
        <div style={{...S.card, flex: 1}}>
          <div style={S.cardTitle}>Trade Gate</div>
          <div style={S.sub}>체크리스트 완료 후 거래소 오픈</div>
          <button style={S.primary} onClick={() => setShowGate(true)}>
            Open Gate
          </button>
        </div>

        <div style={{...S.card, flex: 1}}>
          <div style={S.cardTitle}>Emergency</div>
          <div style={S.sub}>분노/충동 감지 시 원클릭 중단</div>
          <button style={S.danger} onClick={() => setShowEmergency(true)}>
            Emergency Button
          </button>
        </div>
      </section>

      {showGate && (
        <div style={S.modalBg} onMouseDown={() => setShowGate(false)}>
          <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={S.modalTitle}>Trade Gate Checklist</div>
            {checklist.length === 0 ? (
              <div style={S.sub}>체크리스트가 비어있음 (Settings에서 추가 가능)</div>
            ) : (
              <div style={{display:"grid", gap: 10, marginTop: 12}}>
                {checklist.map((item, i) => (
                  <label key={i} style={S.checkRow}>
                    <input
                      type="checkbox"
                      checked={!!checks[i]}
                      onChange={(e) => {
                        const next = checks.slice();
                        next[i] = e.target.checked;
                        setChecks(next);
                      }}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            )}

            <div style={S.modalBtns}>
              <button style={S.btn} onClick={() => setShowGate(false)}>Close</button>
              <a
                href={settings.exchange_url || "#"}
                target="_blank" rel="noreferrer"
                style={{...S.primary, textDecoration:"none", display:"inline-block",
                  opacity: allDone && settings.exchange_url ? 1 : 0.5,
                  pointerEvents: allDone && settings.exchange_url ? "auto" : "none"
                }}
              >
                Open Exchange
              </a>
            </div>
          </div>
        </div>
      )}

      {showEmergency && (
        <div style={S.modalBg} onMouseDown={() => setShowEmergency(false)}>
          <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={S.modalTitle}>Emergency Protocol</div>

            <div style={{marginTop: 12}}>
              <div style={S.sectionLabel}>Steps</div>
              {steps.length ? (
                <ol style={{marginTop: 8}}>
                  {steps.map((s, i) => <li key={i} style={{marginBottom: 6}}>{s}</li>)}
                </ol>
              ) : (
                <div style={S.sub}>Settings에서 steps를 추가해</div>
              )}
            </div>

            <div style={{marginTop: 12}}>
              <div style={S.sectionLabel}>Quotes</div>
              {quotes.length ? (
                <ul style={{marginTop: 8}}>
                  {quotes.map((q, i) => <li key={i} style={{marginBottom: 6}}>{q}</li>)}
                </ul>
              ) : (
                <div style={S.sub}>Settings에서 quotes를 추가해</div>
              )}
            </div>

            <div style={S.modalBtns}>
              <button style={S.btn} onClick={() => setShowEmergency(false)}>Close</button>
              <a href="/journal" style={{...S.primary, textDecoration:"none"}}>Write Journal Now</a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const S = {
  page: { padding: 24, fontFamily: "system-ui", display: "grid", gap: 16 },
  header: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
  h1: { margin: 0 },
  sub: { opacity: 0.7, marginTop: 6 },
  headerBtns: { display: "flex", gap: 10, flexWrap: "wrap" },
  btn: { padding: "10px 14px", border: "1px solid #ddd", borderRadius: 10, textDecoration: "none", color: "black", background: "white", cursor: "pointer" },
  primary: { padding: "10px 14px", border: "1px solid #111", borderRadius: 10, background: "#111", color: "white", cursor: "pointer" },
  danger: { padding: "10px 14px", border: "1px solid #b91c1c", borderRadius: 10, background: "#b91c1c", color: "white", cursor: "pointer" },
  card: { border: "1px solid #eee", borderRadius: 14, padding: 16, background: "white" },
  cardTitle: { fontWeight: 700, marginBottom: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  linkCard: { border: "1px solid #eee", borderRadius: 12, padding: 12, textDecoration: "none", color: "black" },
  linkLabel: { fontWeight: 700 },
  linkUrl: { opacity: 0.7, marginTop: 6, wordBreak: "break-all" },
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
  modalBg: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: 16 },
  modal: { width: "min(720px, 100%)", background: "white", borderRadius: 14, padding: 16, border: "1px solid #eee" },
  modalTitle: { fontWeight: 800, fontSize: 18 },
  modalBtns: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16, flexWrap: "wrap" },
  checkRow: { display: "flex", gap: 10, alignItems: "center" },
  sectionLabel: { fontWeight: 700 },
};
