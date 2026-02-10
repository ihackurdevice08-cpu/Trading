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
  const [msg, setMsg] = useState("");

  // Bitget API form
  const [alias, setAlias] = useState("Main");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [apiBusy, setApiBusy] = useState(false);

  async function saveNow() {
    setBusy(true);
    setMsg("");
    try {
      await saveToCloud();
      setMsg(isAuthed ? "설정이 계정에 반영되었습니다." : "설정이 기기에 저장되었습니다. 로그인 후 계정에 동기화할 수 있습니다.");
    } catch {
      setMsg("저장 중 문제가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function manualSync() {
    try {
      const res = await fetch("/api/sync-now", { method: "POST" });
      const j = await res.json();
      alert(j?.note || "Sync requested");
    } catch {
      alert("Sync failed");
    }
  }

  async function saveBitgetAccount() {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getUser();
    const user_id = data?.user?.id;
    if (!user_id) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!alias || !apiKey || !apiSecret || !passphrase) {
      alert("Alias / API Key / Secret / Passphrase를 모두 입력하세요.");
      return;
    }

    setApiBusy(true);
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
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "save failed");

      // 저장 즉시 동기화(요구사항)
      await manualSync();

      // 입력칸 정리(선택)
      setApiKey("");
      setApiSecret("");
      setPassphrase("");

      alert("Bitget 계정이 등록되었습니다.");
    } catch (e: any) {
      alert(e?.message || "저장 실패");
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
          onClick={saveNow}
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
          onClick={manualSync}
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

      <Card
        title="Bitget API 연결"
        desc="현재는 Bitget만 지원합니다. 계정(여러 개) 등록이 가능하며, 등록 즉시 동기화를 시작합니다."
      >
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
            onClick={saveBitgetAccount}
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

      <Card title="Navigation Layout" desc="메뉴 위치를 바꿉니다. 기본은 상단(Top)입니다.">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => patchAppearance({ navLayout: "top" as any })}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-soft)",
              background: appearance.navLayout === "top" ? "rgba(210,194,165,0.14)" : "transparent",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Top
          </button>
          <button
            onClick={() => patchAppearance({ navLayout: "side" as any })}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-soft)",
              background: appearance.navLayout === "side" ? "rgba(210,194,165,0.14)" : "transparent",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Side
          </button>
        </div>
      </Card>

      <Card title="Dashboard Rows" desc="대시보드에 표시할 Row를 선택합니다. 기본은 Row4 ON 입니다.">
        <div style={{ display: "grid", gap: 10 }}>
          <RowToggle
            checked={(appearance as any).showRow1Status}
            onChange={(v) => patchAppearance({ showRow1Status: v } as any)}
            title="Row 1 — Status (Great / Good / Slow down / Stop)"
            desc="상태등(행동/리스크 신호 기반) — 트레이딩 중 리마인더."
          />
          <RowToggle
            checked={(appearance as any).showRow2AssetPerf}
            onChange={(v) => patchAppearance({ showRow2AssetPerf: v } as any)}
            title="Row 2 — Asset & Performance"
            desc="자산 곡선 + 성과 지표(Profit Factor, Avg/Max Win/Loss 등)."
          />
          <RowToggle
            checked={(appearance as any).showRow3Behavior}
            onChange={(v) => patchAppearance({ showRow3Behavior: v } as any)}
            title="Row 3 — Behavior"
            desc="홀드시간/진입간격/거래빈도/연승연패 등 ‘행동’ 모니터."
          />
          <RowToggle
            checked={(appearance as any).showRow4Overtrade}
            onChange={(v) => patchAppearance({ showRow4Overtrade: v } as any)}
            title="Row 4 — Overtrade Monitor (기본 ON)"
            desc="최근 1시간 과다거래 감시. 기준은 옵션으로 바뀝니다."
          />
        </div>
      </Card>

      <Card title="Overtrade Count Basis" desc="과다거래 카운트 기준을 선택합니다. 기본은 CLOSE 기준입니다.">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
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
            CLOSE 기준(기본)
          </button>

          <button
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
            OPEN 기준
          </button>
        </div>
      </Card>

      <Card title="Refresh Placement" desc="Refresh 버튼 위치를 선택합니다. 기본은 우측 상단(글로벌)입니다.">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => patchAppearance({ refreshPlacement: "global" as any } as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-soft)",
              background: (appearance as any).refreshPlacement === "global" ? "rgba(210,194,165,0.14)" : "transparent",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Global (우측 상단)
          </button>

          <button
            onClick={() => patchAppearance({ refreshPlacement: "dashboard" as any } as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-soft)",
              background: (appearance as any).refreshPlacement === "dashboard" ? "rgba(210,194,165,0.14)" : "transparent",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Dashboard
          </button>
        </div>
      </Card>
    </div>
  );
}
