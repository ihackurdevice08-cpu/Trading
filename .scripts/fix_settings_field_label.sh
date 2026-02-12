#!/usr/bin/env bash
set -euo pipefail

FILE="app/(app)/settings/page.tsx"
test -f "$FILE" || { echo "ERROR: $FILE not found"; exit 1; }

node - <<'NODE'
const fs = require("fs");
const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

const fieldInline = `{{ 
  display: "grid",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid var(--line-soft)",
  background: "rgba(210,194,165,0.10)"
}}`;

const labelInline = `{{ 
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.2,
  color: "var(--text-muted)"
}}`;

// 1) style={field} -> style={{...}}
s = s.replace(/style=\{field\}/g, `style=${fieldInline}`);

// 2) style={label} -> style={{...}}
s = s.replace(/style=\{label\}/g, `style=${labelInline}`);

// 3) 혹시 hint 같은 것도 들어갔으면 같이 안전 처리(있을 때만)
s = s.replace(/style=\{hint\}/g, `style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}`);

fs.writeFileSync(file, s, "utf8");
console.log("OK: replaced style={field}/{label} with inline styles");
NODE

npm run build
git add "$FILE"
git commit -m "fix: settings appearance styles (remove undefined field/label vars)" || true
git push
vercel --prod
