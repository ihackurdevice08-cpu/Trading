set -euo pipefail

ROOT="$(pwd)"

echo "== 0) sanity checks =="
test -f "package.json" || (echo "ERROR: run at repo root"; exit 1)

echo "== 1) Patch: app/api/settings/route.ts (cookie-session + appearance persisted) =="

mkdir -p "app/api/settings"
cat > "app/api/settings/route.ts" <<'TS'
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function supabaseFromCookies() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cs) {
          cs.forEach(({ name, value, options }) => {
            store.set(name, value, options);
          });
        },
      },
    }
  );
}

const DEFAULT_SETTINGS = {
  exchange_url: "",
  ddari_url: "",
  spotify_url: "",
  docs_url: "",
  sheets_url: "",
  dashboard_rows: { row1: false, row2: false, row3: false, row4: true },
  overtrade_basis: "CLOSE",
  appearance: {
    themeId: "linen",
    navLayout: "top",
    refreshPlacement: "topbar",
    bg: { enabled: false, url: "", type: "image", fit: "cover", opacity: 0.16 },
  },
};

export async function GET() {
  const sb = await supabaseFromCookies();
  const { data: u } = await sb.auth.getUser();
  const user = u?.user;
  if (!user?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { data: row, error } = await sb
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (!row) {
    const ins = {
      user_id: user.id,
      ...DEFAULT_SETTINGS,
      updated_at: new Date().toISOString(),
    };
    const { data: created, error: cErr } = await sb.from("user_settings").insert(ins).select("*").single();
    if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: created });
  }

  return NextResponse.json({ ok: true, data: row });
}

export async function POST(req: Request) {
  const sb = await supabaseFromCookies();
  const { data: u } = await sb.auth.getUser();
  const user = u?.user;
  if (!user?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // allow partial patch; merge with defaults
  const merged = {
    ...DEFAULT_SETTINGS,
    ...body,
    dashboard_rows: { ...DEFAULT_SETTINGS.dashboard_rows, ...(body?.dashboard_rows || {}) },
    appearance: { ...DEFAULT_SETTINGS.appearance, ...(body?.appearance || {}) },
  };

  const payload = {
    user_id: user.id,
    exchange_url: merged.exchange_url ?? "",
    ddari_url: merged.ddari_url ?? "",
    spotify_url: merged.spotify_url ?? "",
    docs_url: merged.docs_url ?? "",
    sheets_url: merged.sheets_url ?? "",
    dashboard_rows: merged.dashboard_rows,
    overtrade_basis: merged.overtrade_basis ?? "CLOSE",
    appearance: merged.appearance,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await sb
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, note: "Saved. (cookie session)", data: saved });
}
TS

echo "== 2) Patch: components/layout/AppLayout.jsx (logout harden) =="

test -f "components/layout/AppLayout.jsx" || (echo "ERROR: components/layout/AppLayout.jsx not found"; exit 1)

# Replace onLogout implementation to force redirect, and harden buttons as type=button
node - <<'NODE'
const fs = require("fs");
const file = "components/layout/AppLayout.jsx";
let s = fs.readFileSync(file, "utf8");

// ensure router exists usage already
// patch onLogout block (simple but robust)
s = s.replace(/const onLogout\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\};/m, (m) => {
  return `const onLogout = async () => {
    try {
      const sb = supabaseBrowser();
      await sb.auth.signOut();
    } finally {
      // guarantee exit
      router.push("/login");
      router.refresh?.();
    }
  };`;
});

// harden refresh button
s = s.replace(/<button\s+onClick=\{onRefresh\}/g, `<button type="button"\n              onClick={(e)=>{e.preventDefault();e.stopPropagation();onRefresh();}}`);
// harden logout button
s = s.replace(/<button\s+onClick=\{onLogout\}/g, `<button type="button"\n              onClick={(e)=>{e.preventDefault();e.stopPropagation();onLogout();}}`);

fs.writeFileSync(file, s, "utf8");
console.log("OK: AppLayout logout/refresh hardened");
NODE

echo "== 3) Patch: Settings UI (restore Appearance controls + descriptions) =="

test -f "app/(app)/settings/page.tsx" || (echo "ERROR: app/(app)/settings/page.tsx not found"; exit 1)

node - <<'NODE'
const fs = require("fs");
const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

// We assume page already uses `useAppearance()` and `setAppearance` (your current file does).
// Inject a new "Appearance" section if missing.
if (!s.includes("Appearance & Atmosphere")) {
  // Find a stable anchor: after Overtrade Count Basis section header
  const anchor = "Overtrade Count Basis";
  const idx = s.indexOf(anchor);
  if (idx === -1) {
    throw new Error("Anchor not found in settings page. (Overtrade Count Basis)");
  }

  // Insert AFTER the overtrade basis section block end: we’ll inject near the bottom before the final closing main.
  // We find the LAST occurrence of '</main>' and insert right before it.
  const end = s.lastIndexOf("</main>");
  if (end === -1) throw new Error("Cannot find </main> in settings page");

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
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>공간의 톤을 바꿉니다. (예: 리조트 라운지 / 스위트 룸)</div>
            <select
              value={appearance.themeId}
              onChange={(e) => setAppearance({ ...appearance, themeId: e.target.value })}
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
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>상단 가로 메뉴 / 좌측 세로 메뉴를 선택합니다.</div>
            <select
              value={appearance.navLayout}
              onChange={(e) => setAppearance({ ...appearance, navLayout: e.target.value as any })}
              style={input}
            >
              <option value="top">Top (horizontal)</option>
              <option value="side">Side (vertical)</option>
            </select>
          </label>

          <label style={field}>
            <div style={label}>Refresh Button Placement</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>Refresh 버튼을 상단 또는 하단에 둡니다.</div>
            <select
              value={appearance.refreshPlacement}
              onChange={(e) => setAppearance({ ...appearance, refreshPlacement: e.target.value as any })}
              style={input}
            >
              <option value="topbar">Top bar</option>
              <option value="footer">Bottom</option>
            </select>
          </label>

          <label style={field}>
            <div style={label}>Cover Mode</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>배경을 꽉 채우거나(cover) 원본 비율을 지킵니다(contain).</div>
            <select
              value={appearance.bg?.fit || "cover"}
              onChange={(e) => setAppearance({ ...appearance, bg: { ...(appearance.bg || {}), fit: e.target.value as any } })}
              style={input}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>
        </div>

        <div style={{ height: 14 }} />

        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!appearance.bg?.enabled}
              onChange={(e) => setAppearance({ ...appearance, bg: { ...(appearance.bg || {}), enabled: e.target.checked } })}
            />
            <div>
              <div style={{ fontWeight: 900 }}>Background media</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
                원하는 이미지/영상으로 공간을 꾸밉니다. (계정 귀속)
              </div>
            </div>
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;

                try {
                  setMsg("Uploading background…");
                  const sb = supabaseBrowser();
                  const { data: u } = await sb.auth.getUser();
                  const userId = u?.user?.id;
                  if (!userId) throw new Error("Not logged in");

                  // bucket name (create in Supabase Storage): mancave-media
                  const BUCKET = "mancave-media";
                  const ext = (f.name.split(".").pop() || "bin").toLowerCase();
                  const type = f.type.startsWith("video") ? "video" : "image";
                  const key = \`\${userId}/bg/\${Date.now()}.\${ext}\`;

                  const up = await sb.storage.from(BUCKET).upload(key, f, { upsert: true, contentType: f.type });
                  if (up.error) throw up.error;

                  const pub = sb.storage.from(BUCKET).getPublicUrl(key);
                  const url = pub?.data?.publicUrl || "";

                  setAppearance({
                    ...appearance,
                    bg: { ...(appearance.bg || {}), enabled: true, url, type, fit: appearance.bg?.fit || "cover", opacity: appearance.bg?.opacity ?? 0.16 },
                  });

                  setMsg("Background uploaded. Please press Save.");
                } catch (err: any) {
                  console.error(err);
                  setMsg(\`Upload failed: \${err?.message || err}\`);
                }
              }}
            />

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Opacity</div>
              <input
                type="range"
                min="0"
                max="0.4"
                step="0.01"
                value={Number(appearance.bg?.opacity ?? 0.16)}
                onChange={(e) => setAppearance({ ...appearance, bg: { ...(appearance.bg || {}), opacity: Number(e.target.value) } })}
              />
              <div style={{ width: 54, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {Number(appearance.bg?.opacity ?? 0.16).toFixed(2)}
              </div>
            </label>

            <button
              type="button"
              onClick={() => setAppearance({ ...appearance, bg: { ...(appearance.bg || {}), enabled: false, url: "" } })}
              style={{ ...btn, border: "1px solid var(--line-soft)", background: "transparent" }}
            >
              Disable
            </button>
          </div>

          {appearance.bg?.url ? (
            <div style={{ color: "rgba(0,0,0,0.55)", fontSize: 12 }}>
              Current media: <span style={{ wordBreak: "break-all" }}>{appearance.bg.url}</span>
            </div>
          ) : null}
        </div>
      </section>
`;

  s = s.slice(0, end) + insert + "\n" + s.slice(end);
  fs.writeFileSync(file, s, "utf8");
  console.log("OK: Settings appearance section injected");
} else {
  console.log("SKIP: Appearance section already exists");
}
NODE

echo "== 4) Build & deploy =="
npm run build

git add app/api/settings/route.ts components/layout/AppLayout.jsx "app/(app)/settings/page.tsx"
git commit -m "feat: restore account-bound appearance controls + fix logout + cookie settings api" || true
git push
vercel --prod

echo ""
echo "DONE."
echo ""
echo "NOTE: Supabase Storage에 bucket 'mancave-media' 를 만들어야 배경 업로드가 동작합니다."
echo "Supabase Dashboard → Storage → New bucket → name: mancave-media → Public ON 권장(간단) / 또는 Signed URL 방식으로 확장 가능."
