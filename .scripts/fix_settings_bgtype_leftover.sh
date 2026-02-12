#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true

cd "$HOME/Documents/GitHub/Trading" || exit 1
FILE="app/(app)/settings/page.tsx"
test -f "$FILE" || { echo "ERR: $FILE not found"; exit 1; }

cp "$FILE" "/tmp/settings.page.tsx.bak.bgtype.$(date +%s)"

node <<'NODE'
const fs = require("fs");
const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

// 1) value={appearance.bgType} -> value={(appearance.bg?.type ?? "none") as any}
s = s.replace(
  /value=\{appearance\.bgType\}/g,
  'value={((appearance.bg?.type ?? "none") as any)}'
);

// 2) 혹시 남아있을 수 있는 onChange flat 패턴도 안전하게 정리
// onChange={(e)=>patchAppearance({ bgType: ... })}
s = s.replace(
  /patchAppearance\(\{\s*bgType\s*:\s*([^}]+)\}\s*\)/g,
  (_m, rhs) => `patchAppearance({ bg: { ...(appearance.bg || {}), type: ${String(rhs).trim()} } } as any)`
);

// 3) 혹시 남아있을 수 있는 appearance.bgType 참조 전부 제거(최후의 안전장치)
s = s.replace(/\bappearance\.bgType\b/g, '(appearance.bg?.type ?? "none")');

fs.writeFileSync(file, s, "utf8");
console.log("OK: removed leftover appearance.bgType references");
NODE

echo "== verify (should show nothing) =="
if command -v rg >/dev/null 2>&1; then
  rg -n "appearance\\.bgType|\\bbgType\\b" "$FILE" || true
else
  grep -nE "appearance\\.bgType|\\bbgType\\b" "$FILE" || true
fi

echo "== build =="
rm -rf .next >/dev/null 2>&1 || true
npm run build

echo "== commit + deploy =="
git add "$FILE"
git commit -m "fix: remove leftover appearance.bgType usage in settings" || true
git push
vercel --prod

echo "DONE"
