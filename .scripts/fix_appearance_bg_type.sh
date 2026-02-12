#!/usr/bin/env bash
set -euo pipefail

FILE="lib/appearance/types.ts"
test -f "$FILE" || { echo "ERROR: $FILE not found"; exit 1; }

node - <<'NODE'
const fs = require("fs");
const file = "lib/appearance/types.ts";
let s = fs.readFileSync(file, "utf8");

// 1) AppearanceSettings 인터페이스에 bg 추가 (없을 때만)
if (!/bg\s*\?:/m.test(s)) {
  // AppearanceSettings 블록 찾기
  const m = s.match(/export\s+type\s+AppearanceSettings\s*=\s*\{[\s\S]*?\n\};/m)
        || s.match(/export\s+interface\s+AppearanceSettings\s*\{[\s\S]*?\n\}/m);

  if (!m) {
    throw new Error("Cannot find AppearanceSettings type/interface in lib/appearance/types.ts");
  }

  const block = m[0];

  // bg 타입(최소한으로)
  const bgField = `
  bg?: {
    enabled?: boolean;
    fit?: "cover" | "contain";
    url?: string | null;
  };
`;

  // 닫히기 직전에 삽입
  const patched = block.replace(/\n(\};|\})\s*$/m, `\n${bgField}\n$1`);
  s = s.replace(block, patched);
  console.log("OK: added appearance.bg type");
} else {
  console.log("SKIP: appearance.bg already exists in type");
}

// 2) defaultAppearance(또는 DEFAULT_APPEARANCE)에 bg 기본값 추가(있을 때만 안전 삽입)
const defaultRe = /(export\s+const\s+(defaultAppearance|DEFAULT_APPEARANCE)\s*=\s*\{[\s\S]*?\n\};)/m;
const dm = s.match(defaultRe);

if (dm && !/bg\s*:/m.test(dm[1])) {
  const whole = dm[1];
  // 객체 마지막에 bg 추가
  const injected = whole.replace(/\n\};\s*$/m, `,\n  bg: { enabled: false, fit: "cover", url: null }\n};`);
  s = s.replace(whole, injected);
  console.log("OK: added default bg in default appearance");
} else {
  console.log("SKIP: no defaultAppearance export found, or bg already present");
}

fs.writeFileSync(file, s, "utf8");
NODE

npm run build
git add "$FILE"
git commit -m "fix: add appearance.bg to AppearanceSettings type" || true
git push
vercel --prod
