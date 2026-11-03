/**
 * WCAG 2.2 contrast and the one-tap “Make it deeper / lighter” auto-fix.
 */
import { hexToSrgb } from './hex';
import { clampToGamut, oklchToHex, hexToClampedOklch } from './space';
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

/** Website background lightness / chroma cap per tone (same hue as Main; neutral grey without one). */
export const SITE_BACKGROUND = {
  DARK: { L: 0.16, maxC: 0.03 },
  LIGHT: { L: 0.97, maxC: 0.015 },
} as const;

/** DARK = deep shade of Main's hue, LIGHT = near-white of the same hue. No Main → neutral grey. */
export function siteBackgroundHex(tone: BrandBackgroundTone, mainHex?: string | null): string {
  const spec = SITE_BACKGROUND[tone === 'LIGHT' ? 'LIGHT' : 'DARK'];
  const lch = mainHex ? hexToClampedOklch(mainHex) : null;
  if (!lch) return oklchToHex({ L: spec.L, C: 0, h: 0 });
  return oklchToHex({ L: spec.L, C: Math.min(lch.C, spec.maxC), h: lch.h });
}

/** Body text on the site background. */
export function siteTextHex(tone: BrandBackgroundTone): string {
  return tone === 'LIGHT' ? BUTTON_INK : '#F5F5F4';
}

export type ContrastLine = {
  /** WCAG ratio, e.g. 4.8 for 4.8:1. */
  ratio: number;
  pass: boolean;
  /** Same hue + chroma, nearest lightness that passes (null when it already passes or nothing does). */
  fixHex: string | null;
  fixLabel: 'deeper' | 'lighter' | null;
};

export type ContrastCheck = {
  buttonText: string;
  buttonRatio: number;
  buttonPass: boolean;
  mainRatio: number;
  mainPass: boolean;
  pass: boolean;
  /** First failing line's fix (button first). Kept for callers that show one fix. */
  fixLabel: 'deeper' | 'lighter' | null;
  fixHex: string | null;
  /** “Button text on accent” — null without an accent (then only Main is checked). */
  button: ContrastLine | null;
  /** “Main colour on background” — null without a Main colour. */
  main: ContrastLine | null;
  background: string;
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

function contrastLine(hex: string, ratio: number, pass: boolean, ok: (hex: string) => boolean): ContrastLine {
  if (pass) return { ratio, pass, fixHex: null, fixLabel: null };
  const lch = hexToClampedOklch(hex);
  const next = lch ? nearestPassingLightness(lch, ok) : null;
  if (!lch || !next) return { ratio, pass, fixHex: null, fixLabel: null };
  return { ratio, pass, fixHex: oklchToHex(next), fixLabel: next.L < lch.L ? 'deeper' : 'lighter' };
}

export function evaluateContrast(input: {
  mainHex: string | null;
  accentHex: string | null;
  tone: BrandBackgroundTone;
}): ContrastCheck {
  const bg = siteBackgroundHex(input.tone, input.mainHex);
  const accent = input.accentHex || null;
  const main = input.mainHex || null;
  const buttonText = accent ? betterButtonText(accent) : main ? betterButtonText(main) : BUTTON_WHITE;

  const button = accent
    ? contrastLine(accent, contrastRatio(betterButtonText(accent), accent), passesButton(accent), passesButton)
    : null;
  // The background follows Main's hue, so a fix re-derives it for each candidate.
  const mainLine = main
    ? contrastLine(main, contrastRatio(main, bg), passesMain(main, bg), (hex) =>
        passesMain(hex, siteBackgroundHex(input.tone, hex)),
      )
    : null;

  const buttonPass = button?.pass ?? true;
  const mainPass = mainLine?.pass ?? true;
  const first = button && !button.pass ? button : mainLine && !mainLine.pass ? mainLine : null;
  return {
    buttonText,
    buttonRatio: button?.ratio ?? 21,
    buttonPass,
    mainRatio: mainLine?.ratio ?? 21,
    mainPass,
    pass: buttonPass && mainPass,
    fixLabel: first?.fixLabel ?? null,
    fixHex: first?.fixHex ?? null,
    button,
    main: mainLine,
    background: bg,
  };
}

/** “4.8:1” — one decimal, never rounded up across the pass mark. */
export function formatContrastRatio(ratio: number): string {
  return `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1`;
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

/** Largest chroma inside sRGB at this lightness and hue. */
export function maxInGamutChroma(L: number, h: number): number {
  return clampToGamut({ L, C: 0.5, h }).C;
}

/** Intensity 0…1 = chroma relative to the most vivid in-gamut colour at the same L and hue. */
export function relativeChroma(lch: OkLch): number {
  const max = maxInGamutChroma(lch.L, lch.h);
  if (max <= 1e-4) return 0;
  return Math.max(0, Math.min(1, lch.C / max));
}

export function chromaFromRelative(L: number, h: number, intensity: number): number {
  return Math.max(0, Math.min(1, intensity)) * maxInGamutChroma(L, h);
}

export function sliderDepth(L: number): number {
  return Math.max(0, Math.min(1, 1 - L));
}

export function lightnessFromDepth(depth: number): number {
  return Math.max(0.08, Math.min(0.96, 1 - depth));
}
