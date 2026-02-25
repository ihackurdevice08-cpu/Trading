export const metadata = {
  title: "Man Cave OS",
  description: "Private trading console",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }

          :root {
            /* 배경/패널 */
            --bg:          #F4F0E6;
            --panel:       rgba(255,255,255,0.72);

            /* 텍스트 */
            --text-primary:   rgba(0,0,0,0.88);
            --text:           rgba(0,0,0,0.88);
            --text-secondary: rgba(0,0,0,0.65);
            --text-muted:     rgba(0,0,0,0.45);

            /* 선 */
            --line-soft: rgba(0,0,0,0.09);
            --line-hard: rgba(0,0,0,0.18);

            /* 액센트 */
            --accent: #B89A5A;

            /* 상태 색상 — 전 앱 통일 */
            --green: #0b7949;
            --red:   #c0392b;
            --amber: #d97706;
          }

          html, body {
            margin: 0; padding: 0;
            background: var(--bg);
            color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
                         "Noto Sans KR", "Segoe UI", sans-serif;
            -webkit-font-smoothing: antialiased;
            overflow-x: hidden;
          }

          input, select, textarea, button {
            font-family: inherit;
            color: inherit;
            font-size: max(16px, 1em);
          }
          button { cursor: pointer; }

          /* 터치 하이라이트 제거 */
          * { -webkit-tap-highlight-color: transparent; }

          /* 갤럭시 폴드 초소형 대응 */
          @media (max-width: 320px) { html { font-size: 14px; } }

          /* iOS safe area */
          body {
            padding-left:  env(safe-area-inset-left);
            padding-right: env(safe-area-inset-right);
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
