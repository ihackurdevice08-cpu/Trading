#!/usr/bin/env bash
set -euo pipefail

node <<'NODE'
const fs = require("fs");

const file = "components/layout/AppLayout.jsx";
let s = fs.readFileSync(file, "utf8");

// 0) FuturesTicker import 없으면 추가
if (!s.includes('import FuturesTicker')) {
  // import 영역 끝(첫 빈줄) 뒤에 추가
  const m = s.match(/\n\s*\n/);
  if (m && m.index != null) {
    const i = m.index + m[0].length;
    s = s.slice(0, i) + 'import FuturesTicker from "../widgets/FuturesTicker";\n' + s.slice(i);
  } else {
    s = 'import FuturesTicker from "../widgets/FuturesTicker";\n' + s;
  }
}

// 1) 기존 삽입물(코멘트+컴포넌트) 싹 제거
s = s.replace(/\n[ \t]*\{\s*\/\*\s*Global Bottom Ticker[\s\S]*?\*\/\s*\}\s*\n[ \t]*<FuturesTicker\s*\/>\s*\n/g, "\n");
s = s.replace(/\n[ \t]*\{\s*\/\*\s*Global Bottom Ticker\s*\(always visible\)[\s\S]*?\*\/\s*\}\s*\n[ \t]*<FuturesTicker\s*\/>\s*\n/g, "\n");

// 2) “파일 레벨”로 튀어나간 고아 </div> 제거
//    - 바로 앞에 "Global Bottom Ticker" 코멘트가 있었던 상황에서 생긴 케이스를 정리
//    - 들여쓰기 없는 "</div>" 라인이 단독으로 있는 경우만 제거(위험 최소화)
s = s.replace(/^\s*<\/div>\s*$/gm, (line, offset) => {
  // 주변에 Global Bottom Ticker 텍스트가 가까이 있으면 제거
  const start = Math.max(0, offset - 200);
  const end = Math.min(s.length, offset + 200);
  const window = s.slice(start, end);
  if (window.includes("Global Bottom Ticker")) return "";
  return line; // 다른 </div>는 건드리지 않음
});

// 3) 이제 “return ( ... )” 블록 내부의 루트 마지막 </div> 직전에 한 번만 삽입
const rIdx = s.lastIndexOf("return (");
if (rIdx === -1) throw new Error("Cannot find `return (` in AppLayout.jsx");

const endIdx = s.lastIndexOf(");");
if (endIdx === -1 || endIdx < rIdx) throw new Error("Cannot find end `);` for return block");

const body = s.slice(rIdx, endIdx);

// return 블록 안에서 마지막 </div> 찾기
const lastDiv = body.lastIndexOf("</div>");
if (lastDiv === -1) throw new Error("Cannot find closing </div> inside return block");

const insertAt = rIdx + lastDiv; // "</div>" 직전

const insert = `      {/* Global Bottom Ticker (always visible) */}
      <FuturesTicker />

`;

s = s.slice(0, insertAt) + insert + s.slice(insertAt);

fs.writeFileSync(file, s, "utf8");
console.log("OK: cleaned + re-injected FuturesTicker safely inside return root");
NODE

npm run build
git add components/layout/AppLayout.jsx
git commit -m "fix: repair AppLayout ticker injection (keep JSX inside return)" || true
git push
vercel --prod
