#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true

cd "$HOME/Documents/GitHub/Trading" || exit 1
FILE="app/(app)/settings/page.tsx"
test -f "$FILE" || { echo "ERR: $FILE not found"; exit 1; }

cp "$FILE" "/tmp/settings.page.tsx.bak.bgflat.$(date +%s)"

node <<'NODE'
const fs = require("fs");
const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

// ---- READ bindings: value={appearance.bgX} -> value={(appearance.bg?.x ?? default)}
const rep = (re, to) => { s = s.replace(re, to); };

rep(/value=\{appearance\.bgType\}/g, 'value={((appearance.bg?.type ?? "none") as any)}');
rep(/value=\{appearance\.bgFit\}/g,  'value={((appearance.bg?.fit ?? "cover") as any)}');
rep(/value=\{appearance\.bgUrl\}/g,  'value={(appearance.bg?.url ?? "")}');
rep(/value=\{appearance\.bgOpacity\}/g, 'value={(typeof appearance.bg?.opacity === "number" ? appearance.bg.opacity : 0.25)}');
rep(/value=\{appearance\.bgDim\}/g,     'value={(typeof appearance.bg?.dim === "number" ? appearance.bg.dim : 0.45)}');
rep(/value=\{appearance\.bgBlurPx\}/g,  'value={(typeof appearance.bg?.blurPx === "number" ? appearance.bg.blurPx : 10)}');
rep(/value=\{appearance\.bgEnabled\}/g, 'value={(appearance.bg?.enabled ?? false)}');

// ---- Safety: any remaining direct reads "appearance.bgX" -> expression
rep(/\bappearance\.bgType\b/g,   '(appearance.bg?.type ?? "none")');
rep(/\bappearance\.bgFit\b/g,    '(appearance.bg?.fit ?? "cover")');
rep(/\bappearance\.bgUrl\b/g,    '(appearance.bg?.url ?? "")');
rep(/\bappearance\.bgOpacity\b/g,'(typeof appearance.bg?.opacity === "number" ? appearance.bg.opacity : 0.25)');
rep(/\bappearance\.bgDim\b/g,    '(typeof appearance.bg?.dim === "number" ? appearance.bg.dim : 0.45)');
rep(/\bappearance\.bgBlurPx\b/g, '(typeof appearance.bg?.blurPx === "number" ? appearance.bg.blurPx : 10)');
rep(/\bappearance\.bgEnabled\b/g,'(appearance.bg?.enabled ?? false)');

fs.writeFileSync(file, s, "utf8");
console.log("OK: migrated all flat bg* READS to appearance.bg.*");
NODE

echo "== verify (should show nothing) =="
if command -v rg >/dev/null 2>&1; then
  rg -n "appearance\\.bg(Type|Fit|Url|Opacity|Dim|BlurPx|Enabled)\\b" "$FILE" || true
else
  grep -nE "appearance\\.bg(Type|Fit|Url|Opacity|Dim|BlurPx|Enabled)\\b" "$FILE" || true
fi

echo "== build =="
rm -rf .next >/dev/null 2>&1 || true
npm run build

echo "== commit + deploy =="
git add "$FILE"
git commit -m "fix: migrate remaining flat bg reads to appearance.bg object" || true
git push
vercel --prod

echo "DONE"
