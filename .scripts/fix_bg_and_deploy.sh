#!/usr/bin/env bash
set -euo pipefail

cd "$HOME/Documents/GitHub/Trading" || exit 1

FILE="lib/appearance/types.ts"

node <<'NODE'
const fs = require("fs");

const FILE = "lib/appearance/types.ts";
let s = fs.readFileSync(FILE, "utf8");

let m =
  s.match(/export\s+interface\s+AppearanceSettings\s*\{[\s\S]*?\n\}/m) ||
  s.match(/export\s+type\s+AppearanceSettings\s*=\s*\{[\s\S]*?\n\};/m);

if (!m) {
  console.error("AppearanceSettings not found in", FILE);
  process.exit(1);
}

let block = m[0];

// bg 필드가 없으면 삽입
if (!/\bbg\s*\??\s*:/.test(block)) {
  if (block.includes("interface AppearanceSettings")) {
    block = block.replace(
      /\n\}/,
      '\n  bg?: { enabled?: boolean; fit?: "cover" | "contain"; url?: string | null };\n}'
    );
  } else {
    // type AppearanceSettings = { ... };
    block = block.replace(
      /\n\};/,
      '\n  bg?: { enabled?: boolean; fit?: "cover" | "contain"; url?: string | null };\n};'
    );
  }
  s = s.replace(m[0], block);
  fs.writeFileSync(FILE, s, "utf8");
  console.log("OK: bg added to AppearanceSettings");
} else {
  console.log("OK: bg already exists");
}
NODE

npm run build

git add "$FILE"
git commit -m "fix: add bg to AppearanceSettings" || true
git push
vercel --prod
