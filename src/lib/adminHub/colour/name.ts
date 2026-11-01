import { LOW_CHROMA_C, NEAR_BLACK_L, NEAR_WHITE_L, type OkLch } from './types';

export function isChromatic(lch: OkLch): boolean {
  if (lch.L < NEAR_BLACK_L || lch.L > NEAR_WHITE_L) return false;
  if (lch.C < LOW_CHROMA_C) return false;
  return true;
}

/**
 * Small fixed name table by hue / lightness (spec §7).
 * Near-black → Ink, near-white → Cream, low-chroma → Grey / Charcoal.
 */
export function nameSwatch(lch: OkLch): string {
  // #141414 in the mockup is Ink; OKLab L sits just over 0.18.
  if (lch.L < 0.2) return 'Ink';
  if (lch.L > NEAR_WHITE_L) return 'Cream';
  if (lch.C < LOW_CHROMA_C) return lch.L < 0.35 ? 'Charcoal' : lch.L > 0.72 ? 'Cream' : 'Grey';

  const h = ((lch.h % 360) + 360) % 360;
  if (h < 18 || h >= 345) return 'Red';
  if (h < 50) return 'Copper';
  if (h < 95) return 'Brass';
  if (h < 125) return 'Olive';
  if (h < 160) return 'Green';
  if (h < 205) return 'Teal';
  if (h < 240) return lch.L < 0.38 ? 'Navy' : 'Blue';
  if (h < 275) return lch.L < 0.38 ? 'Navy' : 'Indigo';
  if (h < 315) return 'Purple';
  return 'Pink';
}
