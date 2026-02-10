"use client";

import React, { useMemo, useState } from "react";
import { useAppearance } from "../../../components/providers/AppearanceProvider";
import { THEMES, type ThemeId } from "../../../lib/appearance/themes";
import { supabaseBrowser } from "../../../lib/supabase/browser";

const Field = ({ title, desc, children }: any) => (
  <div style={{ padding: 14, border: "1px solid var(--line-soft)", borderRadius: 14, background: "rgba(34,32,28,0.55)" }}>
    <div style={{ fontWeight: 900 }}>{title}</div>
    <div style={{ color: "var(--text-muted)", marginTop: 6, fontSize: 13 }}>{desc}</div>
    <div style={{ marginTop: 12 }}>{children}</div>
  </div>
);

const Label = ({ children }: any) => (
  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>{children}</div>
);

function RowToggle({ checked, onChange, title, desc }: any) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 10, alignItems: "start", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
      <div>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{desc}</div>
      </div>
    </label>
  );
}

function Pill({ children }: any) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, border: "1px solid var(--line-soft)", color: "var(--text-secondary)", fontSize: 12 }}>
      {children}
    </span>
  );
}

export default function SettingsPage() {
  const { appearance, patchAppearance, isAuthed, saveToCloud } = useAppearance();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // API 연결(현재 UI만; 백엔드는 다음 덩어리 패치에서)
  const [alias, setAlias] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const themeOptions = useMemo(() => Object.entries(THEMES) as unknown as [string, any][], []);

  async function uploadBackground(file: File) {
    if (!isAuthed) {
      setMsg("배경 업로드는 로그인 후 이용 가능합니다.");
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) throw new Error("No session");

      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `backgrounds/${uid}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

      const { error } = await sb.storage.from("user-media").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || undefined,
      });
      if (error) throw error;

      const { data: pub } = sb.storage.from("user-media").getPublicUrl(path);
      const url = pub.publicUrl;

      const isVideo = file.type.startsWith("video/");
      patchAppearance({ bgType: isVideo ? "video" : "image", bgUrl: url });

      await saveToCloud();
      setMsg("배경이 준비되었습니다. 원하시면 Fit/Dim/Blur로 가독성을 조정해 주세요.");
    } catch (e: any) {
      setMsg(`업로드에 문제가 있었습니다: ${e?.message || "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveNow() {
    setBusy(true);
    setMsg("");
    try {
      await saveToCloud();
      setMsg(isAuthed ? "설정이 계정에 반영되었습니다." : "설정이 기기에 저장되었습니다. 로그인 후 계정에 동기화할 수 있습니다.");
    } finally {
      setBusy(false);
    }
  }

  function apiComingSoon() {
    setMsg("API 연결(암호화 저장/즉시 동기화)은 다음 단계에서 한 번에 적용됩니다. 지금은 화면 구조만 준비해두었습니다.");
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2 }}>Settings</div>
          <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
            필요한 것만 천천히 조정하시면 됩니다. {isAuthed ? "현재 계정에 연결되어 있습니다." : "로그인 전입니다."}
          </div>
        </div>

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
          Save
        </button>
      </div>

      {msg ? (
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", color: "var(--text-secondary)" }}>
          {msg}
        </div>
      ) : null}

      <Field
        title="Appearance"
        desc="공간의 분위기를 선택합니다. 테마/메뉴 방향/배경은 서로 독립이므로, 원하는 조합으로 맞추셔도 됩니다."
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <Label>Theme</Label>
            <select
              value={appearance.themeId}
              onChange={(e) => patchAppearance({ themeId: Number(e.target.value) as ThemeId })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "var(--bg-panel)",
                color: "var(--text-primary)",
              }}
            >
              {themeOptions.map(([id, t]) => (
                <option key={id} value={id}>
                  {id}. {t.name} — {t.desc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Navigation Layout</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => patchAppearance({ navLayout: "top" })}
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
                Top Bar — 상단 가로 메뉴
              </button>
              <button
                onClick={() => patchAppearance({ navLayout: "side" })}
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
                Side Bar — 좌측 세로 메뉴
              </button>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>기본값: Top Bar</Pill>
              <Pill>언제든 변경 가능</Pill>
            </div>
          </div>

          <div>
            <Label>Background</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { v: "none", d: "None — 가장 담백하게" },
                { v: "image", d: "Image — 사진으로 분위기" },
                { v: "video", d: "Video — 영상으로 몰입" },
              ].map((x) => (
                <button
                  key={x.v}
                  onClick={() => patchAppearance({ bgType: x.v as any })}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--line-soft)",
                    background: appearance.bgType === x.v ? "rgba(210,194,165,0.14)" : "transparent",
                    color: "var(--text-primary)",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {x.d}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 10 }}>
              <Label>Upload (Image / Video)</Label>
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>
                원본 파일은 그대로 보관하고, 화면에는 원본을 표시합니다. (표시 방식은 Fit에서 조정)
              </div>
              <input
                type="file"
                accept="image/*,video/*"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadBackground(f);
                }}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <Label>Fit</Label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => patchAppearance({ bgFit: "cover" })}
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
                  Cover — 화면에 맞춤(일부 잘림 가능) [기본]
                </button>
                <button
                  onClick={() => patchAppearance({ bgFit: "contain" })}
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
                  Contain — 원본 전체(여백 가능)
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div>
                <Label>Opacity</Label>
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
                <Label>Blur</Label>
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
                <Label>Dim</Label>
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
        </div>
      </Field>

      <Field
        title="Dashboard Layout"
        desc="대시보드에 어떤 Row를 상시 노출할지 선택합니다. 실전이라면 4번(Overtrade)만 켜두셔도 충분합니다."
      >
        <div style={{ display: "grid", gap: 12 }}>
          <RowToggle
            checked={appearance.showRow1Status}
            onChange={(v: boolean) => patchAppearance({ showRow1Status: v })}
            title="Row 1 — Status Strip"
            desc="GREAT/GOOD/SLOW/STOP 상태와 핵심 사유를 상단에 담백하게 표시합니다."
          />
          <RowToggle
            checked={appearance.showRow2AssetPerf}
            onChange={(v: boolean) => patchAppearance({ showRow2AssetPerf: v })}
            title="Row 2 — Asset & Performance"
            desc="자산 곡선과 성과 지표를 정리합니다(리뷰 중심)."
          />
          <RowToggle
            checked={appearance.showRow3Behavior}
            onChange={(v: boolean) => patchAppearance({ showRow3Behavior: v })}
            title="Row 3 — Behavior"
            desc="홀드 시간/진입 간격/거래 빈도 등 행동 지표를 모니터합니다."
          />
          <RowToggle
            checked={appearance.showRow4Overtrade}
            onChange={(v: boolean) => patchAppearance({ showRow4Overtrade: v })}
            title="Row 4 — Overtrade Monitor (기본 ON)"
            desc="최근 1시간 과다거래를 감시합니다(실전 핵심)."
          />

          <div style={{ paddingTop: 10, borderTop: "1px solid var(--line-soft)" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Overtrade Count Basis</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>
              과다거래 카운트를 ‘청산(CLOSE)’ 기준으로 셀지, ‘진입(OPEN)’ 기준으로 셀지 선택합니다. 기본은 CLOSE입니다.
            </div>

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
          </div>

          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            * 로그인 상태에서는 변경 사항이 계정에 반영되어 다른 기기에서도 동일하게 유지됩니다.
          </div>
        </div>
      </Field>

      <Field
        title="API 연결"
        desc="완전한 기능 활용을 위해 거래소 API 연결이 필요합니다. 현재는 Bitget만 지원합니다. (추후 확장)"
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>현재 지원: Bitget</Pill>
            <Pill>여러 계정 연결 가능</Pill>
            <Pill>Alias는 직접 입력</Pill>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Label>Alias</Label>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="예: Main / Sub / Prop"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "var(--bg-panel)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>
                이 이름은 화면과 보고서에 표시됩니다. 짧고 분명하게 추천드립니다.
              </div>
            </div>

            <div>
              <Label>Exchange</Label>
              <input
                value="Bitget"
                readOnly
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.12)",
                  color: "var(--text-secondary)",
                }}
              />
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>
                현재는 Bitget만 제공됩니다. 다음 단계에서 타 거래소를 순차적으로 확장합니다.
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <Label>API Key</Label>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "var(--bg-panel)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div>
              <Label>Secret Key</Label>
              <input
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "var(--bg-panel)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div>
              <Label>Passphrase</Label>
              <input
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "var(--bg-panel)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>
                키는 서버에서 암호화되어 보관되며, 화면에는 노출되지 않도록 설계합니다.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={apiComingSoon}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "rgba(210,194,165,0.12)",
                color: "var(--text-primary)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              저장 후 즉시 동기화 (준비중)
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
              Refresh (수동 동기화, 준비중)
            </button>

            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              * 실제 연결/동기화는 다음 단계에서 한 번에 적용됩니다.
            </div>
          </div>
        </div>
      </Field>
    </div>
  );
}
