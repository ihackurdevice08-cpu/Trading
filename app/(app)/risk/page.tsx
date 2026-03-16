"use client";
import { useEffect, useState, useCallback } from "react";

function fmt(v: any, d = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: d });
}
const toN = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const STATE_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  NORMAL:   { color: "var(--green, #0b7949)", bg: "rgba(11,121,73,0.06)",  icon: "◈", label: "정상"     },
  SLOWDOWN: { color: "#d97706",               bg: "rgba(217,119,6,0.06)",  icon: "◬", label: "주의"     },
  STOP:     { color: "var(--red,#FF4D4D)",               bg: "rgba(192,57,43,0.06)",  icon: "◬", label: "거래 중단" },
};

export default function RiskPage() {
  const [risk,     setRisk]     = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [msg,      setMsg]      = useState("");
  const [saving,   setSaving]   = useState(false);
  const [cycles,   setCycles]   = useState<any[]>([]);
  const [cycling,  setCycling]  = useState(false);
  const [pnlFrom,  setPnlFrom]  = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("pnl_from") ?? "") : ""
  );

  const load = useCallback(async () => {
    setMsg("");
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`/api/risk${pnlFrom ? "?from=" + encodeURIComponent(pnlFrom) : ""}`, { cache: "no-store" }).then(r => r.json()),
        fetch("/api/risk-settings", { cache: "no-store" }).then(r => r.json()),
        fetch("/api/risk-cycle",    { cache: "no-store" }).then(r => r.json()),
      ]);
      if (r1.ok) setRisk(r1);              else setMsg(r1.error  || "리스크 데이터 로드 실패");
      if (r2.ok) setSettings(r2.settings); else setMsg(r2.error  || "설정 로드 실패");
      if (r3.ok) setCycles(r3.cycles || []);
    } catch (e: any) { setMsg(e?.message || "네트워크 오류"); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(patch?: any) {
    const next = { ...settings, ...patch };
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/risk-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const j = await r.json();
      if (j.ok) {
        if (j.settings) setSettings(j.settings);
        setMsg("✓ 저장됨");
        load();
      } else {
        setMsg(j.error || "저장 실패");
      }
    } catch (e: any) { setMsg(e?.message || "저장 실패"); }
    finally { setSaving(false); }
  }

  async function startNewCycle() {
    const today = new Date().toISOString().slice(0, 10);
    if (!confirm(`새 사이클을 시작할까요?\n${today}부터 누적 PnL을 새로 계산합니다.`)) return;
    setCycling(true);
    try {
      // 스냅샷 저장
      await fetch("/api/risk-cycle", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ equity_snapshot: risk?.stats?.equityNow }),
      });
      // 기산일을 오늘로 (localStorage)
      handlePnlFromChange(today);
      setMsg(`✓ 새 사이클 시작 — ${today}부터 누적`);
      load();
    } finally { setCycling(false); }
  }

  function handlePnlFromChange(val: string) {
    setPnlFrom(val);
    localStorage.setItem("pnl_from", val);
  }

  // USDT ↔ % 자동 계산
  // % 계산 기준 = 현재 자산 (seed + 누적PnL)
  function getBase() {
    const eq = toN(risk?.stats?.equityNow);
    if (eq != null && eq > 0) return eq;
    return toN(settings?.seed_usd) ?? 0;
  }

  function onDdUsd(v: string) {
    const usd  = toN(v);
    const base = getBase();
    const next: any = { ...settings, max_dd_usd: v };
    if (usd != null && base > 0)
      next.max_dd_pct = Number(((usd / base) * 100).toFixed(2));
    setSettings(next);
  }
  function onDdPct(v: string) {
    const pct  = toN(v);
    const base = getBase();
    const next: any = { ...settings, max_dd_pct: v };
    if (pct != null && base > 0)
      next.max_dd_usd = Number(((pct / 100) * base).toFixed(2));
    setSettings(next);
  }
  function onDailyUsd(v: string) {
    const usd  = toN(v);
    const base = getBase();
    const next: any = { ...settings, max_daily_loss_usd: v };
    if (usd != null && base > 0)
      next.max_daily_loss_pct = Number(((usd / base) * 100).toFixed(2));
    setSettings(next);
  }
  function onDailyPct(v: string) {
    const pct  = toN(v);
    const base = getBase();
    const next: any = { ...settings, max_daily_loss_pct: v };
    if (pct != null && base > 0)
      next.max_daily_loss_usd = Number(((pct / 100) * base).toFixed(2));
    setSettings(next);
  }
  function onSeed(v: string) {
    // 시드는 최초 입금액 기준 — % 자동계산은 equityNow 기준이므로 시드 변경 시 재계산 불필요
    setSettings({ ...settings, seed_usd: v });
  }

  if (!risk || !settings) return <div style={{ padding: 20, opacity: 0.5 }}>불러오는 중…</div>;

  const s    = risk.stats || {};
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
            <span style={{ fontSize: 13, opacity: 0.7 }}>— {risk.reasons.join(", ")}</span>
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

      {/* 현황 카드 */}
      <h2 style={sectionHead}>◈ 현황</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 20 }}>
        {[
          ["시드",        `${fmt(s.seed)} USDT`],
          ["현재 자산",   `${fmt(s.equityNow)} USDT`],
          ["누적 PnL",    `${s.cumPnl >= 0 ? "+" : ""}${fmt(s.cumPnl)} (${fmt(s.pnlPct)}%)`],
          ["최고 자산",   `${fmt(s.peakEquity)} USDT`],
          ["최대 낙폭",   `${fmt(s.maxDdUsd)} (${fmt(s.ddPct)}%)`],
          ["오늘 PnL",    `${s.todayPnl >= 0 ? "+" : ""}${fmt(s.todayPnl)} USDT`],
          ["오늘 거래",   `${fmt(s.tradesToday, 0)}건`],
          ["이번 시간",   `${fmt(s.tradesThisHour, 0)}건`],
          ["최대 연속손", `${fmt(s.maxConsecLoss, 0)}연패`],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: "10px 12px", borderRadius: 10,
            border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
            background: "var(--panel, rgba(255,255,255,0.72))" }}>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 3 }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 한도 설정 */}
      <h2 style={sectionHead}>◐ 리스크 한도 설정</h2>
      <div style={{ padding: 14, border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
        borderRadius: 12, background: "var(--panel, rgba(255,255,255,0.72))", display: "grid", gap: 14 }}>

        {/* 현재 자산 기준 안내 */}
        <div style={{ padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--line-soft)", fontSize: 12, opacity: 0.7 }}>
          ◈ 한도 계산 기준: <b>현재 자산 {fmt(s.equityNow)} USDT</b>
          <span style={{ opacity: 0.6 }}> (최초 시드 {fmt(s.seed)} + 누적 PnL {s.cumPnl >= 0 ? "+" : ""}{fmt(s.cumPnl)})</span>
        </div>

        {/* 최대 낙폭 */}
        <div>
          <div style={groupLabel}>최대 낙폭 방식</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {([
              { val: "drawdown", label: "낙폭 방식", sub: "피크 대비 X% / USDT 하락 시" },
              { val: "floor",    label: "잔고 하한선", sub: "잔고가 X USDT 아래로 내려가면" },
            ] as const).map(({ val, label, sub }) => (
              <div key={val}
                onClick={() => { setSettings({ ...settings, dd_mode: val }); save({ dd_mode: val }); }}
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${settings.dd_mode === val ? "var(--accent,#B89A5A)" : "var(--line-soft,rgba(0,0,0,.1))"}`,
                  background: settings.dd_mode === val ? "rgba(184,154,90,0.08)" : "transparent",
                  transition: "all .15s",
                }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{label}</div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {settings.dd_mode === "floor" ? (
            <div>
              <Field label="잔고 하한선 (USDT) — 이 금액 아래로 내려가면 경고"
                value={settings.dd_floor_usd ?? ""}
                onChange={v => setSettings({ ...settings, dd_floor_usd: v })}
                onBlur={() => save()} />
              <div style={hint}>
                현재 자산 {fmt(s.equityNow)} USDT
                {settings.dd_floor_usd ? ` · 여유 ${fmt(s.equityNow - Number(settings.dd_floor_usd))} USDT` : ""}
              </div>
            </div>
          ) : (
            <div>
              <div style={twoCol}>
                <Field label="USDT" value={settings.max_dd_usd ?? ""}
                  onChange={onDdUsd} onBlur={() => save()} />
                <Field label="%" value={settings.max_dd_pct ?? ""}
                  onChange={onDdPct} onBlur={() => save()} />
              </div>
              <div style={hint}>둘 중 하나만 입력하면 나머지가 자동 계산됩니다.</div>
            </div>
          )}
        </div>

        {/* 일 최대 손실 */}
        <div>
          <div style={groupLabel}>일 최대 손실</div>
          <div style={twoCol}>
            <Field label="USDT" value={settings.max_daily_loss_usd ?? ""}
              onChange={onDailyUsd} onBlur={() => save()} />
            <Field label="%" value={settings.max_daily_loss_pct ?? ""}
              onChange={onDailyPct} onBlur={() => save()} />
          </div>
          <div style={hint}>둘 중 하나만 입력하면 나머지가 자동 계산됩니다.</div>
        </div>

        {/* 최대 연속 손실 */}
        <Field label="최대 연속 손실 (횟수)" value={settings.max_consecutive_losses ?? ""}
          onChange={v => setSettings({ ...settings, max_consecutive_losses: v })}
          onBlur={() => save()} />

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => save()} disabled={saving} style={btnSt}>
            {saving ? "저장 중…" : "저장"}
          </button>
          <span style={{ fontSize: 12, opacity: 0.5 }}>
            포커스 벗어날 때 자동 저장됩니다.
          </span>
        </div>
      </div>
      {/* 새 사이클 시작 */}
      <div style={{ marginTop: 8, paddingTop: 14,
        borderTop: "1px solid var(--line-soft)" }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.65, marginBottom: 6 }}>사이클 관리</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 10, lineHeight: 1.6 }}>
          누적 PnL 기산일을 직접 설정하거나, 새 사이클 시작 버튼을 눌러 오늘부터 새로 계산합니다.
        </div>

        {/* 기산일 직접 설정 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
            <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>누적 PnL 기산일</span>
            <input type="date" max={new Date().toISOString().slice(0,10)}
              value={pnlFrom}
              onChange={e => handlePnlFromChange(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 9, fontSize: 13,
                border: "1px solid var(--line-soft,rgba(0,0,0,.12))",
                background: "rgba(255,255,255,0.04)", color: "inherit", outline: "none" }} />
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 16 }}>
            {pnlFrom ? `${pnlFrom} 이후 거래만 집계` : "전체 기간 집계 중"}
          </div>
          {pnlFrom && (
            <button onClick={() => handlePnlFromChange("")}
              style={{ marginTop: 16, padding: "6px 10px", borderRadius: 7, fontSize: 11,
                border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
                background: "transparent", cursor: "pointer", opacity: 0.6 }}>
              전체로 초기화
            </button>
          )}
        </div>

        <button onClick={startNewCycle} disabled={cycling} style={{
          padding: "9px 16px", borderRadius: 9,
          border: "1px solid var(--line-soft,rgba(0,0,0,.12))",
          background: "transparent", fontWeight: 800, fontSize: 13,
          cursor: cycling ? "not-allowed" : "pointer" }}>
          {cycling ? "처리 중…" : "◈ 새 사이클 시작 (오늘부터)"}
        </button>
        {cycles.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column" as const, gap: 4 }}>
            {cycles.slice(0, 3).map(c => (
              <div key={c.id} style={{ fontSize: 11, opacity: 0.5 }}>
                {c.started_at?.slice(0, 10)} — 자산 {fmt(c.equity_snapshot)} USDT 기준
                {c.note ? ` · ${c.note}` : ""}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function Field({ label, value, onChange, onBlur }: {
  label: string; value: any;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.55 }}>{label}</span>
      <input
        value={value}
        type="number"
        min="0"
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        style={iSt}
      />
    </label>
  );
}

const sectionHead: React.CSSProperties = { margin: "0 0 10px", fontSize: 13, fontWeight: 800, opacity: 0.6, letterSpacing: 0.3 };
const groupLabel: React.CSSProperties  = { fontSize: 12, fontWeight: 800, opacity: 0.65, marginBottom: 6 };
const twoCol: React.CSSProperties      = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const hint: React.CSSProperties        = { fontSize: 11, opacity: 0.4, marginTop: 5 };
const iSt: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 9, fontSize: 14,
  border: "1px solid var(--line-soft, rgba(0,0,0,.12))",
  background: "rgba(255,255,255,0.06)", outline: "none", width: "100%", color: "inherit",
};
const btnSt: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 9, border: "none",
  background: "var(--accent,#F0B429)", color: "#0a0a0a",
  fontWeight: 800, fontSize: 14, cursor: "pointer",
};
