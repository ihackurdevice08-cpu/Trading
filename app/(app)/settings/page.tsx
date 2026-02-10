"use client";

import React, { useMemo, useState } from "react";
import { useAppearance } from "../../../components/providers/AppearanceProvider";
import { THEMES, type ThemeId } from "../../../lib/appearance/themes";
import { supabaseBrowser } from "../../../lib/supabase/browser";

const Field = ({ title, desc, children }: any) => (
  <div style={{ padding: 14, border: "1px solid var(--line-soft)", borderRadius: 14, background: "rgba(34,32,28,0.55)" }}>
    <div style={{ fontWeight: 900 }}>{title}</div>
    <div style={{ color: "var(--text-muted)", marginTop: 6, fontSize: 13 }}>{desc}</div>
    <div style={{ marginTop: 10 }}>{children}</div>
  </div>
);

const Label = ({ children }: any) => (
  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>{children}</div>
);

function RowToggle({ checked, onChange, title, desc }: any) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 10, alignItems: "start", cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3 }}
      />
      <div>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{desc}</div>
      </div>
    </label>
  );
}

export default function SettingsPage() {
  const { appearance, patchAppearance, isAuthed, saveToCloud } = useAppearance();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const themeOptions = useMemo(() => Object.entries(THEMES) as unknown as [string, any][], []);

  async function uploadBackground(file: File) {
    if (!isAuthed) {
      setMsg("배경 업로드는 로그인 후 사용 가능.");
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
      setMsg("업로드 완료. 배경 적용됨.");
    } catch (e: any) {
      setMsg(`업로드 실패: ${e?.message || "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveNow() {
    setBusy(true);
    setMsg("");
    try {
      await saveToCloud();
      setMsg(isAuthed ? "클라우드 저장 완료." : "로컬 저장됨(로그인 시 동기화 가능).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2 }}>Settings</div>
          <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
            취향 옵션은 설명을 보고 천천히 바꾸면 됨. {isAuthed ? "로그인됨(클라우드 저장 가능)" : "로그인 전(로컬만)"}
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
        desc="테마/메뉴 배치/배경을 바꿉니다. 테마와 메뉴 방향은 서로 독립이라, 어떤 테마에서도 가로/세로 메뉴 선택 가능."
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
                Top Bar — 상단 가로 메뉴(호텔/리조트 느낌)
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
                Side Bar — 좌측 세로 메뉴(툴/터미널 느낌)
              </button>
            </div>
          </div>

          <div>
            <Label>Background Type</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { v: "none", d: "None — 가장 가벼움" },
                { v: "image", d: "Image — 사진 배경(정적)" },
                { v: "video", d: "Video — 영상 배경(몰입↑, 리소스↑)" },
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
          </div>

          <div>
            <Label>Upload (Image / Video)</Label>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>
              원본 파일을 그대로 저장하고 화면에는 원본 URL을 그대로 렌더합니다. (cover/contain으로 표시만 조절)
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

          <div>
            <Label>Background Fit</Label>
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
                Cover — 화면 꽉 채움(일부 잘릴 수 있음) [기본]
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
                Contain — 원본 전체 표시(여백 생길 수 있음)
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <Label>Opacity (배경 진하기)</Label>
              <input type="range" min={0} max={1} step={0.01} value={appearance.bgOpacity}
                onChange={(e) => patchAppearance({ bgOpacity: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <Label>Blur (가독성↑)</Label>
              <input type="range" min={0} max={24} step={1} value={appearance.bgBlurPx}
                onChange={(e) => patchAppearance({ bgBlurPx: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <Label>Dim Overlay (눈 편함/가독성↑)</Label>
              <input type="range" min={0} max={1} step={0.01} value={appearance.bgDim}
                onChange={(e) => patchAppearance({ bgDim: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      </Field>

      <Field
        title="Dashboard Layout"
        desc="Dashboard에서 어떤 Row를 항상 보일지 선택합니다. 실전용이라면 4번(Overtrade)만 켜두는 걸 추천."
      >
        <div style={{ display: "grid", gap: 12 }}>
          <RowToggle
            checked={appearance.showRow1Status}
            onChange={(v: boolean) => patchAppearance({ showRow1Status: v })}
            title="Row 1 — Status Strip"
            desc="지금 상태(GREAT/GOOD/SLOW/STOP) + 핵심 요약 지표를 맨 위에 표시."
          />
          <RowToggle
            checked={appearance.showRow2AssetPerf}
            onChange={(v: boolean) => patchAppearance({ showRow2AssetPerf: v })}
            title="Row 2 — Asset & Performance"
            desc="자산 곡선 + 성과 지표(Profit Factor, Avg/Max Win/Loss 등). 리뷰용."
          />
          <RowToggle
            checked={appearance.showRow3Behavior}
            onChange={(v: boolean) => patchAppearance({ showRow3Behavior: v })}
            title="Row 3 — Behavior"
            desc="홀드시간/진입간격/거래빈도/연승연패 등 ‘행동’ 기반 모니터."
          />
          <RowToggle
            checked={appearance.showRow4Overtrade}
            onChange={(v: boolean) => patchAppearance({ showRow4Overtrade: v })}
            title="Row 4 — Overtrade Monitor (기본 ON)"
            desc="최근 1시간 과다거래 감시. 실전 중 가장 중요."
          />

          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            * 변경 후 Save를 누르면(로그인 시) 계정에 저장되어 다른 기기에서도 동일하게 보입니다.
          </div>
        </div>
      </Field>
    </div>
  );
}
