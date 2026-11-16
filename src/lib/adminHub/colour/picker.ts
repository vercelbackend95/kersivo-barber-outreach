/**
 * The Brand colours picker: one OKLCH hue at a time, laid out as a perceptual area.
 * - x: intensity, 0 = grey, 1 = the most vivid colour sRGB can show at that lightness and hue (always in gamut).
 * - y: lightness, top = light, bottom = deep (OKLCH L, so equal steps look equal).
 * The same maths paints the area, places the thumb and turns a pointer position back into a hex, so what the
 * owner sees under the thumb is exactly the colour they get.
 */
import { chromaFromRelative, maxInGamutChroma, relativeChroma } from './contrast';
import { hexToClampedOklch, linearToSrgb, oklchToHex, oklchToOklab, oklabToLinearSrgb } from './space';
import type { OkLch } from './types';

/** Lightness at the top and bottom of the area. Pure white / black are left out: they are not brand colours. */
export const PICKER_L_TOP = 0.97;
export const PICKER_L_BOTTOM = 0.14;
/** Below this chroma the hue is unreliable: keep the hue the owner last chose. */
export const PICKER_GREY_C = 0.02;
/** Hue shown for a role that has no colour yet (a warm red, the classic barber's pole). */
export const PICKER_DEFAULT_HUE = 25;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export type PickerPoint = { x: number; y: number; h: number };

export function lightnessAtY(y: number): number {
  return PICKER_L_TOP - clamp01(y) * (PICKER_L_TOP - PICKER_L_BOTTOM);
}

export function yForLightness(L: number): number {
  return clamp01((PICKER_L_TOP - L) / (PICKER_L_TOP - PICKER_L_BOTTOM));
}

/** Where a colour sits in the area. `hueFallback` is used for greys (they have no hue of their own). */
export function pickerPoint(hex: string, hueFallback: number | null = null): PickerPoint | null {
  const lch = hexToClampedOklch(hex);
  if (!lch) return null;
  const h = lch.C < PICKER_GREY_C && hueFallback !== null ? hueFallback : lch.h;
  return { x: relativeChroma({ ...lch, h }), y: yForLightness(lch.L), h };
}

export function oklchAtPoint(point: PickerPoint): OkLch {
  const L = lightnessAtY(point.y);
  return { L, C: chromaFromRelative(L, point.h, clamp01(point.x)), h: point.h };
}

export function hexAtPoint(point: PickerPoint): string {
  return oklchToHex(oklchAtPoint(point));
}

/** Same lightness and intensity, another hue. A grey picks up some colour so the hue change is visible. */
export function withHue(hex: string, h: number, hueFallback: number | null = null): string | null {
  const point = pickerPoint(hex, hueFallback);
  if (!point) return null;
  const x = point.x < 0.08 ? 0.6 : point.x;
  return hexAtPoint({ x, y: point.y, h });
}

/** The hue strip: every hue at one lively lightness, so the strip reads as a rainbow, never as mud. */
export function hueStripGradient(steps = 24): string {
  const stops: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const h = (i / steps) * 360;
    stops.push(`${oklchToHex({ L: 0.72, C: chromaFromRelative(0.72, h, 0.9), h })} ${((i / steps) * 100).toFixed(2)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function hueSwatch(h: number): string {
  return oklchToHex({ L: 0.72, C: chromaFromRelative(0.72, h, 0.9), h });
}

/**
 * Seven shades of the same colour, light → deep. Intensity is kept relative to what each lightness can hold,
 * so the light and deep ends stay the same colour instead of washing out to grey.
 */
export function shadeSteps(hex: string, count = 7, hueFallback: number | null = null): string[] {
  const point = pickerPoint(hex, hueFallback);
  if (!point) return [];
  const top = 0.9;
  const bottom = 0.24;
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const L = top - (top - bottom) * t;
    const hex = hexAtPoint({ x: point.x, y: yForLightness(L), h: point.h });
    if (!out.includes(hex)) out.push(hex);
  }
  return out;
}

/** WCAG relative luminance straight from linear sRGB (the area painter has it before gamma). */
export function luminanceFromLinear(r: number, g: number, b: number): number {
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

export type PickerPaintOptions = {
  width: number;
  height: number;
  hue: number;
  /** Returns false where the colour is hard to read (given its relative luminance and OKLCH). Those pixels are hatched. */
  readable?: ((luminance: number, lch: OkLch) => boolean) | null;
  /** Hatch spacing in device pixels. */
  stripe?: number;
};

/**
 * Paint the picker area into an RGBA buffer (width × height × 4). The hard-to-read part is striped and its edge
 * drawn as a thin line, so the owner can see where the readable colours are before they pick.
 */
export function paintPickerArea(out: Uint8ClampedArray, options: PickerPaintOptions): void {
  const { width, height, hue, readable } = options;
  const stripe = Math.max(4, options.stripe ?? 9);
  const rad = (hue * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pass = readable ? new Uint8Array(width * height) : null;
  for (let py = 0; py < height; py += 1) {
    const L = lightnessAtY(height <= 1 ? 0 : py / (height - 1));
    const maxC = maxInGamutChroma(L, hue);
    for (let px = 0; px < width; px += 1) {
      const C = (width <= 1 ? 0 : px / (width - 1)) * maxC;
      const lin = oklabToLinearSrgb({ L, a: C * cos, b: C * sin });
      const i = (py * width + px) * 4;
      out[i] = Math.round(clamp01(linearToSrgb(clamp01(lin.r))) * 255);
      out[i + 1] = Math.round(clamp01(linearToSrgb(clamp01(lin.g))) * 255);
      out[i + 2] = Math.round(clamp01(linearToSrgb(clamp01(lin.b))) * 255);
      out[i + 3] = 255;
      if (pass && readable) pass[py * width + px] = readable(luminanceFromLinear(lin.r, lin.g, lin.b), { L, C, h: hue }) ? 1 : 0;
    }
  }
  if (!pass) return;
  for (let py = 0; py < height; py += 1) {
    const L = lightnessAtY(height <= 1 ? 0 : py / (height - 1));
    // Stripes and edge go dark on light colours and light on dark ones, so they show on every part of the area.
    const ink = L > 0.6 ? 0 : 255;
    for (let px = 0; px < width; px += 1) {
      const k = py * width + px;
      const i = k * 4;
      const ok = pass[k] === 1;
      const edge =
        (py > 0 && pass[k - width] !== pass[k]) || (px > 0 && pass[k - 1] !== pass[k]);
      let mix = 0;
      if (edge) mix = 0.7;
      else if (!ok && (px + py) % stripe < Math.max(1, Math.round(stripe / 4))) mix = 0.32;
      if (!mix) continue;
      out[i] = Math.round(out[i]! + (ink - out[i]!) * mix);
      out[i + 1] = Math.round(out[i + 1]! + (ink - out[i + 1]!) * mix);
      out[i + 2] = Math.round(out[i + 2]! + (ink - out[i + 2]!) * mix);
    }
  }
}

/** Linear-light colour for a hex-free OKLCH (used by the readability tests of the area). */
export function oklchLuminance(lch: OkLch): number {
  const lin = oklabToLinearSrgb(oklchToOklab(lch));
  return luminanceFromLinear(lin.r, lin.g, lin.b);
}
