"use client";

import React, { useMemo, useState } from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { THEMES } from "@/lib/appearance/themes";
import { supabaseBrowser } from "@/lib/supabase/browser";

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--line-soft)", borderRadius: 18, background: "var(--panel)", padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
      {desc ? <div style={{ color: "var(--text-muted)", marginTop: 6, lineHeight: 1.55 }}>{desc}</div> : null}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

export default function SettingsPage() {

  /*__CORE_SETTINGS_RESTORED__*/
  // =========================
  // Core Settings (account-bound)
  // =========================
  const [core, setCore] = React.useState({
    exchange_url: "",
    ddari_url: "",
    spotify_url: "",
    docs_url: "",
    sheets_url: "",
    checklistText: "1H/4H 존 확인\n리스크% 확인\n진입 근거 2개 이상",
    emergencySteps: "",
    emergencyQuotes: "",
  });

  const loadCore = React.useCallback(async () => {
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const j = await r.json();
      if (!j?.ok) return;
      const d = j.data || {};
      const checklist = Array.isArray(d.checklist) ? d.checklist : [];
      const emergency = d.emergency || {};
      const steps = Array.isArray(emergency.steps) ? emergency.steps : [];
      const quotes = Array.isArray(emergency.quotes) ? emergency.quotes : [];

      setCore((p) => ({
        ...p,
        exchange_url: d.exchange_url || "",
        ddari_url: d.ddari_url || "",
        spotify_url: d.spotify_url || "",
        docs_url: d.docs_url || "",
        sheets_url: d.sheets_url || "",
        checklistText: checklist.length ? checklist.join("\n") : p.checklistText,
        emergencySteps: steps.join("\n"),
        emergencyQuotes: quotes.join("\n"),
      }));
    } catch {}
  }, []);

  const saveCore = React.useCallback(async () => {
    setMsg("Saving…");
    try {
      const checklist = core.checklistText.split("\n").map((x) => x.trim()).filter(Boolean);
      const steps = core.emergencySteps.split("\n").map((x) => x.trim()).filter(Boolean);
      const quotes = core.emergencyQuotes.split("\n").map((x) => x.trim()).filter(Boolean);

      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exchange_url: core.exchange_url,
          ddari_url: core.ddari_url,
          spotify_url: core.spotify_url,
          docs_url: core.docs_url,
          sheets_url: core.sheets_url,
          checklist,
          emergency: { steps, quotes },
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "request error");
      setMsg("Saved. (account-bound)");
    } catch (e) {
      setMsg(`Save failed: ${e?.message || e}`);
    }
  }, [core]);

  React.useEffect(() => {
    loadCore();
  }, [loadCore]);



  const { appearance, patchAppearance, patchBg, isAuthed, saveToCloud } = useAppearance();
  const [msg, setMsg] = useState<string>("");

  const field = useMemo(
    () => ({
      display: "grid",
      gap: 6,
      padding: 12,
      borderRadius: 16,
      border: "1px solid var(--line-soft)",
      background: "var(--panel2)",
    }),
    []
  );

  const label = useMemo(() => ({ fontWeight: 900, fontSize: 13, color: "var(--text-muted)" }), []);
  const input = useMemo(
    () => ({
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid var(--line-hard)",
      background: "rgba(255,255,255,0.78)",
      color: "rgba(0,0,0,0.88)",
      fontWeight: 900,
      outline: "none",
    }),
    []
  );

  const saveNow = async () => {
    try {
      setMsg("저장 중…");
      await saveToCloud();
      setMsg("저장 완료. (계정에 귀속)");
    } catch (e: any) {
      setMsg(`저장 실패: ${e?.message || e}`);
    }
  };

  const uploadMedia = async (file: File) => {
    try {
      setMsg("업로드 중…");
      const sb = supabaseBrowser();
      const { data: sess } = await sb.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        setMsg("로그인이 필요합니다.");
        return;
      }

      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const isVideo = file.type.startsWith("video/");
      const type = isVideo ? "video" : "image";

      const path = `${uid}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext || (isVideo ? "mp4" : "jpg")}`;

      const { error: upErr } = await sb.storage.from("mancave-media").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      const { data: pub } = sb.storage.from("mancave-media").getPublicUrl(path);
      const url = pub.publicUrl;

      patchBg({ enabled: true, type: type as any, url });
      setMsg("업로드 완료. 저장 중…");
      await saveToCloud();
      setMsg("적용 완료. (계정에 귀속)");
    } catch (e: any) {
      setMsg(`업로드 실패: ${e?.message || e}`);
    }
  };

  const deleteMedia = async () => {
    try {
      setMsg("배경 제거 중…");
      patchBg({ type: "none" as any, url: null });
      await saveToCloud();
      setMsg("배경 제거 완료.");
    } catch (e: any) {
      setMsg(`배경 제거 실패: ${e?.message || e}`);
    }
  };

  const koThemeDesc = "테마/배경/레이아웃 등 취향 설정은 로그인한 계정에 귀속됩니다. 다른 기기에서 로그인해도 그대로 유지됩니다.";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2 }}>설정</div>
          <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
            필요한 것만 천천히 조정하시면 됩니다. {isAuthed ? "현재 계정에 연결되어 있습니다." : "로그인 전입니다."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={saveNow} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(210,194,165,0.14)", fontWeight: 900 }}>
            저장
          </button>
        </div>
      </div>

      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{msg || " "}</div>

      
      <Card title="핵심 설정 (계정 귀속)" desc="모든 설정은 기기/브라우저가 아니라 로그인한 계정에 저장됩니다. 다른 기기에서 로그인해도 그대로 유지됩니다.">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>거래소 URL</div>
              <input value={core.exchange_url} onChange={(e)=>setCore(p=>({ ...p, exchange_url: e.target.value }))} style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:900, outline:"none" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>따리 URL</div>
              <input value={core.ddari_url} onChange={(e)=>setCore(p=>({ ...p, ddari_url: e.target.value }))} style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:900, outline:"none" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Spotify URL</div>
              <input value={core.spotify_url} onChange={(e)=>setCore(p=>({ ...p, spotify_url: e.target.value }))} style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:900, outline:"none" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Google Docs URL</div>
              <input value={core.docs_url} onChange={(e)=>setCore(p=>({ ...p, docs_url: e.target.value }))} style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:900, outline:"none" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Google Sheets URL</div>
              <input value={core.sheets_url} onChange={(e)=>setCore(p=>({ ...p, sheets_url: e.target.value }))} style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:900, outline:"none" }} />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Trade Gate 체크리스트 (줄바꿈=항목)</div>
            <textarea value={core.checklistText} onChange={(e)=>setCore(p=>({ ...p, checklistText: e.target.value }))} style={{ minHeight: 110, padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:700, outline:"none", resize:"vertical" }} />
          </label>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>비상버튼 프로토콜 Steps (줄바꿈)</div>
              <textarea value={core.emergencySteps} onChange={(e)=>setCore(p=>({ ...p, emergencySteps: e.target.value }))} style={{ minHeight: 110, padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:700, outline:"none", resize:"vertical" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>비상버튼 Quotes (줄바꿈)</div>
              <textarea value={core.emergencyQuotes} onChange={(e)=>setCore(p=>({ ...p, emergencyQuotes: e.target.value }))} style={{ minHeight: 110, padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:700, outline:"none", resize:"vertical" }} />
            </label>
          </div>

          <div style={{ display:"flex", gap: 10, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
            <button type="button" onClick={saveCore} style={{ padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-soft)", background:"rgba(210,194,165,0.14)", fontWeight:900 }}>
              Core 설정 저장
            </button>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              {msg || " "}
            </div>
          </div>
        </div>
      </Card>

<Card title="Appearance & Atmosphere" desc={koThemeDesc}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <label style={field}>
            <div style={label}>테마</div>
            <select
              value={appearance.themeId}
              onChange={(e) => patchAppearance({ themeId: e.target.value as any })}
              style={input as any}
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              {THEMES.find((t) => t.id === appearance.themeId)?.desc || ""}
            </div>
          </label>

          <label style={field}>
            <div style={label}>네비게이션 레이아웃</div>
            <select
              value={appearance.navLayout}
              onChange={(e) => patchAppearance({ navLayout: e.target.value as any })}
              style={input as any}
            >
              <option value="top">Top (가로)</option>
              <option value="side">Side (세로)</option>
            </select>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              상단 가로/좌측 세로 메뉴를 선택합니다.
            </div>
          </label>

          <label style={field}>
            <div style={label}>커버 모드</div>
            <select
              value={(appearance.bg?.fit || "cover") as any}
              onChange={(e) => patchBg({ fit: e.target.value as any })}
              style={input as any}
            >
              <option value="cover">Cover (화면 채움)</option>
              <option value="contain">Contain (원본 비율 유지)</option>
            </select>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              원본 그대로 보이게 하려면 Contain 을 권장합니다.
            </div>
          </label>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={field}>
              <div style={label}>불투명도(Opacity)</div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={appearance.bg.opacity}
                onChange={(e) => patchBg({ opacity: Number(e.target.value) })}
              />
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{appearance.bg.opacity.toFixed(2)}</div>
            </label>

            <label style={field}>
              <div style={label}>Dim (어둡게)</div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={appearance.bg.dim}
                onChange={(e) => patchBg({ dim: Number(e.target.value) })}
              />
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{appearance.bg.dim.toFixed(2)}</div>
            </label>

            <label style={field}>
              <div style={label}>Blur (흐림)</div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={appearance.bg.blurPx}
                onChange={(e) => patchBg({ blurPx: Number(e.target.value) })}
              />
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{appearance.bg.blurPx}px</div>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "inline-flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
              <input
                type="checkbox"
                checked={appearance.bg.enabled}
                onChange={(e) => patchBg({ enabled: e.target.checked })}
              />
              배경 활성화
            </label>

            <div style={{ flex: 1 }} />

            <button
              type="button"
              onClick={deleteMedia}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "transparent",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              배경 제거
            </button>

            <label
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "rgba(210,194,165,0.14)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              배경 업로드 (이미지/영상)
              <input
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMedia(f);
                }}
              />
            </label>
          </div>

          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
            업로드는 Supabase Storage bucket <b>mancave-media</b> 가 필요합니다. (아래 SQL을 실행하면 됩니다)
          </div>
        </div>
      </Card>
    </div>
  );
}
