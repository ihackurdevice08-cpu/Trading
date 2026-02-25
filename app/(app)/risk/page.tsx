"use client";
import { useEffect, useState } from "react";

function fmt(v: any, d = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: d });
}

const STATE_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  NORMAL:   { color: "var(--green, #0b7949)", bg: "rgba(11,121,73,0.06)",  icon: "◈", label: "정상"     },
  SLOWDOWN: { color: "#d97706", bg: "rgba(217,119,6,0.06)",  icon: "◬", label: "주의"     },
  STOP:     { color: "#c0392b", bg: "rgba(192,57,43,0.06)",  icon: "◬", label: "거래 중단" },
};

export default function RiskPage() {
  const [risk,     setRisk]     = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [msg,      setMsg]      = useState("");
  const [saving,   setSaving]   = useState(false);

  async function load() {
    setMsg("");
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/risk",          { cache: "no-store" }).then(r => r.json()),
        fetch("/api/risk-settings", { cache: "no-store" }).then(r => r.json()),
      ]);
      if (r1.ok) setRisk(r1);     else setMsg(r1.error  || "리스크 데이터 로드 실패");
      if (r2.ok) setSettings(r2.settings); else setMsg(r2.error || "설정 로드 실패");
    } catch (e: any) { setMsg(e?.message || "네트워크 오류"); }
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/risk-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const j = await r.json();
      setMsg(j.ok ? "✓ 저장 완료" : j.error || "저장 실패");
      if (j.ok) load();
    } catch (e: any) { setMsg(e?.message || "저장 실패"); }
    finally { setSaving(false); }
  }

  useEffect(() => { load(); }, []);

  if (!risk || !settings) return <div style={{ padding: 20, opacity: 0.5 }}>불러오는 중…</div>;

  const s = risk.stats || {};
  const meta = STATE_META[risk.state] || STATE_META.NORMAL;

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 900 }}>리스크 모니터</h1>

      {/* 상태 배너 */}
      <div style={{ padding: "12px 16px", borderRadius: 12, marginBottom: 14,
        background: meta.bg, border: `1px solid ${meta.color}28` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 22, color: meta.color }}>{meta.icon}</span>
          <span style={{ fontWeight: 900, fontSize: 17, color: meta.color }}>{meta.label}</span>
          {risk.reasons?.length > 0 && (
            <span style={{ fontSize: 13, opacity: 0.7 }}>
              — {risk.reasons.join(", ")}
            </span>
          )}
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 12,
          border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
          background: "var(--panel, rgba(255,255,255,0.72))", fontSize: 13 }}>
          {msg}
        </div>
      )}

      {/* 통계 카드 */}
      <h2 style={sectionHead}>◈ 현황</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 20 }}>
        {[
          ["시드",        `${fmt(s.seed)} USDT`                     ],
          ["현재 자산",   `${fmt(s.equityNow)} USDT`                ],
          ["누적 PnL",    `${s.cumPnl >= 0 ? "+" : ""}${fmt(s.cumPnl)} (${fmt(s.pnlPct)}%)`],
          ["최고 자산",   `${fmt(s.peakEquity)} USDT`               ],
          ["최대 낙폭",   `${fmt(s.maxDdUsd)} (${fmt(s.ddPct)}%)`   ],
          ["오늘 PnL",    `${s.todayPnl >= 0 ? "+" : ""}${fmt(s.todayPnl)} USDT`],
          ["오늘 거래",   `${fmt(s.tradesToday, 0)}건`               ],
          ["이번 시간",   `${fmt(s.tradesThisHour, 0)}건`            ],
          ["최대 연속손", `${fmt(s.maxConsecLoss, 0)}연패`           ],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: "10px 12px", borderRadius: 10,
            border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
            background: "var(--panel, rgba(255,255,255,0.72))" }}>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 3, letterSpacing: 0.2 }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 설정 */}
      <h2 style={sectionHead}>◐ 리스크 한도 설정</h2>
      <div style={{ padding: 14, border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
        borderRadius: 12, background: "var(--panel, rgba(255,255,255,0.72))" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 14 }}>
          {[
            ["시드 (USDT)",          "seed_usd"             ],
            ["최대 낙폭 (USDT)",     "max_dd_usd"           ],
            ["최대 낙폭 (%)",        "max_dd_pct"           ],
            ["일 최대 손실 (USDT)",  "max_daily_loss_usd"   ],
            ["일 최대 손실 (%)",     "max_daily_loss_pct"   ],
            ["최대 연속 손실 (횟수)","max_consecutive_losses"],
            ["일 최대 거래 수",      "max_trades_per_day"   ],
            ["시간당 최대 거래 수",  "max_trades_per_hour"  ],
          ].map(([label, key]) => (
            <label key={key} style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.55 }}>{label}</span>
              <input
                value={settings[key] ?? ""}
                onChange={e => setSettings({ ...settings, [key]: e.target.value })}
                style={iSt}
              />
            </label>
          ))}
        </div>
        <button onClick={save} disabled={saving} style={btnSt}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}

const sectionHead: React.CSSProperties = { margin: "0 0 10px", fontSize: 13, fontWeight: 800, opacity: 0.6, letterSpacing: 0.3 };
const iSt: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 9, fontSize: 14,
  border: "1px solid var(--line-soft, rgba(0,0,0,.12))",
  background: "rgba(0,0,0,0.05)", outline: "none", width: "100%", color: "inherit",
};
const btnSt: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 9, border: "none",
  background: "var(--text-primary, #111)", color: "white",
  fontWeight: 800, fontSize: 14, cursor: "pointer",
};
