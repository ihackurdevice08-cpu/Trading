"use client";

import { useEffect, useState } from "react";
import { uploadBackground } from "./uploadBg";
import { useAppearance } from "../../../components/providers/AppearanceProvider";
import { supabaseBrowser } from "@/lib/supabase/browser";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--line-soft)",
  background: "rgba(0,0,0,0.08)",
  color: "var(--text-primary)",
  outline: "none",
  fontSize: 15,
};

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--line-soft)", borderRadius: 16, padding: 16, background: "rgba(0,0,0,0.12)" }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
      {desc ? <div style={{ color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{desc}</div> : null}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>{children}</div>;
}

function RowToggle({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 12,
        borderRadius: 14,
        border: "1px solid var(--line-soft)",
        background: "rgba(0,0,0,0.10)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, marginTop: 2 }}
      />
      <div>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { appearance, patchAppearance, isAuthed } = useAppearance();
  const [busy, setBusy] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [msg, setMsg] = useState("");

// Risk settings state (appearance에서 분리)
  const [riskSettings, setRiskSettings] = useState<any>(null);
  const [riskMsg, setRiskMsg] = useState("");

  useEffect(() => {
    fetch("/api/risk-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j.ok) setRiskSettings(j.settings); })
      .catch(() => {});
  }, []);

  async function saveRiskSettings(patch: any) {
    if (!riskSettings) return;
    const next = { ...riskSettings, ...patch };
    setRiskSettings(next);
    setRiskMsg("Saving…");
    try {
      const r = await fetch("/api/risk-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const j = await r.json();
      setRiskMsg(j.ok ? "Saved." : j.error || "Save failed");
    } catch (e: any) {
      setRiskMsg(e?.message || "Save failed");
    }
  }
  
  // Bitget API form
  const [alias, setAlias] = useState("Main");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);

  async function loadAccounts() {
    try {
      const r = await fetch("/api/exchange-accounts", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setAccounts(j.accounts || []);
    } catch {}
  }

  useEffect(() => { loadAccounts(); }, []);

  async function manualSync(accountId?: string) {
    setSyncBusy(true);
    setSyncMsg("동기화 중…");
    try {
      const res = await fetch("/api/sync-now", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(accountId ? { account_id: accountId } : {}),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setSyncMsg(`실패: ${j?.error || res.status}`); return; }
      setSyncMsg(j?.note || "동기화 완료");
      window.dispatchEvent(new Event("trades-updated"));
    } catch (e: any) {
      setSyncMsg(`오류: ${e?.message || e}`);
    } finally {
      setSyncBusy(false);
    }
  }

  async function deleteAccount(id: string) {
    if (!window.confirm("이 계정을 삭제할까요?")) return;
    try {
      const r = await fetch(`/api/exchange-accounts?id=${id}`, { method: "DELETE" });
      const j = await r.json();
      if (j.ok) { loadAccounts(); setSyncMsg("계정 삭제 완료"); }
      else setSyncMsg(j.error || "삭제 실패");
    } catch (e: any) { setSyncMsg(e?.message); }
  }


  
  async function saveNow() {
    setBusy(true);
    setMsg("Saving…");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appearance }),
      });
      const text = await res.text();
      let j = null;
      try { j = JSON.parse(text); } catch {}
      if (!res.ok) { setMsg(`Save failed (${res.status}): ${(j && j.error) ? j.error : text}`); return; }
      setMsg((j && j.note) ? j.note : "Saved.");
    } catch (e) {
      setMsg(`Save failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }


  async function saveBitgetAccount() {
    setSyncMsg("");
    if (!alias || !apiKey || !apiSecret || !passphrase) {
      setSyncMsg("Alias / API Key / Secret / Passphrase를 모두 입력하세요.");
      return;
    }
    setApiBusy(true);
    setSyncMsg("계정 등록 중…");
    try {
      const r = await fetch("/api/exchange-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange: "bitget",
          alias,
          apiKey,
          apiSecret,
          passphrase,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setSyncMsg(`등록 실패: ${j?.error || r.status}`);
        return;
      }
      setSyncMsg("✅ 계정 등록 완료! 동기화 시작…");
      setApiKey(""); setApiSecret(""); setPassphrase("");
      await loadAccounts();
      await manualSync(j.account?.id);
    } catch (e: any) {
      setSyncMsg(`오류: ${e?.message || "unknown"}`);
    } finally {
      setApiBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2 }}>Settings</div>
        <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
          필요한 것만 천천히 조정하시면 됩니다. {isAuthed ? "현재 계정에 연결되어 있습니다." : "로그인 전입니다."}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); saveNow(); }}
          disabled={busy}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--line-hard)",
            background: "rgba(210,194,165,0.12)",
            color: "var(--text-primary)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>

        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); manualSync(); }}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--line-soft)",
            background: "transparent",
            color: "var(--text-primary)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Refresh (수동 동기화)
        </button>
      </div>

      {msg ? (
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", color: "var(--text-secondary)" }}>
          {msg}
        </div>
      ) : null}

      <Card title="Bitget API 연결" desc="API Key를 등록하면 거래 내역을 자동으로 불러옵니다. Read-only 권한만 필요합니다.">
        <div style={{ display: "grid", gap: 12 }}>

          {/* 상태 메시지 */}
          {syncMsg && (
            <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line-soft)", fontSize: 13, background: "rgba(0,0,0,0.04)" }}>
              {syncMsg}
            </div>
          )}

          {/* 등록된 계정 목록 */}
          {accounts.length > 0 && (
            <div>
              <Label>등록된 계정</Label>
              <div style={{ display: "grid", gap: 8 }}>
                {accounts.map((acc) => (
                  <div key={acc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.06)", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontWeight: 900, fontSize: 14 }}>{acc.alias}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>{acc.exchange}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => manualSync(acc.id)}
                        disabled={syncBusy}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line-soft)", fontWeight: 800, fontSize: 12, cursor: "pointer", background: "transparent" }}
                      >
                        {syncBusy ? "동기화 중…" : "🔄 동기화"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAccount(acc.id)}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(192,57,43,0.3)", color: "var(--red, #c0392b)", fontWeight: 800, fontSize: 12, cursor: "pointer", background: "transparent" }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => manualSync()}
                  disabled={syncBusy}
                  style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--line-hard)", fontWeight: 900, fontSize: 13, cursor: "pointer", background: "rgba(0,0,0,0.06)" }}
                >
                  {syncBusy ? "동기화 중…" : "🔄 전체 계정 동기화"}
                </button>
              </div>
            </div>
          )}

          {/* 새 계정 등록 */}
          <div>
            <Label>{accounts.length > 0 ? "새 계정 추가" : "API Key 등록"}</Label>
            <div style={{ display: "grid", gap: 8 }}>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="계정 이름 (예: Main, Prop)"
                style={inputStyle}
              />
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key"
                style={inputStyle}
                autoComplete="off"
              />
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="API Secret"
                style={inputStyle}
                autoComplete="off"
              />
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase"
                style={inputStyle}
                autoComplete="off"
              />
              <div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.5 }}>
                ⚠ Bitget에서 <b>Read-only</b> 권한으로만 발급하세요. IP 제한을 걸면 더 안전합니다.
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); saveBitgetAccount(); }}
                disabled={apiBusy}
                style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--line-hard)", background: "var(--text-primary)", color: "white", fontWeight: 900, cursor: "pointer", width: "fit-content" }}
              >
                {apiBusy ? "등록 중…" : "등록 & 동기화"}
              </button>
            </div>
          </div>
        </div>
      </Card>

      
<Card
        title="Trading State & Safety Rules"
        desc="모든 값은 로그인한 계정에 저장됩니다. 다른 기기에서 로그인해도 동일하게 유지됩니다."
      >
        <div style={{ display: "grid", gap: 12 }}>
          {riskMsg ? (
            <div style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line-soft)", color: "var(--text-muted)", fontSize: 13 }}>
              {riskMsg}
            </div>
          ) : null}

          <div>
            <Label>Manual Trading State</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["auto", "Great", "Good", "Slow Down", "Stop"].map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => saveRiskSettings({ manual_trading_state: x })}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--line-soft)",
                    background: riskSettings?.manual_trading_state === x ? "rgba(210,194,165,0.3)" : "transparent",
                    color: "var(--text-primary)",
                    fontWeight: riskSettings?.manual_trading_state === x ? 900 : 700,
                    cursor: "pointer",
                  }}
                >
                  {x}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 12 }}>
              Stop/Slow Down 선택 시 즉시 Risk API에 반영됩니다.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <Label>Max DD (USDT)</Label>
              <input
                value={riskSettings?.max_dd_usd ?? ""}
                onChange={(e) => setRiskSettings((p: any) => ({ ...p, max_dd_usd: e.target.value }))}
                onBlur={() => saveRiskSettings({})}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.08)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <Label>Max DD (%)</Label>
              <input
                value={riskSettings?.max_dd_pct ?? ""}
                onChange={(e) => setRiskSettings((p: any) => ({ ...p, max_dd_pct: e.target.value }))}
                onBlur={() => saveRiskSettings({})}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.08)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <Label>Max Daily Loss (USDT)</Label>
              <input
                value={riskSettings?.max_daily_loss_usd ?? ""}
                onChange={(e) => setRiskSettings((p: any) => ({ ...p, max_daily_loss_usd: e.target.value }))}
                onBlur={() => saveRiskSettings({})}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.08)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <Label>Max Daily Loss (%)</Label>
              <input
                value={riskSettings?.max_daily_loss_pct ?? ""}
                onChange={(e) => setRiskSettings((p: any) => ({ ...p, max_daily_loss_pct: e.target.value }))}
                onBlur={() => saveRiskSettings({})}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.08)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <Label>Max Consecutive Losses</Label>
              <input
                value={riskSettings?.max_consecutive_losses ?? ""}
                onChange={(e) => setRiskSettings((p: any) => ({ ...p, max_consecutive_losses: e.target.value }))}
                onBlur={() => saveRiskSettings({})}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.08)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <Label>Max Trades / Day</Label>
              <input
                value={riskSettings?.max_trades_per_day ?? ""}
                onChange={(e) => setRiskSettings((p: any) => ({ ...p, max_trades_per_day: e.target.value }))}
                onBlur={() => saveRiskSettings({})}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.08)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <Label>Max Trades / Hour</Label>
              <input
                value={riskSettings?.max_trades_per_hour ?? ""}
                onChange={(e) => setRiskSettings((p: any) => ({ ...p, max_trades_per_hour: e.target.value }))}
                onBlur={() => saveRiskSettings({})}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.08)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <Label>Seed (USDT)</Label>
              <input
                value={riskSettings?.seed_usd ?? ""}
                onChange={(e) => setRiskSettings((p: any) => ({ ...p, seed_usd: e.target.value }))}
                onBlur={() => saveRiskSettings({})}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.08)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
            입력 후 포커스를 벗어나면 자동 저장됩니다.
          </div>
        </div>
      </Card>
<Card title="Dashboard Rows" desc="대시보드에 표시할 Row를 선택합니다. 기본은 Row4 ON 입니다.">
        <div style={{ display: "grid", gap: 10 }}>
          <RowToggle
            checked={(appearance as any).showRow1Status}
            onChange={(v) => patchAppearance({ showRow1Status: v } as any)}
            title="Row 1 — Status"
            desc="Great / Good / Slow down / Stop"
          />
          <RowToggle
            checked={(appearance as any).showRow2AssetPerf}
            onChange={(v) => patchAppearance({ showRow2AssetPerf: v } as any)}
            title="Row 2 — Asset & Performance"
            desc="자산 곡선 + 성과 지표"
          />
          <RowToggle
            checked={(appearance as any).showRow3Behavior}
            onChange={(v) => patchAppearance({ showRow3Behavior: v } as any)}
            title="Row 3 — Behavior"
            desc="홀드시간/진입간격/거래빈도/연승연패"
          />
          <RowToggle
            checked={(appearance as any).showRow4Overtrade}
            onChange={(v) => patchAppearance({ showRow4Overtrade: v } as any)}
            title="Row 4 — Overtrade Monitor"
            desc="최근 1시간 과다거래 감시"
          />
          <RowToggle
            checked={(appearance as any).showRow5Goals}
            onChange={(v) => patchAppearance({ showRow5Goals: v } as any)}
            title="Row 5 — Goals"
            desc="진행중 목표 달성률"
          />

        </div>
      </Card>

      <Card title="Overtrade Count Basis" desc="기본은 CLOSE 기준입니다.">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => patchAppearance({ overtradeCountBasis: "close" as any } as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-soft)",
              background: (appearance as any).overtradeCountBasis === "close" ? "rgba(210,194,165,0.14)" : "transparent",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            CLOSE
          </button>
          <button
            type="button"
            onClick={() => patchAppearance({ overtradeCountBasis: "open" as any } as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-soft)",
              background: (appearance as any).overtradeCountBasis === "open" ? "rgba(210,194,165,0.14)" : "transparent",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            OPEN
          </button>
        </div>
      </Card>
      {/* =====================================================
          Appearance & Atmosphere (account-bound)
          ===================================================== */}
      <Card title="Appearance & Atmosphere" desc="모든 취향 설정은 로그인한 계정에 귀속됩니다. 다른 기기에서 로그인해도 그대로 유지됩니다.">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Appearance & Atmosphere</div>
            <div style={{ color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
              모든 취향 설정은 <b>로그인한 계정</b>에 귀속됩니다. 다른 기기에서 로그인해도 그대로 유지됩니다.
            </div>
          </div>
          <div style={{ color: "rgba(0,0,0,0.55)", fontSize: 12 }}>
            Hotel-grade calm, private-console clarity.
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <label style={{ 
  display: "grid",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid var(--line-soft)",
  background: "rgba(210,194,165,0.10)"
}}>
            <div style={{ 
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.2,
  color: "var(--text-muted)"
}}>Theme</div>
            <select
              value={appearance.themeId}
              onChange={(e) => patchAppearance({ themeId: e.target.value } as any)}
              style={{ 
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--line-hard)",
  background: "rgba(255,255,255,0.75)",
  color: "rgba(0,0,0,0.88)",
  fontWeight: 900,
  outline: "none"
}}
            >
              <option value="linen">Linen Suite</option>
              <option value="resort">Desert Resort</option>
              <option value="noir">Noir Executive</option>
              <option value="vault">Gold Vault</option>
              <option value="dune">Dune Beige</option>
            </select>
          </label>

          <label style={{ 
  display: "grid",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid var(--line-soft)",
  background: "rgba(210,194,165,0.10)"
}}>
            <div style={{ 
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.2,
  color: "var(--text-muted)"
}}>Navigation Layout</div>
            <select
              value={appearance.navLayout}
              onChange={(e) => patchAppearance({ navLayout: e.target.value } as any)}
              style={{ 
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--line-hard)",
  background: "rgba(255,255,255,0.75)",
  color: "rgba(0,0,0,0.88)",
  fontWeight: 900,
  outline: "none"
}}
            >
              <option value="top">Top (horizontal)</option>
              <option value="side">Side (vertical)</option>
            </select>
          </label>

          <label style={{ 
  display: "grid",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid var(--line-soft)",
  background: "rgba(210,194,165,0.10)"
}}>
            <div style={{ 
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.2,
  color: "var(--text-muted)"
}}>Cover Mode</div>
            <select
              value={(appearance.bg?.fit || "cover") as any}
              onChange={(e) => patchAppearance({ bg: { ...(appearance.bg || {}), fit: e.target.value } } as any)}
              style={{ 
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--line-hard)",
  background: "rgba(255,255,255,0.75)",
  color: "rgba(0,0,0,0.88)",
  fontWeight: 900,
  outline: "none"
}}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>
        </div>

        <div style={{ height: 12 }} />

        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={!!appearance.bg?.enabled}
            onChange={(e) => patchAppearance({ bg: { ...(appearance.bg || {}), enabled: e.target.checked } } as any)}
          />
          <div>
            <div style={{ fontWeight: 900 }}>Background enabled</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
              (업로드 기능은 Storage bucket 구성 후 활성화)
            </div>
          </div>
        </label>
      </Card>
      <Card
        title="Background Media Upload"
        desc="이미지/영상 배경을 계정에 귀속해 저장합니다. 다른 기기에서도 동일하게 유지됩니다."
      >
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Type</div>
            <select
              value={((appearance.bg?.type ?? "none") as any)}
              onChange={(e) => patchAppearance({ bg: { ...(appearance.bg || {}), type: e.target.value as any } } as any)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-hard)",
                background: "rgba(255,255,255,0.75)",
                color: "rgba(0,0,0,0.88)",
                fontWeight: 900,
              }}
            >
              <option value="none">None</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Fit</div>
            <select
              value={((appearance.bg?.fit ?? "cover") as any)}
              onChange={(e) => patchAppearance({ bg: { ...(appearance.bg || {}), fit: e.target.value as any } } as any)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-hard)",
                background: "rgba(255,255,255,0.75)",
                color: "rgba(0,0,0,0.88)",
                fontWeight: 900,
              }}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Opacity</div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={(typeof appearance.bg?.opacity === "number" ? appearance.bg.opacity : 0.25)}
              onChange={(e) => patchAppearance({ bg: { ...(appearance.bg || {}), opacity: Number(e.target.value) } } as any)}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Blur(px)</div>
            <input
              type="range"
              min="0"
              max="24"
              step="1"
              value={(typeof appearance.bg?.blurPx === "number" ? appearance.bg.blurPx : 10)}
              onChange={(e) => patchAppearance({ bg: { ...(appearance.bg || {}), blurPx: Number(e.target.value) } } as any)}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Dim</div>
            <input
              type="range"
              min="0"
              max="0.9"
              step="0.01"
              value={(typeof appearance.bg?.dim === "number" ? appearance.bg.dim : 0.45)}
              onChange={(e) => patchAppearance({ bg: { ...(appearance.bg || {}), dim: Number(e.target.value) } } as any)}
            />
          </label>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Upload (Supabase Storage)</div>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const sb = supabaseBrowser();
                  const { data } = await sb.auth.getSession();
                  if (!data.session?.user?.id) { alert("Login required"); return; }

                  const ext = (f.name.split(".").pop() || "bin").toLowerCase();
                  const path = `${data.session.user.id}/bg.${ext}`;

                  const up = await sb.storage.from("mancave-media").upload(path, f, { upsert: true });
                  if (up.error) { alert(up.error.message); return; }

                  const pub = sb.storage.from("mancave-media").getPublicUrl(path);
                  const url = pub.data.publicUrl;

                  // 업로드한 파일 유형에 따라 타입 자동 세팅
                  const isVideo = f.type.startsWith("video/");
                  patchAppearance({ bg: { ...(appearance.bg || {}), url: url,
                    type: isVideo ? "video" : "image", } } as any);
                  alert("Uploaded");
                } catch (err: any) {
                  alert(err?.message || String(err));
                }
              }}
            />
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              업로드 후 URL이 저장되고, App 전체 배경에 즉시 반영됩니다.
            </div>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Or paste URL</div>
            <input
              type="text"
              value={(appearance.bg?.url ?? "") || ""}
              onChange={(e) => patchAppearance({ bg: { ...(appearance.bg || {}), url: e.target.value } } as any)}
              placeholder="https://..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-hard)",
                background: "rgba(255,255,255,0.75)",
                color: "rgba(0,0,0,0.88)",
                fontWeight: 900,
                outline: "none",
              }}
            />
          </label>
        </div>
      </Card>




    </div>
  );
}
