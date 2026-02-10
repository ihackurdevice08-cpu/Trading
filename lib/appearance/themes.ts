export type ThemeId = 1 | 2 | 3 | 4 | 5;

export type ThemeTokens = {
  bgMain: string;
  bgPanel: string;
  bgCard: string;
  lineSoft: string;
  lineHard: string;

  accentMain: string;
  accentSoft: string;
  accentDim: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  statusGreat: string;
  statusGood: string;
  statusSlow: string;
  statusStop: string;
};

export const THEMES: Record<ThemeId, { name: string; desc: string; tokens: ThemeTokens }> = {
  1: {
    name: "Desert Hotel Dark",
    desc: "사막 리조트 톤. 웜 베이지/스톤/무광 브론즈 느낌.",
    tokens: {
      bgMain: "#12110F",
      bgPanel: "#1B1916",
      bgCard: "#22201C",
      lineSoft: "#2E2B26",
      lineHard: "#3B372F",

      accentMain: "#D2C2A5",
      accentSoft: "#BFAF95",
      accentDim: "#9E917C",

      textPrimary: "#F1ECE3",
      textSecondary: "#C8C1B6",
      textMuted: "#9C9589",

      statusGreat: "#D2C2A5",
      statusGood: "#8FA3B8",
      statusSlow: "#D1A95F",
      statusStop: "#C84B4B",
    },
  },
  2: {
    name: "Champagne Lounge",
    desc: "퍼스트클래스 라운지. 크림/샴페인/스모키 그레이.",
    tokens: {
      bgMain: "#111012",
      bgPanel: "#19181C",
      bgCard: "#201F25",
      lineSoft: "#2B2A31",
      lineHard: "#3A3842",

      accentMain: "#D8CBB3",
      accentSoft: "#C7B89E",
      accentDim: "#A89B85",

      textPrimary: "#F3EEE6",
      textSecondary: "#C9C2B6",
      textMuted: "#9A9489",

      statusGreat: "#D8CBB3",
      statusGood: "#97A7BB",
      statusSlow: "#D1A95F",
      statusStop: "#C84B4B",
    },
  },
  3: {
    name: "Bronze Man Cave",
    desc: "위스키바 무드. 차콜/브라운/브론즈 묵직.",
    tokens: {
      bgMain: "#100E0C",
      bgPanel: "#181412",
      bgCard: "#1F1A17",
      lineSoft: "#2B2320",
      lineHard: "#3A2F2A",

      accentMain: "#C9B18F",
      accentSoft: "#B79C78",
      accentDim: "#967E60",

      textPrimary: "#F1EAE0",
      textSecondary: "#C6BBAE",
      textMuted: "#9B8F82",

      statusGreat: "#C9B18F",
      statusGood: "#90A3B8",
      statusSlow: "#D1A95F",
      statusStop: "#C84B4B",
    },
  },
  4: {
    name: "Sandstone Minimal",
    desc: "밝은 다크. 샌드/스톤/웜 그레이로 답답함 최소.",
    tokens: {
      bgMain: "#141311",
      bgPanel: "#1D1B18",
      bgCard: "#24211E",
      lineSoft: "#2F2C27",
      lineHard: "#3E3A33",

      accentMain: "#D7C9AE",
      accentSoft: "#C7B89E",
      accentDim: "#A89B85",

      textPrimary: "#F4EFE7",
      textSecondary: "#D0C8BB",
      textMuted: "#A39B8E",

      statusGreat: "#D7C9AE",
      statusGood: "#9AA9BC",
      statusSlow: "#D1A95F",
      statusStop: "#C84B4B",
    },
  },
  5: {
    name: "Black Gold Executive",
    desc: "블랙 베이스 + 절제된 골드 포인트. 대비 강함.",
    tokens: {
      bgMain: "#0B0A09",
      bgPanel: "#12100E",
      bgCard: "#171411",
      lineSoft: "#26221D",
      lineHard: "#342E27",

      accentMain: "#D6C3A3",
      accentSoft: "#BFAF93",
      accentDim: "#9E9079",

      textPrimary: "#F2EDE4",
      textSecondary: "#B7B0A3",
      textMuted: "#8A8376",

      statusGreat: "#D6C3A3",
      statusGood: "#9AA9BC",
      statusSlow: "#D1A95F",
      statusStop: "#C84B4B",
    },
  },
};
