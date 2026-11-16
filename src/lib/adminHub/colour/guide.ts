/**
 * “Easy to read?” — the readability guide of the Brand colours app.
 *
 * Two checks must pass (WCAG 2.2 AA): text on the Book button (4.5:1) and Main against the website background
 * (3:1, colour blocks and large text). Three more are tips: accent details on the background, Book standing out
 * from the Main header, and Main / Accent staying different for red-green colour-blind visitors.
 * Every check that can be fixed carries the nearest colour that fixes it (same hue, only lightness moves), and
 * Main / Accent fixes try to satisfy all of that role's checks at once so two fixes never fight.
 */
import { betterButtonText, chromaFromRelative, contrastRatio, nearestPassingLightness, siteBackgroundHex } from './contrast';
import { nameSwatch } from './name';
import { deltaEok, hexToClampedOklch, hexToOklab, linearToSrgb, oklchToHex, srgbToLinear, srgbToOklab } from './space';
import { hexToSrgb } from './hex';
import { BUTTON_TEXT_RATIO, MAIN_BG_RATIO, type BrandBackgroundTone, type ColourRole, type OkLch } from './types';

export const ACCENT_BG_RATIO = 3;
/** ΔE_OK below this: Book does not stand out from the Main header (unless the lightness contrast carries it). */
export const DISTINCT_DE_OK = 0.12;
export const DISTINCT_MIN_RATIO = 1.8;
/** ΔE_OK between the colour-blind simulations of Main and Accent below this reads as “the same colour”. */
export const COLOUR_BLIND_DE_OK = 0.06;

export type GuideCheckId = 'button' | 'main' | 'accentBg' | 'distinct' | 'colourBlind';
export type GuideLevel = 'required' | 'tip';

export type GuideFix =
  | { kind: 'colour'; role: ColourRole; hex: string; direction: 'deeper' | 'lighter' }
  | { kind: 'accent'; hex: string; name: string };

export type GuideCheck = {
  id: GuideCheckId;
  level: GuideLevel;
  pass: boolean;
  /** WCAG contrast ratio of the pair (null for the colour-difference tips). */
  ratio: number | null;
  /** Ratio the check needs (null for the colour-difference tips). */
  needs: number | null;
  /** The pair the check is about, to draw a live sample. */
  sample: { background: string; foreground: string };
  fix: GuideFix | null;
};

export type GuideToneSwitch = { tone: BrandBackgroundTone };

export type GuideReport = {
  checks: GuideCheck[];
  /** Required checks that fail. */
  failing: number;
  /** Tips that do not pass. */
  tips: number;
  /** One edit that applies every colour fix of the failing required checks (null when nothing to fix). */
  fixAll: { main?: string; accent?: string } | null;
  /** The other background passes every required check that fails now. */
  toneSwitch: GuideToneSwitch | null;
  background: string;
};

/* ---------------------------------------------------------------- colour-blind simulation */

/** Viénot, Brettel & Mollon (1999) in linear sRGB. Deuteranopia and protanopia cover red-green colour blindness. */
const DEUTAN = [0.29275, 0.70725, 0, 0.29275, 0.70725, 0, -0.02234, 0.02234, 1] as const;
const PROTAN = [0.11238, 0.88762, 0, 0.11238, 0.88762, 0, 0.00401, -0.00401, 1] as const;

export type VisionKind = 'deuteranopia' | 'protanopia';

export function simulateVision(hex: string, kind: VisionKind): string | null {
  const rgb = hexToSrgb(hex);
  if (!rgb) return null;
  const m = kind === 'protanopia' ? PROTAN : DEUTAN;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const to = (c: number) =>
    Math.round(Math.max(0, Math.min(1, linearToSrgb(Math.max(0, Math.min(1, c))))) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(m[0] * r + m[1] * g + m[2] * b)}${to(m[3] * r + m[4] * g + m[5] * b)}${to(m[6] * r + m[7] * g + m[8] * b)}`.toUpperCase();
}

/** The SVG feColorMatrix values for the same simulations (rows of 5; feColorMatrix works in linear RGB). */
export function visionMatrix(kind: VisionKind): string {
  const m = kind === 'protanopia' ? PROTAN : DEUTAN;
  return `${m[0]} ${m[1]} ${m[2]} 0 0  ${m[3]} ${m[4]} ${m[5]} 0 0  ${m[6]} ${m[7]} ${m[8]} 0 0  0 0 0 1 0`;
}

function oklabOf(hex: string) {
  const rgb = hexToSrgb(hex);
  return rgb ? srgbToOklab(rgb) : null;
}

/** Smallest Main ↔ Accent difference a red-green colour-blind visitor sees. */
export function colourBlindDifference(mainHex: string, accentHex: string): number {
  let min = Infinity;
  for (const kind of ['deuteranopia', 'protanopia'] as const) {
    const a = oklabOf(simulateVision(mainHex, kind) ?? mainHex);
    const b = oklabOf(simulateVision(accentHex, kind) ?? accentHex);
    if (a && b) min = Math.min(min, deltaEok(a, b));
  }
  return min;
}

/* ---------------------------------------------------------------- predicates */

export function buttonTextPasses(accentHex: string): boolean {
  return contrastRatio(betterButtonText(accentHex), accentHex) >= BUTTON_TEXT_RATIO;
}

export function mainOnBackgroundPasses(mainHex: string, tone: BrandBackgroundTone): boolean {
  return contrastRatio(mainHex, siteBackgroundHex(tone, mainHex)) >= MAIN_BG_RATIO;
}

export function accentOnBackgroundPasses(accentHex: string, backgroundHex: string): boolean {
  return contrastRatio(accentHex, backgroundHex) >= ACCENT_BG_RATIO;
}

export function standsOut(mainHex: string, accentHex: string): boolean {
  const a = hexToOklab(mainHex);
  const b = hexToOklab(accentHex);
  if (!a || !b) return true;
  return deltaEok(a, b) >= DISTINCT_DE_OK || contrastRatio(mainHex, accentHex) >= DISTINCT_MIN_RATIO;
}

export function colourBlindSafe(mainHex: string, accentHex: string): boolean {
  // Already hard to tell apart for everyone: that is the “stands out” tip, not this one.
  if (!standsOut(mainHex, accentHex)) return true;
  return colourBlindDifference(mainHex, accentHex) >= COLOUR_BLIND_DE_OK || contrastRatio(mainHex, accentHex) >= DISTINCT_MIN_RATIO;
}

/* ---------------------------------------------------------------- fixes */

function nearestFix(hex: string, ok: (hex: string) => boolean): { hex: string; direction: 'deeper' | 'lighter' } | null {
  const lch = hexToClampedOklch(hex);
  if (!lch) return null;
  const next = nearestPassingLightness(lch, ok);
  if (!next) return null;
  const out = oklchToHex(next);
  if (out === hex) return null;
  return { hex: out, direction: next.L < lch.L ? 'deeper' : 'lighter' };
}

/** Prefer a fix that keeps every check of the role passing; fall back to the one check. */
function roleFix(hex: string, all: (hex: string) => boolean, one: (hex: string) => boolean) {
  return nearestFix(hex, all) ?? nearestFix(hex, one);
}

/* ---------------------------------------------------------------- suggestions */

export type AccentSuggestion = { hex: string; name: string };

/**
 * Accents that go with Main: opposite, split-opposite and neighbouring hues, plus brass (a barbershop classic).
 * Each is moved to the nearest lightness where Book text is easy to read, it shows on the background, it stands
 * out from Main and stays different for colour-blind visitors.
 */
export function accentSuggestions(input: {
  mainHex: string;
  tone: BrandBackgroundTone;
  exclude?: Array<string | null | undefined>;
  limit?: number;
}): AccentSuggestion[] {
  const main = hexToClampedOklch(input.mainHex);
  if (!main) return [];
  const bg = siteBackgroundHex(input.tone, input.mainHex);
  const ok = (hex: string) =>
    buttonTextPasses(hex) &&
    accentOnBackgroundPasses(hex, bg) &&
    standsOut(input.mainHex, hex) &&
    colourBlindSafe(input.mainHex, hex);
  const startL = input.tone === 'LIGHT' ? 0.5 : 0.74;
  const offsets = main.C < 0.03 ? [0, 25, 85, 150, 200, 250] : [180, 150, 210, 40, -40];
  const hues = offsets.map((d) => (((main.h + d) % 360) + 360) % 360);
  hues.push(85); // brass
  const out: AccentSuggestion[] = [];
  const exclude = (input.exclude ?? []).filter(Boolean).map((hex) => hex!.toUpperCase());
  for (const h of hues) {
    const seed: OkLch = { L: startL, C: chromaFromRelative(startL, h, 0.78), h };
    const next = nearestPassingLightness(seed, ok);
    if (!next) continue;
    const hex = oklchToHex(next);
    if (exclude.includes(hex)) continue;
    const lab = hexToOklab(hex)!;
    if (out.some((row) => deltaEok(hexToOklab(row.hex)!, lab) < 0.06)) continue;
    out.push({ hex, name: nameSwatch(next) });
    if (out.length >= (input.limit ?? 5)) break;
  }
  return out;
}

/** Ready-made Main + Accent + background sets for a shop without logo colours. All pass the required checks. */
export const BARBERSHOP_PAIRS: ReadonlyArray<{ id: string; label: string; main: string; accent: string; tone: BrandBackgroundTone }> = [
  { id: 'oxblood-brass', label: 'Oxblood & brass', main: '#7A1F2B', accent: '#C9A24A', tone: 'LIGHT' },
  { id: 'navy-copper', label: 'Navy & copper', main: '#1D3557', accent: '#A9542A', tone: 'LIGHT' },
  { id: 'forest-cream', label: 'Forest & cream', main: '#2D5A3D', accent: '#E3C58E', tone: 'LIGHT' },
  { id: 'charcoal-red', label: 'Charcoal & pole red', main: '#2B2B2E', accent: '#C8102E', tone: 'LIGHT' },
  { id: 'brass-oxblood', label: 'Brass on black', main: '#C9A24A', accent: '#9B2335', tone: 'DARK' },
  { id: 'teal-sand', label: 'Teal & sand', main: '#4FA3A0', accent: '#E8D5B0', tone: 'DARK' },
];

/* ---------------------------------------------------------------- report */

export function readabilityReport(input: {
  mainHex: string | null;
  accentHex: string | null;
  tone: BrandBackgroundTone;
}): GuideReport {
  const main = input.mainHex || null;
  const accent = input.accentHex || null;
  const tone = input.tone;
  const background = siteBackgroundHex(tone, main);
  const checks: GuideCheck[] = [];

  const accentAll = (hex: string) =>
    buttonTextPasses(hex) && (!main || (accentOnBackgroundPasses(hex, background) && standsOut(main, hex)));
  const mainAll = (hex: string) =>
    mainOnBackgroundPasses(hex, tone) && (!accent || standsOut(hex, accent));

  if (accent) {
    const text = betterButtonText(accent);
    const ratio = contrastRatio(text, accent);
    const pass = ratio >= BUTTON_TEXT_RATIO;
    const fix = pass ? null : roleFix(accent, accentAll, buttonTextPasses);
    checks.push({
      id: 'button',
      level: 'required',
      pass,
      ratio,
      needs: BUTTON_TEXT_RATIO,
      sample: { background: accent, foreground: text },
      fix: fix ? { kind: 'colour', role: 'accent', ...fix } : null,
    });
  }

  if (main) {
    const ratio = contrastRatio(main, background);
    const pass = ratio >= MAIN_BG_RATIO;
    const fix = pass ? null : roleFix(main, mainAll, (hex) => mainOnBackgroundPasses(hex, tone));
    checks.push({
      id: 'main',
      level: 'required',
      pass,
      ratio,
      needs: MAIN_BG_RATIO,
      sample: { background, foreground: main },
      fix: fix ? { kind: 'colour', role: 'main', ...fix } : null,
    });
  }

  if (accent && main) {
    const ratio = contrastRatio(accent, background);
    const pass = ratio >= ACCENT_BG_RATIO;
    const fix = pass ? null : roleFix(accent, accentAll, (hex) => accentOnBackgroundPasses(hex, background));
    checks.push({
      id: 'accentBg',
      level: 'tip',
      pass,
      ratio,
      needs: ACCENT_BG_RATIO,
      sample: { background, foreground: accent },
      fix: fix ? { kind: 'colour', role: 'accent', ...fix } : null,
    });

    const distinct = standsOut(main, accent);
    const suggestion = distinct ? null : accentSuggestions({ mainHex: main, tone, exclude: [accent], limit: 1 })[0] ?? null;
    checks.push({
      id: 'distinct',
      level: 'tip',
      pass: distinct,
      ratio: null,
      needs: null,
      sample: { background: main, foreground: accent },
      fix: suggestion ? { kind: 'accent', ...suggestion } : null,
    });

    const safe = colourBlindSafe(main, accent);
    const cbSuggestion = safe ? null : accentSuggestions({ mainHex: main, tone, exclude: [accent], limit: 1 })[0] ?? null;
    checks.push({
      id: 'colourBlind',
      level: 'tip',
      pass: safe,
      ratio: null,
      needs: null,
      sample: {
        background: simulateVision(main, 'deuteranopia') ?? main,
        foreground: simulateVision(accent, 'deuteranopia') ?? accent,
      },
      fix: cbSuggestion ? { kind: 'accent', ...cbSuggestion } : null,
    });
  }

  const failingRequired = checks.filter((row) => row.level === 'required' && !row.pass);
  const fixAll: { main?: string; accent?: string } = {};
  for (const row of failingRequired) {
    if (row.fix?.kind === 'colour') fixAll[row.fix.role] = row.fix.hex;
  }
  const hasFixAll = Object.keys(fixAll).length > 0 && failingRequired.length > 1;

  // Main failing on this background but fine on the other one: offer the switch instead of changing the colour.
  let toneSwitch: GuideToneSwitch | null = null;
  const mainCheck = checks.find((row) => row.id === 'main');
  if (main && mainCheck && !mainCheck.pass) {
    const other: BrandBackgroundTone = tone === 'LIGHT' ? 'DARK' : 'LIGHT';
    if (mainOnBackgroundPasses(main, other)) toneSwitch = { tone: other };
  }

  return {
    checks,
    failing: failingRequired.length,
    tips: checks.filter((row) => row.level === 'tip' && !row.pass).length,
    fixAll: hasFixAll ? fixAll : null,
    toneSwitch,
    background,
  };
}

/** 0…1 position on the guide meter: 1:1 at the left, 7:1 (WCAG AAA) at the right. */
export function contrastMeter(ratio: number): number {
  return Math.max(0, Math.min(1, (ratio - 1) / 6));
}

export function hueName(h: number): string {
  return nameSwatch({ L: 0.6, C: 0.12, h });
}

