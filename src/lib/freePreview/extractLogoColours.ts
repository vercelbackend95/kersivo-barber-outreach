/**
 * Dominant-colour extraction for "Pick from my logo".
 * Works on raw RGBA pixels so it can run in the browser (canvas) and in unit tests.
 * Ignores near-white, near-black and transparent pixels, then median-cut to ≤5 colours.
 */

export type RgbaImage = {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
};

export type ExtractedLogoColour = {
  hex: string;
  share: number;
};

const NEAR_WHITE = 245;
const NEAR_BLACK = 18;
const MIN_ALPHA = 32;
const MAX_COLOURS = 5;
const SAMPLE_STRIDE_TARGET = 12_000;

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function isIgnored(r: number, g: number, b: number, a: number): boolean {
  if (a < MIN_ALPHA) return true;
  if (r >= NEAR_WHITE && g >= NEAR_WHITE && b >= NEAR_WHITE) return true;
  if (r <= NEAR_BLACK && g <= NEAR_BLACK && b <= NEAR_BLACK) return true;
  return false;
}

type Pixel = { r: number; g: number; b: number };

function channelRange(pixels: Pixel[], channel: keyof Pixel): { min: number; max: number } {
  let min = 255;
  let max = 0;
  for (const p of pixels) {
    const v = p[channel];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

function average(pixels: Pixel[]): Pixel {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of pixels) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  const n = pixels.length || 1;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function medianCut(pixels: Pixel[], maxBuckets: number): Pixel[][] {
  if (pixels.length === 0) return [];
  let buckets: Pixel[][] = [pixels];
  while (buckets.length < maxBuckets) {
    let widest = -1;
    let widestRange = -1;
    let widestChannel: keyof Pixel = 'r';
    for (let i = 0; i < buckets.length; i += 1) {
      const bucket = buckets[i]!;
      if (bucket.length < 2) continue;
      for (const channel of ['r', 'g', 'b'] as const) {
        const { min, max } = channelRange(bucket, channel);
        const range = max - min;
        if (range > widestRange) {
          widestRange = range;
          widest = i;
          widestChannel = channel;
        }
      }
    }
    if (widest < 0 || widestRange < 8) break;
    const split = buckets[widest]!;
    split.sort((a, b) => a[widestChannel] - b[widestChannel]);
    const mid = Math.floor(split.length / 2);
    buckets.splice(widest, 1, split.slice(0, mid), split.slice(mid));
  }
  return buckets.filter((bucket) => bucket.length > 0);
}

function collectSamples(image: RgbaImage): Pixel[] {
  const { data, width, height } = image;
  const total = width * height;
  if (total <= 0) return [];
  const stride = Math.max(1, Math.ceil(total / SAMPLE_STRIDE_TARGET));
  const samples: Pixel[] = [];
  for (let i = 0; i < total; i += stride) {
    const offset = i * 4;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const a = data[offset + 3] ?? 0;
    if (isIgnored(r, g, b, a)) continue;
    samples.push({ r, g, b });
  }
  return samples;
}

/** Returns up to 5 hex colours, most common first. */
export function extractLogoColours(image: RgbaImage, max = MAX_COLOURS): ExtractedLogoColour[] {
  const samples = collectSamples(image);
  if (samples.length === 0) return [];
  const buckets = medianCut(samples, max);
  const ranked = buckets
    .map((bucket) => {
      const colour = average(bucket);
      return {
        hex: toHex(colour.r, colour.g, colour.b),
        share: bucket.length / samples.length,
      };
    })
    .sort((a, b) => b.share - a.share);

  const unique: ExtractedLogoColour[] = [];
  for (const row of ranked) {
    if (unique.some((item) => item.hex === row.hex)) continue;
    unique.push(row);
    if (unique.length >= max) break;
  }
  return unique;
}

export function extractLogoHexes(image: RgbaImage, max = MAX_COLOURS): string[] {
  return extractLogoColours(image, max).map((row) => row.hex);
}

export const HEX_COLOUR_RE = /^#[0-9A-Fa-f]{6}$/;

export function normaliseHexColour(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!HEX_COLOUR_RE.test(trimmed)) return null;
  return trimmed.toUpperCase();
}
