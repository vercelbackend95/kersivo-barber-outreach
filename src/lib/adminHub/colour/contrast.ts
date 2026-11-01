/**
 * WCAG 2.2 contrast and the one-tap “Make it deeper / lighter” auto-fix.
 */
import { hexToSrgb, srgbToHex } from './hex';
import { clampToGamut, oklabToSrgb, oklchToHex, oklchToOklab, hexToClampedOklch } from './space';
import {
  BUTTON_INK,
  BUTTON_TEXT_RATIO,
  BUTTON_WHITE,
  MAIN_BG_RATIO,
  type BrandBackgroundTone,
  type OkLch,
} from './types';

export function relativeLuminance(hex: string): number {
  const rgb = hexToSrgb(hex);
  if (!rgb) return 0;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function betterButtonText(accentHex: string): typeof BUTTON_WHITE | typeof BUTTON_INK {
  const white = contrastRatio(BUTTON_WHITE, accentHex);
  const ink = contrastRatio(BUTTON_INK, accentHex);
  return white >= ink ? BUTTON_WHITE : BUTTON_INK;
}

export function siteBackgroundHex(tone: BrandBackgroundTone, mainHex?: string | null): string {
  if (tone === 'LIGHT') return '#F4EFE6';
  if (mainHex) {
    const lch = hexToClampedOklch(mainHex);
    if (lch) return oklchToHex({ L: 0.1, C: Math.min(lch.C * 0.25, 0.02), h: lch.h });
  }
  return '#0E1514';
}

export type ContrastCheck = {
  buttonText: string;
  buttonRatio: number;
  buttonPass: boolean;
  mainRatio: number;
  mainPass: boolean;
  pass: boolean;
  fixLabel: 'deeper' | 'lighter' | null;
  fixHex: string | null;
};

function passesButton(accentHex: string): boolean {
  const text = betterButtonText(accentHex);
  return contrastRatio(text, accentHex) >= BUTTON_TEXT_RATIO;
}

function passesMain(mainHex: string, bgHex: string): boolean {
  return contrastRatio(mainHex, bgHex) >= MAIN_BG_RATIO;
}

/** Search L (same hue + chroma, gamut-clamped) for the nearest value that satisfies `ok`. */
export function nearestPassingLightness(from: OkLch, ok: (hex: string) => boolean): OkLch | null {
  const start = clampToGamut(from);
  if (ok(oklchToHex(start))) return start;
  let best: { L: number; dist: number } | null = null;
  for (let i = 0; i <= 100; i += 1) {
    const L = i / 100;
    const candidate = clampToGamut({ ...start, L });
    const hex = oklchToHex(candidate);
    if (!ok(hex)) continue;
    const dist = Math.abs(candidate.L - start.L);
    if (!best || dist < best.dist - 1e-9) best = { L: candidate.L, dist };
  }
  return best ? clampToGamut({ ...start, L: best.L }) : null;
}

export function evaluateContrast(input: {
  mainHex: string | null;
  accentHex: string | null;
  tone: BrandBackgroundTone;
}): ContrastCheck {
  const bg = siteBackgroundHex(input.tone, input.mainHex);
  const accent = input.accentHex;
  const main = input.mainHex;
  const buttonText = accent ? betterButtonText(accent) : BUTTON_WHITE;
  const buttonRatio = accent ? contrastRatio(buttonText, accent) : 21;
  const buttonPass = !accent || buttonRatio >= BUTTON_TEXT_RATIO;
  const mainRatio = main ? contrastRatio(main, bg) : 21;
  const mainPass = !main || mainRatio >= MAIN_BG_RATIO;
  const pass = buttonPass && mainPass;

  let fixLabel: ContrastCheck['fixLabel'] = null;
  let fixHex: string | null = null;

  if (!pass) {
    const target = !buttonPass && accent ? accent : main;
    const lch = target ? hexToClampedOklch(target) : null;
    if (lch) {
      const ok = (hex: string) => {
        if (!buttonPass && accent) return passesButton(hex);
        return main ? passesMain(hex, bg) : true;
      };
      const next = nearestPassingLightness(lch, ok);
      if (next) {
        fixLabel = next.L < lch.L ? 'deeper' : 'lighter';
        fixHex = oklchToHex(next);
      }
    }
  }

  return { buttonText, buttonRatio, buttonPass, mainRatio, mainPass, pass, fixLabel, fixHex };
}

export function applyLightness(hex: string, L: number): string {
  const lch = hexToClampedOklch(hex);
  if (!lch) return hex;
  return oklchToHex(clampToGamut({ ...lch, L }));
}

export function applyChroma(hex: string, C: number): string {
  const lch = hexToClampedOklch(hex);
  if (!lch) return hex;
  return oklchToHex(clampToGamut({ ...lch, C: Math.max(0, C) }));
}

export function maxInGamutChroma(L: number, h: number): number {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 16; i += 1) {
    const mid = (lo + hi) / 2;
    if (hexToSrgb(oklchToHex({ L, C: mid, h }))) {
      const rgb = oklabToSrgb(oklchToOklab(clampToGamut({ L, C: mid, h })));
      const clamped = srgbToHex(rgb.r, rgb.g, rgb.b);
      const recovered = hexToClampedOklch(clamped);
      if (recovered && recovered.C >= mid - 0.002) lo = mid;
      else hi = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

export function sliderDepth(L: number): number {
  return Math.max(0, Math.min(1, 1 - L));
}

export function lightnessFromDepth(depth: number): number {
  return Math.max(0.08, Math.min(0.96, 1 - depth));
}
