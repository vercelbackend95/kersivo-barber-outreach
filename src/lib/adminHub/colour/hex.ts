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
