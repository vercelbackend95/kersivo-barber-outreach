/**
 * sRGB ↔ linear ↔ OKLab ↔ OKLCH, ΔE_OK, and chroma-reduce gamut clamp.
 * Matrices from Björn Ottosson (https://bottosson.github.io/posts/oklab/).
 */
import { hexToSrgb, srgbToHex } from './hex';
import type { OkLab, OkLch, Srgb } from './types';

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

export function srgbToOklab(rgb: Srgb): OkLab {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

export function oklabToLinearSrgb(lab: OkLab): Srgb {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.2914855480 * lab.b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

export function oklabToSrgb(lab: OkLab): Srgb {
  const lin = oklabToLinearSrgb(lab);
  return { r: linearToSrgb(lin.r), g: linearToSrgb(lin.g), b: linearToSrgb(lin.b) };
}

export function oklabToOklch(lab: OkLab): OkLch {
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L: lab.L, C, h };
}

export function oklchToOklab(lch: OkLch): OkLab {
  const h = (lch.h * Math.PI) / 180;
  return { L: lch.L, a: lch.C * Math.cos(h), b: lch.C * Math.sin(h) };
}

export function hexToOklab(hex: string): OkLab | null {
  const rgb = hexToSrgb(hex);
  return rgb ? srgbToOklab(rgb) : null;
}

export function hexToOklch(hex: string): OkLch | null {
  const lab = hexToOklab(hex);
  return lab ? oklabToOklch(lab) : null;
}

export function isInGamut(lab: OkLab): boolean {
  const lin = oklabToLinearSrgb(lab);
  const eps = 1e-4;
  return (
    lin.r >= -eps &&
    lin.r <= 1 + eps &&
    lin.g >= -eps &&
    lin.g <= 1 + eps &&
    lin.b >= -eps &&
    lin.b <= 1 + eps
  );
}

/** Reduce chroma until the colour is inside sRGB. Hue and lightness stay put. */
export function clampToGamut(lch: OkLch): OkLch {
  const L = Math.max(0, Math.min(1, lch.L));
  if (lch.C <= 1e-6) return { L, C: 0, h: lch.h };
  const hiLab = oklchToOklab({ L, C: lch.C, h: lch.h });
  if (isInGamut(hiLab)) return { L, C: lch.C, h: lch.h };
  let lo = 0;
  let hi = lch.C;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    if (isInGamut(oklchToOklab({ L, C: mid, h: lch.h }))) lo = mid;
    else hi = mid;
  }
  return { L, C: lo, h: lch.h };
}

export function oklchToHex(lch: OkLch): string {
  const clamped = clampToGamut(lch);
  const rgb = oklabToSrgb(oklchToOklab(clamped));
  return srgbToHex(rgb.r, rgb.g, rgb.b);
}

export function hexToClampedOklch(hex: string): OkLch | null {
  const lch = hexToOklch(hex);
  return lch ? clampToGamut(lch) : null;
}

export function deltaEok(a: OkLab, b: OkLab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function mixOklab(a: OkLab, b: OkLab, t: number): OkLab {
  return {
    L: a.L + (b.L - a.L) * t,
    a: a.a + (b.a - a.a) * t,
    b: a.b + (b.b - a.b) * t,
  };
}
