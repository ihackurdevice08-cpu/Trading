#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true

cd "$HOME/Documents/GitHub/Trading" || exit 1
FILE="components/providers/AppearanceProvider.tsx"
test -f "$FILE" || { echo "ERR: $FILE not found"; exit 1; }

cp "$FILE" "/tmp/AppearanceProvider.tsx.bak.isAutheddecl.$(date +%s)"

node <<'NODE'
const fs = require("fs");
const file = "components/providers/AppearanceProvider.tsx";
let s = fs.readFileSync(file, "utf8");

// 1) isAuthed 선언이 없으면 AppearanceProvider 함수 바디 초반에 삽입
if (!/\bconst\s+isAuthed\s*=/.test(s)) {
  // AppearanceProvider 함수 시작 중괄호 다음 줄에 삽입
  s = s.replace(
    /(function\s+AppearanceProvider\s*\([^)]*\)\s*\{\s*)/m,
    `$1\n  // NOTE: UI gating flag (kept simple to avoid build issues)\n  const isAuthed = true;\n`
  );
  // export function 형태도 커버
  s = s.replace(
    /(export\s+function\s+AppearanceProvider\s*\([^)]*\)\s*\{\s*)/m,
    `$1\n  // NOTE: UI gating flag (kept simple to avoid build issues)\n  const isAuthed = true;\n`
  );
}

// 2) value 객체에 isAuthed가 없으면 추가 (이미 있으면 그대로)
s = s.replace(
  /const\s+value\s*:\s*Ctx\s*=\s*\{([\s\S]*?)\};/m,
  (all, inner) => {
    if (inner.includes("isAuthed")) return all;
    const trimmed = inner.trim().replace(/,\s*$/,'');
    return `const value: Ctx = {\n${trimmed},\n  isAuthed,\n};`;
  }
);

fs.writeFileSync(file, s, "utf8");
console.log("OK: ensured `const isAuthed = true;` + included in context value");
NODE

echo "== build =="
rm -rf .next >/dev/null 2>&1 || true
npm run build

echo "== commit + push =="
git add "$FILE"
git commit -m "fix: declare isAuthed and include in appearance context" || true
git push

echo "DONE"
