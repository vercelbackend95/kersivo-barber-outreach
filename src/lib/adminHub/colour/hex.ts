/** Hex parse / format. Accepts #RGB and #RRGGBB. */

export const HEX_COLOUR_RE = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export function expandShortHex(value: string): string {
  const raw = value.trim();
  if (/^#[0-9A-Fa-f]{3}$/.test(raw)) {
    const r = raw[1]!;
    const g = raw[2]!;
    const b = raw[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return raw.toUpperCase();
}

export function normaliseHexColour(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!HEX_COLOUR_RE.test(trimmed)) return null;
  return expandShortHex(trimmed);
}

const RGB_COMMA =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|0?\.\d+|1(?:\.0+)?))?\s*\)$/i;
const RGB_SPACE =
  /^rgba?\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s*\/\s*(0|0?\.\d+|1(?:\.0+)?))?\s*\)$/i;

function channelToHex(r: number, g: number, b: number): string | null {
  if (![r, g, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return null;
  return srgbToHex(r / 255, g / 255, b / 255);
}

/**
 * Accept stored brand colours as #RGB, #RRGGBB, rgb() or rgba() (opaque only).
 * Returns a #RRGGBB hex for copy/display and a CSS value safe to bind as a fill.
 */
export function parseCssColour(value: string | null | undefined): { hex: string; css: string } | null {
  const hex = normaliseHexColour(value);
  if (hex) return { hex, css: hex };
  const raw = (value ?? '').trim();
  const match = raw.match(RGB_COMMA) ?? raw.match(RGB_SPACE);
  if (!match) return null;
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (!Number.isFinite(alpha) || alpha < 1) return null;
  const parsed = channelToHex(Number(match[1]), Number(match[2]), Number(match[3]));
  return parsed ? { hex: parsed, css: parsed } : null;
}

export function hexToSrgb(hex: string): { r: number; g: number; b: number } | null {
  const normalised = normaliseHexColour(hex);
  if (!normalised) return null;
  return {
    r: parseInt(normalised.slice(1, 3), 16) / 255,
    g: parseInt(normalised.slice(3, 5), 16) / 255,
    b: parseInt(normalised.slice(5, 7), 16) / 255,
  };
}

export function srgbToHex(r: number, g: number, b: number): string {
  const to = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export function isLightHex(hex: string): boolean {
  const rgb = hexToSrgb(hex);
  if (!rgb) return false;
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 0.627;
}
