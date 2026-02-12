#!/usr/bin/env bash
set -euo pipefail

FILE="app/(app)/settings/page.tsx"
test -f "$FILE" || { echo "ERROR: $FILE not found"; exit 1; }

node - <<'NODE'
const fs = require("fs");

const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

// 이미 들어갔으면 종료
if (s.includes("Appearance & Atmosphere")) {
  console.log("SKIP: Appearance section already exists");
  process.exit(0);
}

// 1) return ( ... ) 구간 찾기
const r = s.indexOf("return (");
if (r === -1) throw new Error("Cannot find 'return (' in settings page");

// 2) 삽입 위치: 마지막 </Card> 뒤에 넣기 (Settings 페이지가 Card 컴포넌트 기반인 전제)
const lastCardClose = s.lastIndexOf("</Card>");
if (lastCardClose === -1) {
  // Card가 없다면, 그냥 return 블록 끝 직전에 삽입
  // return 블록의 마지막 ');' 위치 찾기
  const endReturn = s.lastIndexOf("\n  );");
  if (endReturn === -1) throw new Error("Cannot find return closing ');' in settings page");

  const insert = `
      {/* =====================================================
          Appearance & Atmosphere (account-bound)
          ===================================================== */}
      <section style={card}>
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
          <label style={field}>
            <div style={label}>Theme</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>공간의 톤을 바꿉니다.</div>
            <select
              value={appearance.themeId}
              onChange={(e) => patchAppearance({ themeId: e.target.value } as any)}
              style={input}
            >
              <option value="linen">Linen Suite</option>
              <option value="resort">Desert Resort</option>
              <option value="noir">Noir Executive</option>
              <option value="ivory">Ivory Gallery</option>
              <option value="sandstone">Sandstone Lounge</option>
            </select>
          </label>

          <label style={field}>
            <div style={label}>Navigation Layout</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>상단/좌측 메뉴</div>
            <select
              value={appearance.navLayout}
              onChange={(e) => patchAppearance({ navLayout: e.target.value } as any)}
              style={input}
            >
              <option value="top">Top (horizontal)</option>
              <option value="side">Side (vertical)</option>
            </select>
          </label>

          <label style={field}>
            <div style={label}>Cover Mode</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>배경 cover/contain</div>
            <select
              value={(appearance.bg?.fit || "cover") as any}
              onChange={(e) => patchAppearance({ bg: { ...(appearance.bg || {}), fit: e.target.value } } as any)}
              style={input}
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
      </section>

`;
  s = s.slice(0, endReturn) + insert + s.slice(endReturn);
  fs.writeFileSync(file, s, "utf8");
  console.log("OK: inserted appearance section (fallback mode, no Card)");
  process.exit(0);
}

// Card 기반이면 마지막 </Card> 바로 뒤에 삽입
const insertPos = lastCardClose + "</Card>".length;

const insert2 = `
      {/* =====================================================
          Appearance & Atmosphere (account-bound)
          ===================================================== */}
      <Card>
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
          <label style={field}>
            <div style={label}>Theme</div>
            <select
              value={appearance.themeId}
              onChange={(e) => patchAppearance({ themeId: e.target.value } as any)}
              style={input}
            >
              <option value="linen">Linen Suite</option>
              <option value="resort">Desert Resort</option>
              <option value="noir">Noir Executive</option>
              <option value="ivory">Ivory Gallery</option>
              <option value="sandstone">Sandstone Lounge</option>
            </select>
          </label>

          <label style={field}>
            <div style={label}>Navigation Layout</div>
            <select
              value={appearance.navLayout}
              onChange={(e) => patchAppearance({ navLayout: e.target.value } as any)}
              style={input}
            >
              <option value="top">Top (horizontal)</option>
              <option value="side">Side (vertical)</option>
            </select>
          </label>

          <label style={field}>
            <div style={label}>Cover Mode</div>
            <select
              value={(appearance.bg?.fit || "cover") as any}
              onChange={(e) => patchAppearance({ bg: { ...(appearance.bg || {}), fit: e.target.value } } as any)}
              style={input}
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

`;

s = s.slice(0, insertPos) + insert2 + s.slice(insertPos);
fs.writeFileSync(file, s, "utf8");
console.log("OK: inserted appearance section after last </Card>");
NODE

npm run build
git add app/(app)/settings/page.tsx
git commit -m "feat: restore appearance controls in settings (anchorless insert)" || true
git push
vercel --prod
