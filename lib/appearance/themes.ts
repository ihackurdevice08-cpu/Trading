export type ThemeTokens = {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  secondary: string;
  lineSoft: string;
  lineHard: string;
  accent: string;
  // 추가 토큰
  green?: string;
  red?: string;
};

export type FontScheme = {
  body: string;       // CSS font-family value
  mono: string;       // 모노 폰트
  display?: string;   // 헤딩/강조
  googleFonts?: string; // Google Fonts URL 파라미터
};

export const FONT_SCHEMES: Record<string, FontScheme> = {
  // 기본: 시스템 한국어 폰트 (다운로드 없음)
  default: {
    body: `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "맑은 고딕", "Segoe UI", sans-serif`,
    mono: `"SF Mono", "Fira Code", "Consolas", monospace`,
    display: `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`,
  },
  // Lounge Noir: DM Mono + EB Garamond
  lounge: {
    body: `"DM Mono", "Courier New", Courier, monospace`,
    mono: `"DM Mono", "Courier New", Courier, monospace`,
    display: `"EB Garamond", "Playfair Display", Georgia, serif`,
    googleFonts: `https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap`,
  },
  // Forge: Inter UI + DM Mono 숫자
  forge: {
    body: `"Inter", "Apple SD Gothic Neo", "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif`,
    mono: `"DM Mono", "SF Mono", "Fira Code", "Consolas", monospace`,
    display: `"Inter", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`,
    googleFonts: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap`,
  },
};

export const THEMES: Record<string, {
  name: string;
  label: string;       // 짧은 설명
  fontScheme: string;  // FONT_SCHEMES 키
  tokens: ThemeTokens;
}> = {
  linen: {
    name: "Linen Suite",
    label: "따뜻한 리넨 / 낮",
    fontScheme: "default",
    tokens: {
      bg: "#F4F0E6",
      panel: "rgba(255,255,255,0.72)",
      text: "rgba(0,0,0,0.88)",
      secondary: "rgba(0,0,0,0.70)",
      muted: "rgba(0,0,0,0.55)",
      lineSoft: "rgba(0,0,0,0.10)",
      lineHard: "rgba(0,0,0,0.18)",
      accent: "#B89A5A",
    },
  },
  resort: {
    name: "Desert Resort",
    label: "사막 모래 / 황혼",
    fontScheme: "default",
    tokens: {
      bg: "#EFE6D6",
      panel: "rgba(255,255,255,0.70)",
      text: "rgba(0,0,0,0.88)",
      secondary: "rgba(0,0,0,0.70)",
      muted: "rgba(0,0,0,0.55)",
      lineSoft: "rgba(0,0,0,0.10)",
      lineHard: "rgba(0,0,0,0.18)",
      accent: "#C2A66B",
    },
  },
  noir: {
    name: "Noir Lobby",
    label: "다크 / 심야",
    fontScheme: "default",
    tokens: {
      bg: "#0F0F12",
      panel: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.92)",
      secondary: "rgba(255,255,255,0.75)",
      muted: "rgba(255,255,255,0.55)",
      lineSoft: "rgba(255,255,255,0.10)",
      lineHard: "rgba(255,255,255,0.18)",
      accent: "#D6B56E",
    },
  },
  vault: {
    name: "Gold Vault",
    label: "블랙 골드 / 밤",
    fontScheme: "default",
    tokens: {
      bg: "#15130E",
      panel: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.92)",
      secondary: "rgba(255,255,255,0.75)",
      muted: "rgba(255,255,255,0.55)",
      lineSoft: "rgba(255,255,255,0.10)",
      lineHard: "rgba(255,255,255,0.18)",
      accent: "#C8A24A",
    },
  },
  dune: {
    name: "Dune Beige",
    label: "연한 베이지 / 낮",
    fontScheme: "default",
    tokens: {
      bg: "#EDE2CF",
      panel: "rgba(255,255,255,0.68)",
      text: "rgba(0,0,0,0.88)",
      secondary: "rgba(0,0,0,0.70)",
      muted: "rgba(0,0,0,0.55)",
      lineSoft: "rgba(0,0,0,0.10)",
      lineHard: "rgba(0,0,0,0.18)",
      accent: "#B58B4D",
    },
  },

  // ─────────────────────────────────────────────────────────
  // FORGE — 프로 트레이더 전투실
  // 딥 다크 + 네온 그린 + 엠버 액센트, Inter + DM Mono
  // ─────────────────────────────────────────────────────────
  forge: {
    name: "Forge",
    label: "딥 다크 / 프로 트레이더",
    fontScheme: "forge",
    tokens: {
      bg: "#0d0f14",
      panel: "rgba(255,255,255,0.04)",
      text: "rgba(255,255,255,0.92)",
      secondary: "rgba(255,255,255,0.65)",
      muted: "rgba(255,255,255,0.38)",
      lineSoft: "rgba(255,255,255,0.08)",
      lineHard: "rgba(255,255,255,0.16)",
      accent: "#F0B429",
      green: "#00C076",
      red: "#FF4D4D",
    },
  },

  // ─────────────────────────────────────────────────────────
  // LOUNGE NOIR — 새 테마
  // 검정 바탕, 골드 라인, DM Mono 폰트, 기하학 글리프
  // ─────────────────────────────────────────────────────────
  lounge: {
    name: "Lounge Noir",
    label: "라운지 / 모노스페이스",
    fontScheme: "lounge",
    tokens: {
      bg: "#080808",
      panel: "rgba(226,221,214,0.04)",
      text: "rgba(226,221,214,0.92)",
      secondary: "rgba(226,221,214,0.68)",
      muted: "rgba(226,221,214,0.38)",
      lineSoft: "rgba(226,221,214,0.12)",
      lineHard: "rgba(226,221,214,0.28)",
      accent: "#C9B87A",
      green: "#7ab87a",
      red: "#b87a7a",
    },
  },
};

export function getTheme(themeId?: string) {
  const id = (themeId || "linen").toString();
  return THEMES[id] || THEMES["linen"];
}

export function applyThemeVars(themeId?: string) {
  if (typeof document === "undefined") return;
  const { tokens } = getTheme(themeId);
  const r = document.documentElement;
  r.style.setProperty("--bg",             tokens.bg);
  r.style.setProperty("--panel",          tokens.panel);
  r.style.setProperty("--text-primary",   tokens.text);
  r.style.setProperty("--text",           tokens.text);
  r.style.setProperty("--text-secondary", tokens.secondary);
  r.style.setProperty("--text-muted",     tokens.muted);
  r.style.setProperty("--line-soft",      tokens.lineSoft);
  r.style.setProperty("--line-hard",      tokens.lineHard);
  r.style.setProperty("--accent",         tokens.accent);
  if (tokens.green) r.style.setProperty("--green", tokens.green);
  if (tokens.red)   r.style.setProperty("--red",   tokens.red);
}

// 폰트 CSS 변수 + <link> 동적 주입
let _injectedFont: string | null = null;
export function applyFontScheme(themeId?: string) {
  if (typeof document === "undefined") return;
  const { fontScheme } = getTheme(themeId);
  const scheme = FONT_SCHEMES[fontScheme] || FONT_SCHEMES.default;

  // CSS 변수
  const r = document.documentElement;
  r.style.setProperty("--font-body",    scheme.body);
  r.style.setProperty("--font-mono",    scheme.mono);
  r.style.setProperty("--font-display", scheme.display || scheme.body);

  // body/input font-family 즉시 적용
  document.body.style.fontFamily = scheme.body;

  // Google Fonts 동적 로드 (중복 방지)
  if (scheme.googleFonts && _injectedFont !== scheme.googleFonts) {
    const existing = document.getElementById("dyn-gfont");
    if (existing) existing.remove();
    const link = document.createElement("link");
    link.id   = "dyn-gfont";
    link.rel  = "stylesheet";
    link.href = scheme.googleFonts;
    document.head.appendChild(link);
    _injectedFont = scheme.googleFonts;
  } else if (!scheme.googleFonts) {
    // 기본 테마로 돌아갈 때 — 시스템 폰트로 복원
    const existing = document.getElementById("dyn-gfont");
    if (existing) existing.remove();
    _injectedFont = null;
  }
}
