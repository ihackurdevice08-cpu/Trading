export type ThemeTokens = {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  lineSoft: string;
  lineHard: string;
  accent: string;
};

export const THEMES: Record<string, { name: string; tokens: ThemeTokens }> = {
  linen: {
    name: "Linen Suite",
    tokens: {
      bg: "#F4F0E6",
      panel: "rgba(255,255,255,0.72)",
      text: "rgba(0,0,0,0.88)",
      muted: "rgba(0,0,0,0.55)",
      lineSoft: "rgba(0,0,0,0.10)",
      lineHard: "rgba(0,0,0,0.18)",
      accent: "#B89A5A",
    },
  },
  resort: {
    name: "Desert Resort",
    tokens: {
      bg: "#EFE6D6",
      panel: "rgba(255,255,255,0.70)",
      text: "rgba(0,0,0,0.88)",
      muted: "rgba(0,0,0,0.55)",
      lineSoft: "rgba(0,0,0,0.10)",
      lineHard: "rgba(0,0,0,0.18)",
      accent: "#C2A66B",
    },
  },
  noir: {
    name: "Noir Lobby",
    tokens: {
      bg: "#0F0F12",
      panel: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.92)",
      muted: "rgba(255,255,255,0.60)",
      lineSoft: "rgba(255,255,255,0.10)",
      lineHard: "rgba(255,255,255,0.18)",
      accent: "#D6B56E",
    },
  },
  vault: {
    name: "Gold Vault",
    tokens: {
      bg: "#15130E",
      panel: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.92)",
      muted: "rgba(255,255,255,0.60)",
      lineSoft: "rgba(255,255,255,0.10)",
      lineHard: "rgba(255,255,255,0.18)",
      accent: "#C8A24A",
    },
  },
  dune: {
    name: "Dune Beige",
    tokens: {
      bg: "#EDE2CF",
      panel: "rgba(255,255,255,0.68)",
      text: "rgba(0,0,0,0.88)",
      muted: "rgba(0,0,0,0.55)",
      lineSoft: "rgba(0,0,0,0.10)",
      lineHard: "rgba(0,0,0,0.18)",
      accent: "#B58B4D",
    },
  },
};

/**
 * Backward-compatible exports:
 * Some code imports { getTheme, applyThemeVars } from "@/lib/appearance/themes".
 */
export function getTheme(themeId?: string) {
  const id = (themeId || "linen").toString();
  return THEMES[id] || THEMES["linen"];
}

export function applyThemeVars(themeId?: string) {
  // SSR/Build safety
  if (typeof document === "undefined") return;

  const { tokens } = getTheme(themeId);
  const r = document.documentElement;

  // These names must match what your CSS uses (var(--bg), etc.)
  r.style.setProperty("--bg", tokens.bg);
  r.style.setProperty("--panel", tokens.panel);
  r.style.setProperty("--text", tokens.text);
  r.style.setProperty("--text-muted", tokens.muted);
  r.style.setProperty("--line-soft", tokens.lineSoft);
  r.style.setProperty("--line-hard", tokens.lineHard);
  r.style.setProperty("--accent", tokens.accent);
}
