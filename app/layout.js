export const metadata = {
  title: "Man Cave OS",
  description: "Private trading console",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          :root {
            --bg: #F4F0E6;
            --panel: rgba(255,255,255,0.72);
            --text-primary: rgba(0,0,0,0.88);
            --text: rgba(0,0,0,0.88);
            --text-secondary: rgba(0,0,0,0.70);
            --text-muted: rgba(0,0,0,0.55);
            --line-soft: rgba(0,0,0,0.10);
            --line-hard: rgba(0,0,0,0.18);
            --accent: #B89A5A;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: var(--bg);
            color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            -webkit-font-smoothing: antialiased;
          }
          input, select, textarea, button {
            font-family: inherit;
            color: inherit;
          }
          button { cursor: pointer; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
