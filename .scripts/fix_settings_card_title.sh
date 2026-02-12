#!/usr/bin/env bash
set -euo pipefail

FILE="app/(app)/settings/page.tsx"
test -f "$FILE" || { echo "ERROR: $FILE not found"; exit 1; }

node - <<'NODE'
const fs = require("fs");
const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

// Appearance 섹션에 들어간 "title 없는 <Card>"만 타겟팅
// (가장 안전한 기준: Appearance & Atmosphere 텍스트 근처의 <Card> 오프닝)
const marker = "Appearance & Atmosphere";
const mIdx = s.indexOf(marker);
if (mIdx === -1) {
  throw new Error("Cannot find 'Appearance & Atmosphere' marker in settings page");
}

// marker 근처(이전 400자~이후 400자)에서 <Card> 를 찾아 title 주입
const from = Math.max(0, mIdx - 800);
const to = Math.min(s.length, mIdx + 800);
const chunk = s.slice(from, to);

const cardOpenIdx = chunk.indexOf("<Card>");
if (cardOpenIdx === -1) {
  // 이미 title이 있거나 구조가 다른 경우
  console.log("SKIP: No plain <Card> found near Appearance section (maybe already fixed)");
  process.exit(0);
}

// 실제 전체 문자열 위치로 변환
const absIdx = from + cardOpenIdx;

// <Card> -> <Card title="Appearance & Atmosphere" desc="...">
const replacement =
  `<Card title="Appearance & Atmosphere" desc="모든 취향 설정은 로그인한 계정에 귀속됩니다. 다른 기기에서 로그인해도 그대로 유지됩니다.">`;

s = s.slice(0, absIdx) + replacement + s.slice(absIdx + "<Card>".length);

fs.writeFileSync(file, s, "utf8");
console.log("OK: injected required Card title/desc for Appearance section");
NODE

npm run build
git add "$FILE"
git commit -m "fix: settings appearance Card requires title/desc" || true
git push
vercel --prod
