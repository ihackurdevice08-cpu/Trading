export type NavLayout = "top" | "side";
export type BgType = "none" | "image" | "video";
export type BgFit = "cover" | "contain";

export type AppearanceSettings = {
  themeId: "linen" | "resort" | "noir" | "vault" | "dune";
  navLayout: NavLayout;

  // global background media (account-bound)
  bgType: BgType;
  bgUrl: string;          // public URL (Supabase storage publicUrl or pasted URL)
  bgFit: BgFit;
  bgOpacity: number;      // 0..1
  bgBlurPx: number;       // 0..24
  bgDim: number;          // 0..0.9

  // for future: ticker toggles etc.
  showRow1Status?: boolean;
  showRow2Links?: boolean;
  showRow3Rules?: boolean;
  showRow2AssetPerf?: boolean;
  showRow3Behavior?: boolean;
  showRow4Overtrade?: boolean;
  bg?: { enabled?: boolean; fit?: "cover" | "contain"; url?: string | null };
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: "linen",
  navLayout: "top",

  bgType: "none",
  bgUrl: "",
  bgFit: "cover",
  bgOpacity: 0.22,
  bgBlurPx: 0,
  bgDim: 0.45,
};

// ---- auto patch ----
export type __BgPatch = {
  opacity?: number;
  dim?: number;
  blurPx?: number;
  type?: string;
}
