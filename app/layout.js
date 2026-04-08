export const metadata = {
  title:       "Man Cave OS",
  description: "Private trading console",
};

export const viewport = {
  width:         "device-width",
  initialScale:  1,
  viewportFit:   "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* 시스템 폰트 사용 — 별도 로드 없음, 즉시 렌더 */}
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          :root {
            --bg:            #F4F0E6;
            --panel:         rgba(255,255,255,0.72);
            --text-primary:  rgba(0,0,0,0.88);
            --text:          rgba(0,0,0,0.88);
            --text-secondary:rgba(0,0,0,0.65);
            --text-muted:    rgba(0,0,0,0.45);
            --line-soft:     rgba(0,0,0,0.09);
            --line-hard:     rgba(0,0,0,0.18);
            --accent:        #B89A5A;
            --green:         #0b7949;
            --red:           #c0392b;
            --amber:         #d97706;
          }

          :root {
            /* 폰트 변수 — AppearanceProvider가 테마에 따라 동적으로 교체 */
            --font-body:    -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "맑은 고딕", "Segoe UI", sans-serif;
            --font-mono:    "SF Mono", "Fira Code", "Consolas", monospace;
            --font-display: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
          }

          html, body {
            background: var(--bg);
            color: var(--text-primary);
            font-family: var(--font-body);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            overflow-x: hidden;
          }

          /* 모든 입력/버튼 폰트 통일 */
          input, select, textarea, button {
            font-family: inherit;
            color: inherit;
          }
          /* 모바일: 입력 시 줌 방지 (16px 이상) */
          input, select, textarea { font-size: max(16px, 1em); }
          button { cursor: pointer; }

          /* 터치 하이라이트 제거 */
          * { -webkit-tap-highlight-color: transparent; }

          /* iOS safe area */
          body {
            padding-left:  env(safe-area-inset-left);
            padding-right: env(safe-area-inset-right);
          }

          /* 갤럭시 폴드 초소형 대응 */
          @media (max-width: 320px) { html { font-size: 14px; } }

          /* Skeleton 애니메이션 */
          @keyframes skeleton-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.35; }
          }

          /* 스크롤바 얇게 (Webkit) */
          ::-webkit-scrollbar       { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 99px; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
