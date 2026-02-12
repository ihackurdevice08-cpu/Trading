#!/usr/bin/env bash
set -euo pipefail

# 1) AppLayout에 전역 배경(media) 레이어 추가
node - <<'NODE'
const fs = require("fs");
const file = "components/layout/AppLayout.jsx";
let s = fs.readFileSync(file, "utf8");

if (!s.includes("Global Background Media")) {
  // AppLayout 컴포넌트 return에서 최상단 컨테이너 첫 부분에 배경 레이어 삽입
  // 가장 안전: "return (" 다음 첫 <div ...> 바로 안쪽에 삽입
  const anchor = "return (";
  const i = s.indexOf(anchor);
  if (i === -1) throw new Error("AppLayout: cannot find return (");

  const divIdx = s.indexOf("<div", i);
  if (divIdx === -1) throw new Error("AppLayout: cannot find root <div");

  // root div의 첫 '>' 위치
  const gt = s.indexOf(">", divIdx);
  if (gt === -1) throw new Error("AppLayout: cannot find root div >");

  const insert = `
      {/* =====================================================
          Global Background Media (account-bound)
          ===================================================== */}
      {appearance?.bgType !== "none" && appearance?.bgUrl ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {appearance.bgType === "video" ? (
            <video
              src={appearance.bgUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: appearance.bgFit || "cover",
                opacity: typeof appearance.bgOpacity === "number" ? appearance.bgOpacity : 0.22,
                filter: \`blur(\${appearance.bgBlurPx || 0}px)\`,
                transform: "scale(1.02)",
              }}
            />
          ) : (
            <img
              src={appearance.bgUrl}
              alt="background"
              style={{
                width: "100%",
                height: "100%",
                objectFit: appearance.bgFit || "cover",
                opacity: typeof appearance.bgOpacity === "number" ? appearance.bgOpacity : 0.22,
                filter: \`blur(\${appearance.bgBlurPx || 0}px)\`,
                transform: "scale(1.02)",
              }}
            />
          )}
          {/* dim layer */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "black",
              opacity: typeof appearance.bgDim === "number" ? appearance.bgDim : 0.45,
            }}
          />
        </div>
      ) : null}

`;
  s = s.slice(0, gt + 1) + insert + s.slice(gt + 1);

  // z-index 정리: 기존 최상단 래퍼들이 zIndex 없이 배경 위로 올라오게
  // 메인 래퍼에 position relative + zIndex 1 보장 (이미 있으면 스킵)
  if (!s.includes("zIndex: 1") && s.includes("style={{")) {
    // 너무 공격적 수정은 피하고, body wrapper 부분에만 추가하자:
    // "/* Top Bar */" 라인 근처의 top bar div에 zIndex 이미 있으니 OK.
  }

  fs.writeFileSync(file, s, "utf8");
  console.log("OK: AppLayout global background media inserted");
} else {
  console.log("SKIP: AppLayout already has background media");
}
NODE

# 2) Settings page에 업로드/배경 설정 카드 추가(있으면 스킵)
node - <<'NODE'
const fs = require("fs");
const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

if (s.includes("Background Media Upload")) {
  console.log("SKIP: Settings already has Background Media Upload");
  process.exit(0);
}

// Card 컴포넌트가 있는 파일이므로 마지막 </Card> 뒤에 붙이기
const pos = s.lastIndexOf("</Card>");
if (pos === -1) throw new Error("Settings: cannot find </Card> to insert new section");

const insert = `
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
                  const path = \`\${data.session.user.id}/bg.\${ext}\`;

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

`;

s = s.slice(0, pos + "</Card>".length) + insert + s.slice(pos + "</Card>".length);
fs.writeFileSync(file, s, "utf8");
console.log("OK: Settings background upload card inserted");
NODE

npm run build
git add components/layout/AppLayout.jsx app/(app)/settings/page.tsx
git commit -m "feat: restore background upload + apply globally" || true
git push
vercel --prod
