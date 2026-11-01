/**
 * Logo palette extraction: k-means++ (k=6, fixed seed, ≤12 iters),
 * merge ΔE_OK < 0.06, keep ≤5 by share, name, assign Main / Accent.
 */
import { hexToSrgb, srgbToHex } from './hex';
import { nameSwatch, isChromatic } from './name';
import {
  clampToGamut,
  deltaEok,
  hexToClampedOklch,
  hueDistance,
  oklabToOklch,
  oklabToSrgb,
  oklchToHex,
  srgbToOklab,
} from './space';
import {
  KMEANS_K,
  KMEANS_MAX_ITERS,
  KMEANS_SEED,
  MAX_SWATCHES,
  MERGE_DE_OK,
  MIN_ACCENT_SHARE,
  MIN_ALPHA,
  QUICK_PICK_COUNT,
  type AssignedRoles,
  type ExtractedSwatch,
  type OkLab,
  type OkLch,
  type RgbaImage,
} from './types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Sample = { lab: OkLab; rgb: { r: number; g: number; b: number } };

function collectSamples(image: RgbaImage): Sample[] {
  const { data, width, height } = image;
  const total = width * height;
  if (total <= 0) return [];
  const samples: Sample[] = [];
  for (let i = 0; i < total; i += 1) {
    const offset = i * 4;
    const a = (data[offset + 3] ?? 0) / 255;
    if (a < MIN_ALPHA) continue;
    const r = (data[offset] ?? 0) / 255;
    const g = (data[offset + 1] ?? 0) / 255;
    const b = (data[offset + 2] ?? 0) / 255;
    const rgb = { r, g, b };
    samples.push({ rgb, lab: srgbToOklab(rgb) });
  }
  return samples;
}

function kmeansPlusPlus(samples: Sample[], k: number, rand: () => number): OkLab[] {
  const first = samples[Math.floor(rand() * samples.length)]!.lab;
  const centres: OkLab[] = [{ ...first }];
  const dist = new Float64Array(samples.length);
  while (centres.length < k) {
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      let best = Infinity;
      for (const c of centres) {
        const d = deltaEok(samples[i]!.lab, c);
        if (d < best) best = d;
      }
      dist[i] = best * best;
      sum += dist[i]!;
    }
    if (sum <= 0) break;
    let pick = rand() * sum;
    let chosen = samples.length - 1;
    for (let i = 0; i < samples.length; i += 1) {
      pick -= dist[i]!;
      if (pick <= 0) {
        chosen = i;
        break;
      }
    }
    centres.push({ ...samples[chosen]!.lab });
  }
  return centres;
}

function runKmeans(samples: Sample[], k: number, seed: number): { centre: OkLab; count: number }[] {
  const targetK = Math.min(k, samples.length);
  if (targetK === 0) return [];
  const rand = mulberry32(seed);
  const centres = kmeansPlusPlus(samples, targetK, rand);
  const assign = new Int16Array(samples.length);
  for (let iter = 0; iter < KMEANS_MAX_ITERS; iter += 1) {
    let moved = 0;
    for (let i = 0; i < samples.length; i += 1) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centres.length; c += 1) {
        const d = deltaEok(samples[i]!.lab, centres[c]!);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        moved += 1;
      }
    }
    const acc = centres.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < samples.length; i += 1) {
      const bucket = acc[assign[i]!]!;
      const lab = samples[i]!.lab;
      bucket.L += lab.L;
      bucket.a += lab.a;
      bucket.b += lab.b;
      bucket.n += 1;
    }
    for (let c = 0; c < centres.length; c += 1) {
      const bucket = acc[c]!;
      if (bucket.n === 0) continue;
      centres[c] = { L: bucket.L / bucket.n, a: bucket.a / bucket.n, b: bucket.b / bucket.n };
    }
    if (iter > 0 && moved === 0) break;
  }
  const counts = new Array(centres.length).fill(0) as number[];
  for (let i = 0; i < samples.length; i += 1) counts[assign[i]!]! += 1;
  return centres.map((centre, i) => ({ centre, count: counts[i]! })).filter((row) => row.count > 0);
}

function mergeClusters(clusters: { centre: OkLab; count: number }[]): { centre: OkLab; count: number }[] {
  const rows = clusters.map((row) => ({ ...row }));
  let merged = true;
  while (merged && rows.length > 1) {
    merged = false;
    let bestI = -1;
    let bestJ = -1;
    let bestD = MERGE_DE_OK;
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const d = deltaEok(rows[i]!.centre, rows[j]!.centre);
        if (d < bestD) {
          bestD = d;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI < 0) break;
    const a = rows[bestI]!;
    const b = rows[bestJ]!;
    const n = a.count + b.count;
    const centre = {
      L: (a.centre.L * a.count + b.centre.L * b.count) / n,
      a: (a.centre.a * a.count + b.centre.a * b.count) / n,
      b: (a.centre.b * a.count + b.centre.b * b.count) / n,
    };
    rows.splice(bestJ, 1);
    rows[bestI] = { centre, count: n };
    merged = true;
  }
  return rows;
}

function clusterToSwatch(centre: OkLab, count: number, total: number): ExtractedSwatch {
  const rgb = oklabToSrgb(centre);
  const hex = srgbToHex(rgb.r, rgb.g, rgb.b);
  const oklch = clampToGamut(oklabToOklch(centre));
  return {
    hex,
    share: total > 0 ? count / total : 0,
    name: nameSwatch(oklch),
    oklch,
    chromatic: isChromatic(oklch),
  };
}

export function extractPalette(image: RgbaImage): ExtractedSwatch[] {
  const samples = collectSamples(image);
  if (samples.length === 0) return [];
  const clustered = runKmeans(samples, KMEANS_K, KMEANS_SEED);
  const merged = mergeClusters(clustered).sort((a, b) => b.count - a.count);
  const swatches: ExtractedSwatch[] = [];
  for (const row of merged) {
    const swatch = clusterToSwatch(row.centre, row.count, samples.length);
    if (swatches.some((existing) => existing.hex === swatch.hex)) continue;
    swatches.push(swatch);
    if (swatches.length >= MAX_SWATCHES) break;
  }
  return swatches;
}

export function assignDefaultRoles(swatches: ExtractedSwatch[]): AssignedRoles {
  const chromatic = swatches.filter((row) => row.chromatic);
  if (chromatic.length === 0) {
    return { main: null, accent: null, blackAndWhite: true };
  }
  const main = [...chromatic].sort((a, b) => b.share - a.share)[0]!;
  let accent: ExtractedSwatch | null = null;
  let bestDist = -1;
  for (const row of chromatic) {
    if (row.hex === main.hex) continue;
    if (row.share < MIN_ACCENT_SHARE) continue;
    const dist = hueDistance(row.oklch.h, main.oklch.h);
    if (dist > bestDist) {
      bestDist = dist;
      accent = row;
    }
  }
  return { main, accent, blackAndWhite: false };
}

export function lightnessSteps(hex: string, count = QUICK_PICK_COUNT): string[] {
  const lch = hexToClampedOklch(hex);
  if (!lch) return [];
  const lo = 0.16;
  const hi = 0.88;
  const steps: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const L = hi - (hi - lo) * t;
    steps.push(oklchToHex({ L, C: lch.C, h: lch.h }));
  }
  return steps;
}

export function depthGradient(hex: string): { lighter: string; mid: string; deeper: string } {
  const lch = hexToClampedOklch(hex);
  if (!lch) return { lighter: hex, mid: hex, deeper: hex };
  return {
    lighter: oklchToHex({ L: Math.min(0.88, lch.L + 0.22), C: lch.C, h: lch.h }),
    mid: hex,
    deeper: oklchToHex({ L: Math.max(0.12, lch.L - 0.22), C: lch.C, h: lch.h }),
  };
}

export function intensityGradient(hex: string): { muted: string; mid: string; vivid: string } {
  const lch = hexToClampedOklch(hex);
  if (!lch) return { muted: hex, mid: hex, vivid: hex };
  return {
    muted: oklchToHex({ L: lch.L, C: Math.max(0, lch.C * 0.15), h: lch.h }),
    mid: hex,
    vivid: oklchToHex({ L: lch.L, C: Math.max(lch.C, lch.C * 1.6 + 0.04), h: lch.h }),
  };
}

export function swatchFromHex(hex: string, share = 0): ExtractedSwatch | null {
  const rgb = hexToSrgb(hex);
  if (!rgb) return null;
  const oklch = hexToClampedOklch(hex);
  if (!oklch) return null;
  return {
    hex: srgbToHex(rgb.r, rgb.g, rgb.b),
    share,
    name: nameSwatch(oklch),
    oklch,
    chromatic: isChromatic(oklch),
  };
}
