"use client";

import { useState } from "react";
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
  const { appearance, patchAppearance, isAuthed, saveToCloud } = useAppearance();
  const [busy, setBusy] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Bitget API form
  const [alias, setAlias] = useState("Main");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  async function saveNow() {
    setBusy(true);
    setMsg("Saving…");
    try {
      await saveToCloud();
      setMsg("Saved. (계정 동기화 완료)");
    } catch (e: any) {
      setMsg(`Save failed: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  async function manualSync() {
    setMsg("Syncing…");
    try {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getSession();
      const accessToken = data?.session?.access_token;

      const res = await fetch("/api/sync-now", {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });

      const text = await res.text();
      let j: any = null;
      try { j = JSON.parse(text); } catch {}

      if (!res.ok) {
        setMsg(`Sync failed (${res.status}): ${j?.error || text}`);
        return;
      }
      setMsg(j?.note || "Sync requested");
    } catch (e: any) {
      setMsg(`Sync failed: ${e?.message || "unknown error"}`);
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

      // 저장 즉시 동기화
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
        <button type="button"
          onClick={(e)=>{e.preventDefault();e.stopPropagation();saveNow();}}
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

        <button type="button"
          onClick={(e)=>{e.preventDefault();e.stopPropagation();manualSync();}}
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

          <button type="button"
            onClick={(e)=>{e.preventDefault();e.stopPropagation();saveBitgetAccount();}}
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
          <button type="button"
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
          <button type="button"
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
    </div>
  );
}
