#!/usr/bin/env bash
set -euo pipefail

FILE="app/(app)/settings/page.tsx"
test -f "$FILE" || { echo "ERROR: $FILE not found"; exit 1; }

node - <<'NODE'
const fs = require("fs");
const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

// style={input} -> style={{...}} (select/input 공용으로 써도 무난한 스타일)
const inputInline = `{{ 
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--line-hard)",
  background: "rgba(255,255,255,0.75)",
  color: "rgba(0,0,0,0.88)",
  fontWeight: 900,
  outline: "none"
}}`;

s = s.replace(/style=\{input\}/g, `style=${inputInline}`);

// 혹시 input2 같은 변형도 있으면 안전 처리(있을 때만)
s = s.replace(/style=\{input2\}/g, `style=${inputInline}`);

fs.writeFileSync(file, s, "utf8");
console.log("OK: replaced style={input} with inline style");
NODE

npm run build
git add "$FILE"
git commit -m "fix: settings appearance input/select style (remove undefined input var)" || true
git push
vercel --prod
