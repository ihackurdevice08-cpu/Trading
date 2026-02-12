#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true
cd "$HOME/Documents/GitHub/Trading" || exit 1

FILE="components/providers/AppearanceProvider.tsx"
test -f "$FILE" || { echo "ERR: $FILE not found"; exit 1; }

cp "$FILE" "/tmp/AppearanceProvider.tsx.bak.$(date +%s)"

node <<'NODE'
const fs = require("fs");
const file = "components/providers/AppearanceProvider.tsx";
let s = fs.readFileSync(file, "utf8");

// 1) Ctx 타입에 isAuthed 추가
// - `type Ctx = { ... }` 또는 `export type Ctx = { ... }` 둘 다 대응
s = s.replace(/(export\s+type\s+Ctx\s*=\s*\{[\s\S]*?)(\n\})/m, (all, head, tail) => {
  if (head.includes("isAuthed")) return all;
  return head + "\n  isAuthed: boolean;" + tail;
});
s = s.replace(/(type\s+Ctx\s*=\s*\{[\s\S]*?)(\n\})/m, (all, head, tail) => {
  if (head.includes("isAuthed")) return all;
  return head + "\n  isAuthed: boolean;" + tail;
});

// 2) Provider 내부에 isAuthed state 없으면 추가
if (!s.includes("const [isAuthed")) {
  // appearance state 선언 바로 뒤에 끼워 넣기
  s = s.replace(
    /(const\s+\[appearance[\s\S]*?\]\s*=\s*useState\([^\)]*\);\s*)/m,
    `$1\n  const [isAuthed, setIsAuthed] = useState(false);\n`
  );
}

// 3) uid 확보하는 위치에서 setIsAuthed(!!uid) 넣기
// - supabaseBrowser() or sb.auth.getUser() 등 다양한 구현을 고려해서
//   "const uid =" 라인 뒤에 주입(중복 주입 방지)
if (!s.includes("setIsAuthed(!!uid)")) {
  s = s.replace(
    /(const\s+uid\s*=\s*[^;\n]+;)/g,
    (m) => m + "\n    setIsAuthed(!!uid);"
  );
}

// 4) value 객체에 isAuthed 포함
// - `const value = { ... }` 패턴에 대응
s = s.replace(/const\s+value\s*=\s*\{([\s\S]*?)\};/m, (all, inner) => {
  if (inner.includes("isAuthed")) return all;
  return `const value = {${inner}\n    isAuthed,\n  };`;
});

// 5) Provider value={value} 그대로 두되, 혹시 value를 inline으로 만드는 경우도 대응
// - `<AppearanceContext.Provider value={{ ... }}>` 패턴
s = s.replace(/value=\{\{\s*([\s\S]*?)\s*\}\}/m, (all, inner) => {
  if (inner.includes("isAuthed")) return all;
  return `value={{\n${inner}\n        isAuthed,\n      }}`;
});

fs.writeFileSync(file, s, "utf8");
console.log("OK: isAuthed added to AppearanceProvider context");
NODE

echo "== build =="
rm -rf .next >/dev/null 2>&1 || true
npm run build

echo "== commit + deploy =="
git add "$FILE"
git commit -m "fix: add isAuthed to appearance context" || true
git push
vercel --prod

echo ""
echo "DONE."
