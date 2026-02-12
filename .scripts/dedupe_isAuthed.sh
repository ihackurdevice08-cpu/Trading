#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true

cd "$HOME/Documents/GitHub/Trading" || exit 1
FILE="components/providers/AppearanceProvider.tsx"
test -f "$FILE" || { echo "ERR: $FILE not found"; exit 1; }

cp "$FILE" "/tmp/AppearanceProvider.tsx.bak.dedupe.$(date +%s)"

node <<'NODE'
const fs = require("fs");
const file = "components/providers/AppearanceProvider.tsx";
const lines = fs.readFileSync(file, "utf8").split("\n");

let seen = 0;
const out = [];

for (const ln of lines) {
  if (/\bconst\s+isAuthed\s*=\s*true\s*;/.test(ln)) {
    seen += 1;
    if (seen > 1) continue; // 두번째부터 제거
  }
  out.push(ln);
}

fs.writeFileSync(file, out.join("\n"), "utf8");
console.log(`OK: const isAuthed=true; kept 1, removed ${Math.max(0, seen-1)}`);
NODE

echo "== build =="
rm -rf .next >/dev/null 2>&1 || true
npm run build

echo "== commit + push =="
git add "$FILE"
git commit -m "fix: dedupe isAuthed declaration" || true
git push

echo "DONE"
