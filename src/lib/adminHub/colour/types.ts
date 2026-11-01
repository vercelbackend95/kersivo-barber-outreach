/** Client-safe colour types (docs/admin-hub/ADMIN_HUB_SPEC.md §7). */

export type RgbaImage = {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
};

export type Srgb = { r: number; g: number; b: number };
export type OkLab = { L: number; a: number; b: number };
export type OkLch = { L: number; C: number; h: number };

export type ExtractedSwatch = {
  hex: string;
  share: number;
  name: string;
  oklch: OkLch;
  chromatic: boolean;
};

export type ColourRole = 'main' | 'accent';

export type AssignedRoles = {
  main: ExtractedSwatch | null;
  accent: ExtractedSwatch | null;
  blackAndWhite: boolean;
};

export type BrandBackgroundTone = 'DARK' | 'LIGHT';
export type BrandColoursSource = 'LOGO' | 'MANUAL' | 'KERSIVO_CHOOSES';

export const BRAND_BACKGROUND_TONES = ['DARK', 'LIGHT'] as const;
export const BRAND_COLOURS_SOURCES = ['LOGO', 'MANUAL', 'KERSIVO_CHOOSES'] as const;

export const BUTTON_INK = '#141414';
export const BUTTON_WHITE = '#FFFFFF';
export const BUTTON_TEXT_RATIO = 4.5;
export const MAIN_BG_RATIO = 3;

export const KMEANS_K = 6;
export const KMEANS_MAX_ITERS = 12;
export const KMEANS_SEED = 0x4b455253; // "KERS"
export const MERGE_DE_OK = 0.06;
export const MAX_SWATCHES = 5;
export const MIN_ACCENT_SHARE = 0.05;
export const NEAR_BLACK_L = 0.18;
export const NEAR_WHITE_L = 0.94;
export const LOW_CHROMA_C = 0.03;
export const MIN_ALPHA = 0.5;
export const QUICK_PICK_COUNT = 7;
