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
