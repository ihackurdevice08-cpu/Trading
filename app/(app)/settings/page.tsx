"use client";

import { useState } from "react";
import { useAppearance } from "../../../components/providers/AppearanceProvider";

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

  function apiComingSoon() {
    fetch("/api/sync-now", { method: "POST" })
      .then((r) => r.json())
      .then((res) => alert(res?.note || "Sync requested"))
      .catch(() => alert("Sync failed"));
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
          onClick={apiComingSoon}
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

      <Card title="Background (Image / Video)" desc="개인 이미지를 라운지 배경으로 사용합니다. 원본 비율은 Fit에서 조정합니다.">
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <Label>Type</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => patchAppearance({ bgType: "none" as any, bgUrl: "" })}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: appearance.bgType === "none" ? "rgba(210,194,165,0.14)" : "transparent",
                  color: "var(--text-primary)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                None
              </button>
              <button
                onClick={() => patchAppearance({ bgType: "image" as any })}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: appearance.bgType === "image" ? "rgba(210,194,165,0.14)" : "transparent",
                  color: "var(--text-primary)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Image
              </button>
              <button
                onClick={() => patchAppearance({ bgType: "video" as any })}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: appearance.bgType === "video" ? "rgba(210,194,165,0.14)" : "transparent",
                  color: "var(--text-primary)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Video
              </button>
            </div>
          </div>

          <div>
            <Label>URL</Label>
            <input
              value={appearance.bgUrl || ""}
              onChange={(e) => patchAppearance({ bgUrl: e.target.value })}
              placeholder="https://... (Storage 업로드 연결은 다음 단계)"
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
            <Label>Fit</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => patchAppearance({ bgFit: "cover" as any })}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: appearance.bgFit === "cover" ? "rgba(210,194,165,0.14)" : "transparent",
                  color: "var(--text-primary)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cover
              </button>
              <button
                onClick={() => patchAppearance({ bgFit: "contain" as any })}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: appearance.bgFit === "contain" ? "rgba(210,194,165,0.14)" : "transparent",
                  color: "var(--text-primary)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Contain
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <Label>Opacity (배경 진하기)</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={appearance.bgOpacity}
                onChange={(e) => patchAppearance({ bgOpacity: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <Label>Blur (가독성↑)</Label>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                value={appearance.bgBlurPx}
                onChange={(e) => patchAppearance({ bgBlurPx: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <Label>Dim Overlay (눈 편함/가독성↑)</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={appearance.bgDim}
                onChange={(e) => patchAppearance({ bgDim: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Dashboard Rows" desc="대시보드에 표시할 Row를 선택합니다. 기본은 Row4 ON 입니다.">
        <div style={{ display: "grid", gap: 10 }}>
          <RowToggle
            checked={appearance.showRow1Status}
            onChange={(v) => patchAppearance({ showRow1Status: v })}
            title="Row 1 — Status (Great / Good / Slow down / Stop)"
            desc="상태등(행동/리스크 신호 기반) — 트레이딩 중 리마인더."
          />
          <RowToggle
            checked={appearance.showRow2AssetPerf}
            onChange={(v) => patchAppearance({ showRow2AssetPerf: v })}
            title="Row 2 — Asset & Performance"
            desc="자산 곡선 + 성과 지표(Profit Factor, Avg/Max Win/Loss 등)."
          />
          <RowToggle
            checked={appearance.showRow3Behavior}
            onChange={(v) => patchAppearance({ showRow3Behavior: v })}
            title="Row 3 — Behavior"
            desc="홀드시간/진입간격/거래빈도/연승연패 등 ‘행동’ 모니터."
          />
          <RowToggle
            checked={appearance.showRow4Overtrade}
            onChange={(v) => patchAppearance({ showRow4Overtrade: v })}
            title="Row 4 — Overtrade Monitor (기본 ON)"
            desc="최근 1시간 과다거래 감시. 기준은 아래 옵션으로 바뀝니다."
          />

          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            * 변경 후 Save를 누르면(로그인 시) 계정에 저장되어 다른 기기에서도 동일하게 보입니다.
          </div>
        </div>
      </Card>

      <Card title="Overtrade Count Basis" desc="과다거래 카운트 기준을 선택합니다. 기본은 CLOSE 기준입니다.">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => patchAppearance({ overtradeCountBasis: "close" as any })}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-soft)",
              background: appearance.overtradeCountBasis === "close" ? "rgba(210,194,165,0.14)" : "transparent",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            CLOSE 기준(기본)
          </button>

          <button
            onClick={() => patchAppearance({ overtradeCountBasis: "open" as any })}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-soft)",
              background: appearance.overtradeCountBasis === "open" ? "rgba(210,194,165,0.14)" : "transparent",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            OPEN 기준
          </button>
        </div>
      </Card>

      <Card title="Refresh Placement" desc="우측 상단에 Refresh를 둘지(글로벌), 대시보드에 둘지 선택합니다.">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => patchAppearance({ refreshPlacement: "global" as any })}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-soft)",
              background: appearance.refreshPlacement === "global" ? "rgba(210,194,165,0.14)" : "transparent",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Global (우측 상단)
          </button>

          <button
            onClick={() => patchAppearance({ refreshPlacement: "dashboard" as any })}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line-soft)",
              background: appearance.refreshPlacement === "dashboard" ? "rgba(210,194,165,0.14)" : "transparent",
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
