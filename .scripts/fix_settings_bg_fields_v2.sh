#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true

cd "$HOME/Documents/GitHub/Trading" || exit 1

FILE="app/(app)/settings/page.tsx"
test -f "$FILE" || { echo "ERR: $FILE not found"; exit 1; }

cp "$FILE" "/tmp/settings.page.tsx.bak.$(date +%s)"

node <<'NODE'
const fs = require("fs");
const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

// READ: appearance.bgType -> (appearance.bg?.type ?? "none")  (문자열로 치환!)
const readMap = [
  [/\\bappearance\\.bgType\\b/g,   '(appearance.bg?.type ?? "none")'],
  [/\\bappearance\\.bgUrl\\b/g,    '(appearance.bg?.url ?? "")'],
  [/\\bappearance\\.bgFit\\b/g,    '(appearance.bg?.fit ?? "cover")'],
  [/\\bappearance\\.bgOpacity\\b/g,'(typeof appearance.bg?.opacity === "number" ? appearance.bg.opacity : 0.25)'],
  [/\\bappearance\\.bgDim\\b/g,    '(typeof appearance.bg?.dim === "number" ? appearance.bg.dim : 0.45)'],
  [/\\bappearance\\.bgBlurPx\\b/g, '(typeof appearance.bg?.blurPx === "number" ? appearance.bg.blurPx : 10)'],
  [/\\bappearance\\.bgEnabled\\b/g,'(!!appearance.bg?.enabled)'],
];

for (const [re, rep] of readMap) s = s.replace(re, rep);

// WRITE: patchAppearance({ bgType: X }) -> patchAppearance({ bg: { ...(appearance.bg||{}), type: X } })
function repWrite(flatKey, outKey) {
  const re = new RegExp(
    "patchAppearance\\(\\{\\s*" + flatKey + "\\s*:\\s*([^}]+)\\}\\s*\\)",
    "g"
  );
  s = s.replace(re, (_m, rhs) => {
    const R = String(rhs).trim();
    return `patchAppearance({ bg: { ...(appearance.bg || {}), ${outKey}: ${R} } } as any)`;
  });
}

repWrite("bgType", "type");
repWrite("bgUrl", "url");
repWrite("bgFit", "fit");
repWrite("bgOpacity", "opacity");
repWrite("bgDim", "dim");
repWrite("bgBlurPx", "blurPx");
repWrite("bgEnabled", "enabled");

fs.writeFileSync(file, s, "utf8");
console.log("OK: migrated settings bg* fields -> appearance.bg object");
NODE

echo "== verify leftovers (should be empty) =="
if command -v rg >/dev/null 2>&1; then
  rg -n "appearance\\.bgType|appearance\\.bgUrl|appearance\\.bgFit|appearance\\.bgOpacity|appearance\\.bgDim|appearance\\.bgBlurPx|appearance\\.bgEnabled|\\bbgType\\b|\\bbgUrl\\b|\\bbgFit\\b|\\bbgOpacity\\b|\\bbgDim\\b|\\bbgBlurPx\\b|\\bbgEnabled\\b" "$FILE" || true
else
  grep -nE "appearance\\.bg(Type|Url|Fit|Opacity|Dim|BlurPx|Enabled)|\\bbg(Type|Url|Fit|Opacity|Dim|BlurPx|Enabled)\\b" "$FILE" || true
fi

echo "== build =="
rm -rf .next >/dev/null 2>&1 || true
npm run build

echo "== commit + deploy =="
git add "$FILE"
git commit -m "fix: migrate settings bg flat fields to appearance.bg object" || true
git push
vercel --prod

echo "DONE"
