#!/usr/bin/env bash
set -euo pipefail
set +H

cd "$HOME/Documents/GitHub/Trading" || exit 1

echo "== create BackgroundLayer component =="

mkdir -p components/ui

cat > components/ui/BackgroundLayer.tsx <<'TS'
"use client";

import { useAppearance } from "@/components/providers/AppearanceProvider";

export default function BackgroundLayer() {
  const { appearance } = useAppearance();
  const bg = appearance?.bg;

  if (!bg?.enabled || !bg?.url) return null;

  const fit = bg.fit || "cover";
  const opacity = typeof bg.opacity === "number" ? bg.opacity : 0.25;
  const dim = typeof bg.dim === "number" ? bg.dim : 0.45;
  const blurPx = typeof bg.blurPx === "number" ? bg.blurPx : 10;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `url(${bg.url})`,
          backgroundSize: fit,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity,
          zIndex: -2,
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `rgba(0,0,0,${dim})`,
          backdropFilter: `blur(${blurPx}px)`,
          zIndex: -1,
        }}
      />
    </>
  );
}
TS

echo "== inject BackgroundLayer into AppLayout =="

node <<'NODE'
const fs = require("fs");

const file = "components/layout/AppLayout.jsx";
let s = fs.readFileSync(file, "utf8");

if (!s.includes("BackgroundLayer")) {
  s = s.replace(
    /import .*FuturesTicker.*\n/,
    (m) => m + 'import BackgroundLayer from "../ui/BackgroundLayer";\n'
  );
}

if (!s.includes("<BackgroundLayer")) {
  s = s.replace(
    /return\s*\(\s*</,
    "return (\n    <>\n      <BackgroundLayer />\n      "
  );
  s = s.replace(/\);\s*$/, "\n    </>\n  );\n");
}

fs.writeFileSync(file, s);
console.log("OK AppLayout patched");
NODE

echo "== build =="

rm -rf .next || true
npm run build

echo "== commit & deploy =="

git add components/ui/BackgroundLayer.tsx components/layout/AppLayout.jsx
git commit -m "feat: render appearance.bg.url globally via BackgroundLayer" || true
git push
vercel --prod

echo "DONE"
