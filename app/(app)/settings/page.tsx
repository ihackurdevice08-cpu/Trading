"use client";

import { useEffect, useState } from "react";
import { uploadBackground } from "./uploadBg";
import { useAppearance } from "../../../components/providers/AppearanceProvider";
import { firebaseAuth } from "@/lib/firebase/client";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseApp } from "@/lib/firebase/client";

// ─── 공통 스타일 (다른 탭과 동일한 체계) ───────────────────────
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 11px", borderRadius: 9, fontSize: 14,
  border: "1px solid var(--line-soft, rgba(0,0,0,.12))",
  background: "rgba(255,255,255,0.06)", outline: "none", color: "inherit",
};
const sel: React.CSSProperties = {
  ...inp as any,
  cursor: "pointer",
};
const lbl: React.CSSProperties = {
  fontSize: 11, opacity: .6, fontWeight: 700, marginBottom: 4,
};
const fieldWrap: React.CSSProperties = {
  display: "grid", gap: 4,
};
const btn1: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap",
  border: "1px solid var(--line-hard, rgba(0,0,0,.18))",
  background: "var(--accent,#F0B429)", color: "#0a0a0a",
  fontWeight: 800, fontSize: 13,
};
const btn2: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap",
  border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
  background: "transparent", fontWeight: 700, fontSize: 13,
};

// ─── 섹션 컴포넌트 ────────────────────────────────────────────
function Section({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
      borderRadius: 12, background: "var(--panel, rgba(255,255,255,0.72))",
      overflow: "hidden",
    }}>
      {/* 섹션 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "11px 14px",
        borderBottom: "1px solid var(--line-soft)",
        background: "rgba(255,255,255,0.03)",
      }}>
        <span style={{ fontSize: 12, opacity: .5 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 800, opacity: .7, letterSpacing: .2 }}>{title}</span>
      </div>
      {/* 섹션 내용 */}
      <div style={{ padding: "14px" }}>
        {children}
      </div>
    </div>
  );
}

// ─── 토글 행 ──────────────────────────────────────────────────
function ToggleRow({
  on, onToggle, label, sub, disabled,
}: { on: boolean; onToggle: () => void; label: string; sub?: string; disabled?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 12px", borderRadius: 9,
      border: "1px solid var(--line-soft)",
      background: "rgba(255,255,255,0.03)", gap: 12,
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, opacity: .5, marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        style={{
          padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 800,
          cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0,
          border: "1px solid var(--line-soft, rgba(0,0,0,.12))",
          background: on ? "var(--accent,#F0B429)" : "rgba(255,255,255,0.06)",
          color: on ? "#0a0a0a" : "var(--text-secondary)",
          opacity: disabled ? .35 : 1,
          transition: "all 0.15s",
        }}
      >
        {on ? "켜짐" : "꺼짐"}
      </button>
    </div>
  );
}

// ─── 칩 버튼 그룹 ─────────────────────────────────────────────
function ChipGroup<T extends string>({
  options, value, onChange, colorFn,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  colorFn?: (v: T) => string;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: "7px 14px", borderRadius: 8, fontSize: 12,
          cursor: "pointer", border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
          background: value === o.value ? "rgba(240,180,41,0.12)" : "transparent",
          fontWeight: value === o.value ? 800 : 600,
          color: value === o.value && colorFn ? colorFn(o.value) : "inherit",
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function SettingsPage() {
  const { appearance, patchAppearance } = useAppearance();

  // Bitget 계정
  const [accounts,  setAccounts]  = useState<any[]>([]);
  const [apiKey,    setApiKey]    = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase,setPassphrase]= useState("");
  const [alias,     setAlias]     = useState("");
  const [syncBusy,  setSyncBusy]  = useState(false);
  const [apiBusy,   setApiBusy]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState("");

  // 리스크 설정
  const [riskSettings, setRiskSettings] = useState<any>(null);
  const [riskMsg,      setRiskMsg]      = useState("");

  // 노션 연동
  const [notionToken,  setNotionToken]  = useState("");
  const [notionDbId,   setNotionDbId]   = useState("");
  const [notionMsg,    setNotionMsg]    = useState("");
  const [notionBusy,   setNotionBusy]   = useState(false);

  // 외관 저장 메시지
  const [saveMsg, setSaveMsg] = useState("");

  // ── 로드 (병렬) ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/exchange-accounts", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/risk-settings",     { cache: "no-store" }).then(r => r.json()),
      fetch("/api/notion-settings",   { cache: "no-store" }).then(r => r.json()),
    ]).then(([acc, risk, notion]) => {
      if (acc.ok)    setAccounts(acc.accounts || []);
      if (risk.ok)   setRiskSettings(risk.settings);
      if (notion.ok) {
        setNotionToken(notion.notion?.token       ?? "");
        setNotionDbId(notion.notion?.database_id  ?? "");
      }
    }).catch(() => {});
  }, []);

  async function loadAccounts() {
    try {
      const r = await fetch("/api/exchange-accounts", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setAccounts(j.accounts || []);
    } catch {}
  }

  // ── 계정 삭제 ───────────────────────────────────────────────
  async function deleteAccount(id: string) {
    if (!confirm("이 계정을 삭제할까요?")) return;
    try {
      const r = await fetch(`/api/exchange-accounts?id=${id}`, { method: "DELETE" });
      const j = await r.json();
      if (j.ok) { loadAccounts(); setSyncMsg("계정 삭제 완료"); }
      else setSyncMsg(j.error || "삭제 실패");
    } catch (e: any) { setSyncMsg(e?.message || "오류"); }
  }

  // ── 전체 계정 동기화 ────────────────────────────────────────
  async function manualSync(accountId?: string) {
    setSyncBusy(true); setSyncMsg("동기화 중…");
    try {
      const body: any = { from: new Date(Date.now() - 30 * 86400_000).toISOString().slice(0,10) };
      if (accountId) body.account_id = accountId;
      const r = await fetch("/api/sync-now", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      setSyncMsg(j.ok ? `✅ ${j.note}` : `❌ ${j.error}`);
    } catch (e: any) { setSyncMsg(`❌ ${e?.message}`); }
    finally { setSyncBusy(false); }
  }

  // ── 계정 등록 ───────────────────────────────────────────────
  async function saveBitgetAccount() {
    if (!apiKey.trim() || !apiSecret.trim() || !passphrase.trim()) {
      setSyncMsg("API Key, Secret, Passphrase 모두 입력하세요."); return;
    }
    setApiBusy(true); setSyncMsg("계정 등록 중…");
    try {
      const r = await fetch("/api/exchange-accounts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exchange: "bitget", alias: alias.trim() || "Bitget",
          apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), passphrase: passphrase.trim(),
        }),
      });
      const j = await r.json();
      if (!j.ok) { setSyncMsg(`등록 실패: ${j?.error || r.status}`); return; }
      setSyncMsg("✅ 계정 등록 완료!");
      setApiKey(""); setApiSecret(""); setPassphrase(""); setAlias("");
      await loadAccounts();
      if (j.account?.id) await manualSync(j.account.id);
    } catch (e: any) { setSyncMsg(`오류: ${e?.message}`); }
    finally { setApiBusy(false); }
  }

  // ── 리스크 설정 저장 ────────────────────────────────────────
  async function saveRisk(patch: any = {}) {
    if (!riskSettings) return;
    const next = { ...riskSettings, ...patch };
    setRiskSettings(next);
    setRiskMsg("저장 중…");
    try {
      const r = await fetch("/api/risk-settings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const j = await r.json();
      if (j.ok) {
        // 서버가 반환한 실제 저장값으로 상태 갱신 (0 덮어쓰기 방지)
        if (j.settings) setRiskSettings(j.settings);
        setRiskMsg("✓ 저장 완료");
      } else {
        setRiskMsg(j.error || "저장 실패");
      }
    } catch (e: any) { setRiskMsg(e?.message || "저장 실패"); }
  }

  // USDT ↔ % 자동 계산 헬퍼
  function toN(v: any) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  function onDdUsd(v: string) {
    const usd = toN(v); const seed = toN(riskSettings?.seed_usd);
    const next: any = { ...riskSettings, max_dd_usd: v };
    if (usd != null && seed != null && seed > 0)
      next.max_dd_pct = Number(((usd / seed) * 100).toFixed(2));
    setRiskSettings(next);
  }
  function onDdPct(v: string) {
    const pct = toN(v); const seed = toN(riskSettings?.seed_usd);
    const next: any = { ...riskSettings, max_dd_pct: v };
    if (pct != null && seed != null && seed > 0)
      next.max_dd_usd = Number(((pct / 100) * seed).toFixed(2));
    setRiskSettings(next);
  }
  function onDailyUsd(v: string) {
    const usd = toN(v); const seed = toN(riskSettings?.seed_usd);
    const next: any = { ...riskSettings, max_daily_loss_usd: v };
    if (usd != null && seed != null && seed > 0)
      next.max_daily_loss_pct = Number(((usd / seed) * 100).toFixed(2));
    setRiskSettings(next);
  }
  function onDailyPct(v: string) {
    const pct = toN(v); const seed = toN(riskSettings?.seed_usd);
    const next: any = { ...riskSettings, max_daily_loss_pct: v };
    if (pct != null && seed != null && seed > 0)
      next.max_daily_loss_usd = Number(((pct / 100) * seed).toFixed(2));
    setRiskSettings(next);
  }
  function onSeedChange(v: string) {
    const seed = toN(v);
    const next: any = { ...riskSettings, seed_usd: v };
    if (seed != null && seed > 0) {
      const ddUsd    = toN(riskSettings?.max_dd_usd);
      const dailyUsd = toN(riskSettings?.max_daily_loss_usd);
      if (ddUsd    != null) next.max_dd_pct         = Number(((ddUsd    / seed) * 100).toFixed(2));
      if (dailyUsd != null) next.max_daily_loss_pct = Number(((dailyUsd / seed) * 100).toFixed(2));
    }
    setRiskSettings(next);
  }

  // 리스크 위젯 토글
  const rw = appearance.riskWidget ?? { dashboard: true, trades: true };
  function toggleRw(tab: "dashboard" | "trades") {
    const next = { ...rw, [tab]: !rw[tab] };
    if (!next.dashboard && !next.trades) return; // 최소 1개 유지
    patchAppearance({ riskWidget: next });
  }

  // 노션 설정 저장
  async function saveNotion() {
    setNotionBusy(true); setNotionMsg("");
    try {
      const r = await fetch("/api/notion-settings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: notionToken.trim(), database_id: notionDbId.trim() }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setNotionMsg("✅ 저장됨");
    } catch (e: any) { setNotionMsg("❌ " + (e?.message ?? "저장 실패")); }
    finally { setNotionBusy(false); }
  }

  // 노션 연결 테스트
  async function testNotion() {
    setNotionBusy(true); setNotionMsg("");
    try {
      const r = await fetch(`https://api.notion.com/v1/databases/${notionDbId.trim()}`, {
        headers: { "Authorization": `Bearer ${notionToken.trim()}`, "Notion-Version": "2022-06-28" },
      });
      if (r.ok) { setNotionMsg("✅ 연결 성공"); }
      else {
        const j = await r.json();
        throw new Error(j.message ?? `HTTP ${r.status}`);
      }
    } catch (e: any) { setNotionMsg("❌ " + (e?.message ?? "연결 실패")); }
    finally { setNotionBusy(false); }
  }

  // 외관 저장 (수동)
  async function saveAppearanceNow() {
    setSaveMsg("저장 중…");
    try {
      const r = await fetch("/api/settings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ appearance }),
      });
      const j = await r.json();
      setSaveMsg(j.ok ? "✓ 저장 완료" : j.error || "저장 실패");
    } catch (e: any) { setSaveMsg(e?.message || "저장 실패"); }
  }

  // ── 렌더 ────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 800 }}>

      {/* 페이지 제목 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>설정</h1>
        <div style={{ fontSize: 12, opacity: .5, marginTop: 3 }}>
          계정에 귀속된 설정 · 다른 기기에서도 동일하게 유지됩니다
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>

        {/* ── 1. Bitget API 연결 ─────────────────────────────── */}
        <Section icon="⚡" title="Bitget API 연결">
          <div style={{ display: "grid", gap: 12 }}>

            {syncMsg && (
              <div style={{
                padding: "9px 12px", borderRadius: 9, fontSize: 13,
                background: "rgba(255,255,255,0.05)", border: "1px solid var(--line-soft)",
              }}>{syncMsg}</div>
            )}

            {/* 등록된 계정 */}
            {accounts.length > 0 && (
              <div>
                <div style={{ ...lbl, marginBottom: 8 }}>등록된 계정</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {accounts.map(acc => (
                    <div key={acc.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 12px", borderRadius: 9, gap: 10, flexWrap: "wrap",
                      border: "1px solid var(--line-soft)",
                      background: "rgba(255,255,255,0.03)",
                    }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>{acc.alias}</span>
                        <span style={{ fontSize: 11, opacity: .5, marginLeft: 8 }}>
                          {acc.exchange} · {acc.api_key_preview || "••••"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => manualSync(acc.id)} disabled={syncBusy}
                          style={{ ...btn2, fontSize: 12, padding: "6px 12px" }}>
                          {syncBusy ? "동기화 중…" : "동기화"}
                        </button>
                        <button onClick={() => deleteAccount(acc.id)}
                          style={{
                            padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                            cursor: "pointer", border: "1px solid rgba(192,57,43,.2)",
                            background: "rgba(192,57,43,.06)", color: "var(--red, #c0392b)",
                          }}>
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {accounts.length > 0 && (
                  <button onClick={() => manualSync()} disabled={syncBusy}
                    style={{ ...btn2, marginTop: 8, fontSize: 12 }}>
                    {syncBusy ? "동기화 중…" : "전체 계정 동기화"}
                  </button>
                )}
              </div>
            )}

            {/* 새 계정 등록 */}
            <div>
              <div style={{ ...lbl, marginBottom: 8 }}>
                {accounts.length > 0 ? "새 계정 추가" : "API Key 등록"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 10 }}>
                <div style={fieldWrap}>
                  <span style={lbl}>계정 이름</span>
                  <input value={alias} placeholder="예: Main, Prop" onChange={e => setAlias(e.target.value)} style={inp} />
                </div>
                <div style={fieldWrap}>
                  <span style={lbl}>API Key</span>
                  <input value={apiKey} placeholder="bg_…" onChange={e => setApiKey(e.target.value)} style={inp} />
                </div>
                <div style={fieldWrap}>
                  <span style={lbl}>API Secret</span>
                  <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} style={inp} />
                </div>
                <div style={fieldWrap}>
                  <span style={lbl}>Passphrase</span>
                  <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} style={inp} />
                </div>
              </div>
              <div style={{ fontSize: 11, opacity: .55, marginBottom: 10, padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid var(--line-soft)" }}>
                ⚠ Bitget에서 <b>Read-only</b> 권한으로만 발급하세요. IP 제한을 걸면 더 안전합니다.
              </div>
              <button onClick={() => { const e = document.createEvent("Event"); e.initEvent("submit",true,true); saveBitgetAccount(); }}
                disabled={apiBusy} style={btn1}>
                {apiBusy ? "등록 중…" : "등록 & 동기화"}
              </button>
            </div>
          </div>
        </Section>

        {/* ── 2. 리스크 한도 설정 ────────────────────────────── */}
        <Section icon="◬" title="리스크 한도 설정">
          {riskSettings == null ? (
            <div style={{ fontSize: 13, opacity: .45 }}>불러오는 중…</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {riskMsg && (
                <div style={{ fontSize: 12, opacity: .6, padding: "6px 10px", borderRadius: 8,
                  background: "rgba(255,255,255,0.03)", border: "1px solid var(--line-soft)" }}>
                  {riskMsg}
                </div>
              )}

              {/* 거래 상태 */}
              <div>
                <div style={lbl}>거래 상태</div>
                <ChipGroup
                  options={[
                    { value: "auto",       label: "자동"   },
                    { value: "Great",      label: "Great"  },
                    { value: "Good",       label: "Good"   },
                    { value: "Slow Down",  label: "주의"   },
                    { value: "Stop",       label: "중단"   },
                  ]}
                  value={riskSettings.manual_trading_state}
                  onChange={v => saveRisk({ manual_trading_state: v })}
                />
                <div style={{ fontSize: 11, opacity: .5, marginTop: 6 }}>
                  Stop/주의 선택 시 리스크 API에 즉시 반영됩니다.
                </div>
              </div>

              {/* 수치 입력 */}
              <div style={{ display: "grid", gap: 12 }}>
                {/* 최대 낙폭 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.65, marginBottom: 8 }}>최대 낙폭 방식</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    {([
                      { val: "drawdown", label: "낙폭 방식",   sub: "피크 대비 하락" },
                      { val: "floor",    label: "잔고 하한선", sub: "절대 금액 기준" },
                    ] as const).map(({ val, label, sub }) => (
                      <div key={val}
                        onClick={() => saveRisk({ dd_mode: val })}
                        style={{
                          padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                          border: `1.5px solid ${(riskSettings.dd_mode ?? "drawdown") === val ? "var(--accent,#B89A5A)" : "var(--line-soft,rgba(0,0,0,.1))"}`,
                          background: (riskSettings.dd_mode ?? "drawdown") === val ? "rgba(184,154,90,0.08)" : "transparent",
                          transition: "all .15s",
                        }}>
                        <div style={{ fontWeight: 800, fontSize: 12 }}>{label}</div>
                        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{sub}</div>
                      </div>
                    ))}
                  </div>

                  {(riskSettings.dd_mode ?? "drawdown") === "floor" ? (
                    <div style={fieldWrap}>
                      <span style={lbl}>잔고 하한선 (USDT)</span>
                      <input type="number" min="0"
                        value={riskSettings.dd_floor_usd ?? ""}
                        onChange={e => setRiskSettings((p: any) => ({ ...p, dd_floor_usd: e.target.value }))}
                        onBlur={() => saveRisk({})} style={inp} />
                      <span style={{ fontSize: 11, opacity: .4, marginTop: 2 }}>잔고가 이 금액 아래로 내려가면 경고</span>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={fieldWrap}>
                          <span style={lbl}>USDT</span>
                          <input type="number" min="0"
                            value={riskSettings.max_dd_usd ?? ""}
                            onChange={e => onDdUsd(e.target.value)}
                            onBlur={() => saveRisk({})} style={inp} />
                        </div>
                        <div style={fieldWrap}>
                          <span style={lbl}>%</span>
                          <input type="number" min="0"
                            value={riskSettings.max_dd_pct ?? ""}
                            onChange={e => onDdPct(e.target.value)}
                            onBlur={() => saveRisk({})} style={inp} />
                        </div>
                      </div>
                      <div style={{ fontSize: 11, opacity: .4, marginTop: 4 }}>둘 중 하나만 입력하면 나머지가 자동 계산됩니다.</div>
                    </div>
                  )}
                </div>

                {/* 일 최대 손실 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.65, marginBottom: 6 }}>일 최대 손실</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={fieldWrap}>
                      <span style={lbl}>USDT</span>
                      <input type="number" min="0"
                        value={riskSettings.max_daily_loss_usd ?? ""}
                        onChange={e => onDailyUsd(e.target.value)}
                        onBlur={() => saveRisk({})} style={inp} />
                    </div>
                    <div style={fieldWrap}>
                      <span style={lbl}>%</span>
                      <input type="number" min="0"
                        value={riskSettings.max_daily_loss_pct ?? ""}
                        onChange={e => onDailyPct(e.target.value)}
                        onBlur={() => saveRisk({})} style={inp} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, opacity: .4, marginTop: 4 }}>둘 중 하나만 입력하면 나머지가 자동 계산됩니다.</div>
                </div>

                {/* 최대 연속 손실 */}
                <div style={fieldWrap}>
                  <span style={lbl}>최대 연속 손실 (횟수)</span>
                  <input type="number" min="0"
                    value={riskSettings.max_consecutive_losses ?? ""}
                    onChange={e => setRiskSettings((p: any) => ({ ...p, max_consecutive_losses: e.target.value }))}
                    onBlur={() => saveRisk({})} style={inp} />
                </div>
              </div>
              <div style={{ fontSize: 11, opacity: .45 }}>입력 후 포커스를 벗어나면 자동 저장됩니다.</div>
            </div>
          )}
        </Section>

        {/* ── 3. 리스크 위젯 표시 ────────────────────────────── */}
        <Section icon="◉" title="리스크 위젯 표시">
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, opacity: .55, marginBottom: 4 }}>
              대시보드 및 거래기록 탭 상단에 리스크 현황을 표시합니다. 최소 한 탭은 항상 켜져 있어야 합니다.
            </div>
            <ToggleRow
              on={rw.dashboard}
              onToggle={() => toggleRw("dashboard")}
              label="대시보드 탭"
              sub={rw.dashboard ? "리스크 현황 표시 중" : "숨김"}
              disabled={rw.dashboard && !rw.trades}
            />
            <ToggleRow
              on={rw.trades}
              onToggle={() => toggleRw("trades")}
              label="거래기록 탭"
              sub={rw.trades ? "리스크 현황 표시 중" : "숨김"}
              disabled={rw.trades && !rw.dashboard}
            />
          </div>
        </Section>

        {/* ── 4. 외관 설정 ───────────────────────────────────── */}
        <Section icon="◐" title="외관 설정">
          <div style={{ display: "grid", gap: 14 }}>

            {/* 테마 선택 */}
            <div>
              <span style={lbl}>테마</span>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {([
                  { id: "linen", name: "라이트", bg: "#F4F0E6", accent: "#B89A5A", textDark: true  },
                  { id: "noir",  name: "다크",   bg: "#0F0F12", accent: "#D6B56E", textDark: false },
                ] as { id:string; name:string; bg:string; accent:string; textDark:boolean }[]).map(t => {
                  const active = (appearance.themeId === t.id) ||
                    (t.id === "linen" && !["noir","vault","lounge"].includes(appearance.themeId ?? ""));
                  const fg = t.textDark ? "rgba(0,0,0,0.85)" : "rgba(226,221,214,0.9)";
                  return (
                    <button key={t.id} onClick={() => patchAppearance({ themeId: t.id as any })}
                      style={{
                        flex: 1, padding: 0, border: "none", background: "none", cursor: "pointer",
                        outline: active ? `2px solid ${t.accent}` : "1px solid rgba(0,0,0,0.1)",
                        outlineOffset: active ? 2 : 0,
                        borderRadius: 10, overflow: "hidden", transition: "outline .15s", textAlign: "left",
                      }}>
                      <div style={{ background: t.bg, padding: "12px 14px 10px" }}>
                        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                          <div style={{ height: 4, borderRadius: 2, flex: 2, background: t.accent }} />
                          <div style={{ height: 4, borderRadius: 2, flex: 1, background: fg, opacity: .15 }} />
                        </div>
                        <div style={{ fontSize: 10, color: fg, opacity: .6 }}>Man Cave OS</div>
                      </div>
                      <div style={{ background: t.bg, padding: "6px 14px 10px", borderTop: `1px solid ${t.accent}20` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: fg }}>
                          {active ? "✓ " : ""}{t.name}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 내비게이션 */}
            <div style={fieldWrap}>
              <span style={lbl}>내비게이션</span>
              <select value={appearance.navLayout}
                onChange={e => patchAppearance({ navLayout: e.target.value } as any)}
                style={sel}>
                <option value="top">상단 (가로)</option>
                <option value="side">사이드 (세로)</option>
              </select>
            </div>

            {/* 배경 on/off */}
            <ToggleRow
              on={!!appearance.bg?.enabled}
              onToggle={() => patchAppearance({ bg: { ...(appearance.bg || {}), enabled: !appearance.bg?.enabled } } as any)}
              label="배경 이미지/영상"
              sub="업로드 또는 URL로 배경 설정"
            />

            {/* 배경 상세 설정 - 켜져있을 때만 */}
            {appearance.bg?.enabled && (
              <div style={{ display: "grid", gap: 10, padding: "12px", borderRadius: 9,
                border: "1px solid var(--line-soft)", background: "rgba(255,255,255,0.02)" }}>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                  <div style={fieldWrap}>
                    <span style={lbl}>타입</span>
                    <select value={(appearance.bg?.type ?? "none") as any}
                      onChange={e => patchAppearance({ bg: { ...(appearance.bg || {}), type: e.target.value as any } } as any)}
                      style={sel}>
                      <option value="none">없음</option>
                      <option value="image">이미지</option>
                      <option value="video">영상</option>
                    </select>
                  </div>
                  <div style={fieldWrap}>
                    <span style={lbl}>맞춤</span>
                    <select value={(appearance.bg?.fit ?? "cover") as any}
                      onChange={e => patchAppearance({ bg: { ...(appearance.bg || {}), fit: e.target.value as any } } as any)}
                      style={sel}>
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                    </select>
                  </div>
                </div>

                {/* 슬라이더 */}
                {([
                  ["투명도",   "opacity", 0,    1,    0.01, 0.25],
                  ["흐림(px)", "blurPx",  0,    24,   1,    10  ],
                  ["어둠",     "dim",     0,    0.9,  0.01, 0.45],
                ] as [string, string, number, number, number, number][]).map(([label, key, min, max, step, def]) => (
                  <div key={key} style={fieldWrap}>
                    <span style={lbl}>{label}
                      <span style={{ opacity: .6, marginLeft: 6, fontWeight: 600 }}>
                        {typeof (appearance.bg as any)?.[key] === "number"
                          ? Number((appearance.bg as any)[key]).toFixed(2)
                          : def.toFixed(2)}
                      </span>
                    </span>
                    <input type="range" min={min} max={max} step={step}
                      value={typeof (appearance.bg as any)?.[key] === "number" ? (appearance.bg as any)[key] : def}
                      onChange={e => patchAppearance({ bg: { ...(appearance.bg || {}), [key]: Number(e.target.value) } } as any)}
                      style={{ width: "100%" }}
                    />
                  </div>
                ))}

                {/* 파일 업로드 */}
                <div style={fieldWrap}>
                  <span style={lbl}>파일 업로드</span>
                  <input type="file" accept="image/*,video/*"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                      const user = firebaseAuth().currentUser;
                        if (!user) { alert("로그인 필요"); return; }
                        const ext = (f.name.split(".").pop() || "bin").toLowerCase();
                        const path = `${user.uid}/bg.${ext}`;
                        const storage = getStorage(getFirebaseApp());
                        const fileRef = storageRef(storage, path);
                        const snap = await uploadBytes(fileRef, f);
                        if (!snap) { alert("업로드 실패"); return; }
                        const url = await getDownloadURL(fileRef);
                        patchAppearance({ bg: { ...(appearance.bg || {}),
                          url, type: f.type.startsWith("video/") ? "video" : "image" } } as any);
                        alert("업로드 완료");
                      } catch (err: any) { alert(err?.message || String(err)); }
                    }}
                    style={{ fontSize: 13 }}
                  />
                </div>

                {/* URL 직접 입력 */}
                <div style={fieldWrap}>
                  <span style={lbl}>URL 직접 입력</span>
                  <input type="text" value={(appearance.bg?.url ?? "") || ""}
                    onChange={e => patchAppearance({ bg: { ...(appearance.bg || {}), url: e.target.value } } as any)}
                    placeholder="https://…"
                    style={inp}
                  />
                </div>
              </div>
            )}

            {/* 저장 버튼 */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={saveAppearanceNow} style={btn1}>외관 저장</button>
              {saveMsg && <span style={{ fontSize: 12, opacity: .6 }}>{saveMsg}</span>}
              <span style={{ fontSize: 11, opacity: .4, marginLeft: "auto" }}>
                테마/내비게이션 변경은 즉시 반영됩니다
              </span>
            </div>
          </div>
        </Section>

        {/* ── 노션 연동 ── */}
        <Section title="노션 저널 연동" icon="📓">
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ fontSize: 12, opacity: .55, lineHeight: 1.6,
              padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--line-soft)" }}>
              <b>설정 방법:</b><br />
              1. <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer"
                style={{ color: "var(--accent,#B89A5A)" }}>notion.so/my-integrations</a>에서 Integration 생성<br />
              2. Integration Token (secret_xxx…) 복사 후 아래 입력<br />
              3. 저장할 노션 데이터베이스를 Integration에 연결 (DB 우측 상단 … → Connect to)<br />
              4. 데이터베이스 URL에서 ID 복사 (32자리 hex)<br />
              5. DB 속성: <b>Name</b>(제목), <b>Date</b>(날짜), <b>PnL</b>(숫자) 추가 권장
            </div>

            <div style={fieldWrap}>
              <span style={lbl}>Integration Token</span>
              <input
                type="password"
                value={notionToken}
                onChange={e => setNotionToken(e.target.value)}
                placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={inp}
              />
            </div>

            <div style={fieldWrap}>
              <span style={lbl}>데이터베이스 ID</span>
              <input
                value={notionDbId}
                onChange={e => setNotionDbId(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={inp}
              />
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={saveNotion} disabled={notionBusy || !notionToken || !notionDbId} style={btn1}>
                {notionBusy ? "저장 중…" : "저장"}
              </button>
              <button onClick={testNotion} disabled={notionBusy || !notionToken || !notionDbId} style={btn2}>
                연결 테스트
              </button>
              {notionMsg && <span style={{ fontSize: 12, opacity: .7 }}>{notionMsg}</span>}
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}
