"use client";

import { useState } from "react";
import { uploadBackground } from "./uploadBg";
import { useAppearance } from "../../../components/providers/AppearanceProvider";
import { supabaseBrowser } from "@/lib/supabase/browser";

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

  // Bitget API form
  const [alias, setAlias] = useState("Main");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  
  async function manualSync() {
    setMsg("Syncing…");
    try {
      const res = await fetch("/api/sync-now", { method: "POST" });
      const text = await res.text();
      let j = null;
      try { j = JSON.parse(text); } catch {}
      if (!res.ok) { setMsg(`Sync failed (${res.status}): ${(j && j.error) ? j.error : text}`); return; }
      setMsg((j && j.note) ? j.note : "Sync done.");
    } catch (e) {
      setMsg(`Sync failed: ${e?.message || e}`);
    }
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
    setMsg("");
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getUser();
    const user_id = data?.user?.id;

    if (!user_id) {
      setMsg("로그인이 필요합니다.");
      return;
    }
    if (!alias || !apiKey || !apiSecret || !passphrase) {
      setMsg("Alias / API Key / Secret / Passphrase를 모두 입력하세요.");
      return;
    }

    setApiBusy(true);
    setMsg("Registering Bitget account…");
    try {
      const r = await fetch("/api/exchange-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          exchange: "bitget",
          alias,
          apiKey,
          apiSecret,
          passphrase,
        }),
      });

      const text = await r.text();
      let j: any = null;
      try { j = JSON.parse(text); } catch {}

      if (!r.ok || !j?.ok) {
        setMsg(`Register failed (${r.status}): ${j?.error || text}`);
        return;
      }

      await manualSync();

      setApiKey("");
      setApiSecret("");
      setPassphrase("");
    } catch (e: any) {
      setMsg(`Register failed: ${e?.message || "unknown error"}`);
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

      <Card title="Bitget API 연결" desc="현재는 Bitget만 지원합니다. 등록 즉시 동기화를 시작합니다.">
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <Label>Account Alias</Label>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Main / Prop / Sub ..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "rgba(0,0,0,0.08)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <Label>API Key</Label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="bitget api key"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "rgba(0,0,0,0.08)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <Label>API Secret</Label>
            <input
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="bitget api secret"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "rgba(0,0,0,0.08)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <Label>Passphrase</Label>
            <input
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="bitget passphrase"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "rgba(0,0,0,0.08)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); saveBitgetAccount(); }}
            disabled={apiBusy}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-hard)",
              background: "rgba(210,194,165,0.16)",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
              width: "fit-content",
            }}
          >
            {apiBusy ? "Registering…" : "Register & Sync now"}
          </button>
        </div>
      </Card>

      
      <Card
        title="Trading State & Safety Rules"
        desc="모든 값은 로그인한 계정에 저장됩니다. 다른 기기에서 로그인해도 동일하게 유지됩니다."
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <Label>Manual Trading State</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["auto","Great","Good","Slow Down","Stop"].map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => patchAppearance({ manualTradingState: x } as any)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--line-soft)",
                    background: (appearance as any).manualTradingState === x ? "rgba(210,194,165,0.14)" : "transparent",
                    color: "var(--text-primary)",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {x}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
              auto는 향후 API/거래 데이터 기반 자동판단으로 전환됩니다.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <Label>Slow Down after consecutive wins</Label>
              <input
                value={String((appearance as any).slowDownAfterWins ?? 4)}
                onChange={(e) => patchAppearance({ slowDownAfterWins: Number(e.target.value || 0) } as any)}
                placeholder="4"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>연승 과열 시 속도 조절 기준</div>
            </div>

            <div>
              <Label>Stop after consecutive losses</Label>
              <input
                value={String((appearance as any).stopAfterLosses ?? 3)}
                onChange={(e) => patchAppearance({ stopAfterLosses: Number(e.target.value || 0) } as any)}
                placeholder="3"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>연패 시 즉시 중단 기준</div>
            </div>

            <div>
              <Label>Overtrade window (minutes)</Label>
              <input
                value={String((appearance as any).overtradeWindowMin ?? 60)}
                onChange={(e) => patchAppearance({ overtradeWindowMin: Number(e.target.value || 0) } as any)}
                placeholder="60"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>기본 60분 (1시간)</div>
            </div>

            <div>
              <Label>Allowed trades in window</Label>
              <input
                value={String((appearance as any).overtradeMaxTrades ?? 2)}
                onChange={(e) => patchAppearance({ overtradeMaxTrades: Number(e.target.value || 0) } as any)}
                placeholder="2"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>2회 초과분부터 카운팅</div>
            </div>

            <div>
              <Label>Max risk % (placeholder)</Label>
              <input
                value={String((appearance as any).maxRiskPct ?? 1)}
                onChange={(e) => patchAppearance({ maxRiskPct: Number(e.target.value || 0) } as any)}
                placeholder="1.0"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>현재는 UI/구조만. 계산은 API 연결 후</div>
            </div>

            <div>
              <Label>Avg loss danger % (placeholder)</Label>
              <input
                value={String((appearance as any).avgLossDangerPct ?? 2)}
                onChange={(e) => patchAppearance({ avgLossDangerPct: Number(e.target.value || 0) } as any)}
                placeholder="2.0"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>현재는 UI/구조만. 계산은 API 연결 후</div>
            </div>
          </div>

          <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
            Save를 누르면 계정에 저장됩니다. 새로고침/다른 기기에서도 동일하게 적용됩니다.
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
              <option value="ivory">Ivory Gallery</option>
              <option value="sandstone">Sandstone Lounge</option>
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
              value={appearance.bgType}
              onChange={(e) => patchAppearance({ bgType: e.target.value as any })}
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
              value={appearance.bgFit}
              onChange={(e) => patchAppearance({ bgFit: e.target.value as any })}
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
              value={appearance.bgOpacity}
              onChange={(e) => patchAppearance({ bgOpacity: Number(e.target.value) })}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Blur(px)</div>
            <input
              type="range"
              min="0"
              max="24"
              step="1"
              value={appearance.bgBlurPx}
              onChange={(e) => patchAppearance({ bgBlurPx: Number(e.target.value) })}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Dim</div>
            <input
              type="range"
              min="0"
              max="0.9"
              step="0.01"
              value={appearance.bgDim}
              onChange={(e) => patchAppearance({ bgDim: Number(e.target.value) })}
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
                  patchAppearance({
                    bgUrl: url,
                    bgType: isVideo ? "video" : "image",
                  });
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
              value={appearance.bgUrl || ""}
              onChange={(e) => patchAppearance({ bgUrl: e.target.value })}
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
