"use client";
import { useEffect, useState } from "react";

const fmt = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export default function RiskPage() {
  const [risk, setRisk] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    const [r1, r2] = await Promise.all([
      fetch("/api/risk", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/risk-settings", { cache: "no-store" }).then((r) => r.json()),
    ]);
    if (r1.ok) setRisk(r1); else setMsg(r1.error || "risk load failed");
    if (r2.ok) setSettings(r2.settings);
  }

  async function save() {
    setMsg("");
    const r = await fetch("/api/risk-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    const j = await r.json();
    if (!j.ok) { setMsg(j.error || "save failed"); return; }
    setMsg("✅ 저장 완료");
    load();
  }

  useEffect(() => { load(); }, []);

  if (!risk || !settings) return <div style={{ padding: 20, opacity: 0.7 }}>Loading...</div>;
  const s = risk.stats || {};

  const stateColor = risk.state === "STOP" ? "#bc0a07"
    : risk.state === "SLOWDOWN" ? "#d97706" : "#0b7949";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 900 }}>Risk Monitor</h1>

      {msg && (
        <div style={{ margin: "0 0 12px", padding: 10, border: "1px solid var(--line-soft,#eee)", borderRadius: 10, fontSize: 13 }}>
          {msg}
        </div>
      )}

      {/* 현재 상태 */}
      <div style={{ border: "1px solid var(--line-soft,#eee)", padding: "12px 14px", borderRadius: 12, marginBottom: 14, background: "var(--panel,white)" }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>현재 상태</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 900, fontSize: 18, color: stateColor }}>{risk.state}</span>
          {risk.reasons?.length > 0 && (
            <span style={{ fontSize: 13, opacity: 0.7 }}>· {risk.reasons.join(", ")}</span>
          )}
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10,
        marginBottom: 16,
      }}>
        {[
          ["Seed", `${fmt(s.seed)} USDT`],
          ["자산", `${fmt(s.equityNow)} USDT`],
          ["누적 PnL", `${fmt(s.cumPnl)} (${fmt(s.pnlPct)}%)`],
          ["최고 자산", `${fmt(s.peakEquity)} USDT`],
          ["최대 DD", `${fmt(s.maxDdUsd)} (${fmt(s.ddPct)}%)`],
          ["오늘 PnL", `${fmt(s.todayPnl)} USDT`],
          ["오늘 거래", `${fmt(s.tradesToday)}건`],
          ["이번 시간", `${fmt(s.tradesThisHour)}건`],
          ["최대 연패", `${fmt(s.maxConsecLoss)}연패`],
        ].map(([title, value]) => (
          <div key={title} style={{ border: "1px solid var(--line-soft,#eee)", padding: "10px 12px", borderRadius: 10, background: "var(--panel,white)" }}>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 3 }}>{title}</div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 설정 */}
      <div style={{ border: "1px solid var(--line-soft,#eee)", padding: "14px", borderRadius: 12, background: "var(--panel,white)" }}>
        <div style={{ fontWeight: 900, marginBottom: 12, fontSize: 15 }}>Risk Rules 설정</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {[
            ["Seed (USDT)", "seed_usd"],
            ["Max DD (USDT)", "max_dd_usd"],
            ["Max DD (%)", "max_dd_pct"],
            ["Max Daily Loss (USDT)", "max_daily_loss_usd"],
            ["Max Daily Loss (%)", "max_daily_loss_pct"],
            ["Max Consecutive Losses", "max_consecutive_losses"],
            ["Max Trades / Day", "max_trades_per_day"],
            ["Max Trades / Hour", "max_trades_per_hour"],
          ].map(([label, key]) => (
            <label key={key} style={{ display: "grid", gap: 5 }}>
              <span style={{ fontSize: 12, opacity: 0.65 }}>{label}</span>
              <input
                value={settings[key] ?? ""}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                style={{
                  padding: "9px 11px",
                  borderRadius: 10,
                  border: "1px solid var(--line-soft,rgba(0,0,0,.12))",
                  background: "rgba(0,0,0,.04)",
                  color: "inherit",
                  outline: "none",
                  width: "100%",
                }}
              />
            </label>
          ))}
        </div>
        <button
          onClick={save}
          style={{
            marginTop: 14,
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: "var(--text-primary,#111)",
            color: "white",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
