#!/usr/bin/env bash
set -euo pipefail

# 0) 안전장치: zsh가 JS를 해석하지 않게 node heredoc만 사용
node <<'NODE'
const fs = require("fs");

const file = "components/layout/AppLayout.jsx";
let s = fs.readFileSync(file, "utf8");

// 1) import 보장
if (!s.includes('import FuturesTicker')) {
  // 가장 위 import들 뒤에 끼워 넣기(대충 첫 빈줄 지점)
  const m = s.match(/\n\s*\n/);
  if (m && m.index != null) {
    const i = m.index + m[0].length;
    s = s.slice(0, i) + 'import FuturesTicker from "../widgets/FuturesTicker";\n' + s.slice(i);
  } else {
    s = 'import FuturesTicker from "../widgets/FuturesTicker";\n' + s;
  }
}

// 2) 중복 렌더 제거(어디에 있든)
s = s.replace(/\s*<FuturesTicker\s*\/>\s*/g, "\n");

// 3) main paddingBottom(티커에 가리지 않게)
// - main style={{ padding: 16 }} 형태가 있으면 paddingBottom 추가
s = s.replace(
  /<main\s+style=\{\{\s*padding:\s*16\s*\}\}>/g,
  '<main style={{ padding: 16, paddingBottom: 84 }}>'
);

// 4) 최상위 return wrapper의 "마지막 </div>" 바로 뒤에 넣기
//    - "return (" 이후부터 끝까지 보고, 마지막 </div>를 찾는다
const rIdx = s.lastIndexOf("return (");
if (rIdx === -1) throw new Error("Cannot find `return (` in AppLayout.jsx");

const tail = s.slice(rIdx);
const lastDivCloseInTail = tail.lastIndexOf("</div>");
if (lastDivCloseInTail === -1) throw new Error("Cannot find closing </div> near end of return block");

const insertPos = rIdx + lastDivCloseInTail + "</div>".length;

// 삽입 (한 번만)
const insert = `

      {/* Global Bottom Ticker (always visible) */}
      <FuturesTicker />

`;
s = s.slice(0, insertPos) + insert + s.slice(insertPos);

fs.writeFileSync(file, s, "utf8");
console.log("OK: AppLayout.jsx -> injected single global <FuturesTicker /> near bottom");
NODE

# 5) FuturesTicker를 "진짜 하단 고정 + 가로"로 강제(테마 변수 사용)
node <<'NODE'
const fs = require("fs");
const file = "components/widgets/FuturesTicker.jsx";
let s = fs.readFileSync(file, "utf8");

// API 응답을 {ok:true, data:{SYM:{price,pct}}} 로 통일했으니 data를 읽게 보정
// (혹시 items 기반 코드가 남아있으면 교체)
s = s.replace(/j\.items/g, "j.data");
s = s.replace(/items:/g, "data:"); // 혹시 하드코딩된 곳이 있으면 완화

// 하단 고정 스타일: container wrapper에 position fixed 적용(없으면 삽입)
// 가장 바깥 return div style을 찾아서 강제 치환 (대충 첫 return (<div style={{ ... }}> 패턴)
s = s.replace(
  /return\s*\(\s*<div\s+style=\{\{\s*/m,
  'return (\n    <div\n      style={{\n        position: "fixed",\n        left: 0,\n        right: 0,\n        bottom: 0,\n        zIndex: 9999,\n        padding: "10px 12px",\n        borderTop: "1px solid var(--line-soft)",\n        background: "rgba(0,0,0,0.28)",\n        backdropFilter: "blur(10px)",\n        WebkitBackdropFilter: "blur(10px)",\n        display: "flex",\n        justifyContent: "center",\n        gap: 10,\n        alignItems: "center",\n      }}\n    >\n      <div style={{ width: "min(980px, 100%)", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>\n'
);

// 위에서 wrapper를 두 겹으로 넣었으니 마지막에 </div></div>가 닫히도록 보정
// 마지막 `</div>\n  );` 패턴이 있으면 바꿔치기
s = s.replace(/\n\s*<\/div>\s*\);\s*$/m, "\n      </div>\n    </div>\n  );");

// 표기 순서 강제: 가격(좌) / 퍼센트(우)
// 기존에 퍼센트 먼저 찍는 span이 있으면 간단히 swap(안전하게 label 기준으로 교체)
// (너 코드에 이미 “가격(좌)/퍼센트(우)” 주석이 있었으니, 그 블록만 정렬)
s = s.replace(
  /\/\*\s*✅\s*요구: 가격\(좌\)\s*\/\s*퍼센트\(우\)\s*\*\/[\s\S]*?<span[^>]*>\s*\{fmtPrice\(r\.price\)\}[\s\S]*?<span[^>]*>\s*\{fmtPct\(r\.pct\)\}[\s\S]*?<\/span>/m,
  `/* ✅ 요구: 가격(좌) / 퍼센트(우) */\n            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900 }}>\n              {fmtPrice(r.price)}\n            </span>\n            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900, color }}>\n              {fmtPct(r.pct)}\n            </span>`
);

fs.writeFileSync(file, s, "utf8");
console.log("OK: FuturesTicker.jsx -> fixed bottom bar + api {data} + price-left pct-right");
NODE

# 6) 빌드/커밋/배포
npm run build
git add components/layout/AppLayout.jsx components/widgets/FuturesTicker.jsx
git commit -m "fix: robust global bottom FuturesTicker (fixed bar, price-left pct-right)" || true
git push
vercel --prod
