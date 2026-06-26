/**
 * Extract barber chair from 0% illustration → transparent PNG.
 * Default: public/images/Ilustracje/0%.png → barber-chair.png
 *
 * Usage:
 *   node scripts/extract-barber-chair.mjs
 *   node scripts/extract-barber-chair.mjs path/to/source.png
 *   node scripts/extract-barber-chair.mjs --preview
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const LETTERBOX_DARK_MAX = 12;
const RED_KEY = { r: 215, g: 38, b: 56 };
const RED_TOLERANCE = 90;
const INPAINT_PASSES = 96;

/** Normalized ellipses [cx, cy, rx, ry] — barber chair silhouette (822×1024). */
const KEEP_ELLIPSES = [
  [0.5, 0.84, 0.24, 0.1],
  [0.5, 0.62, 0.3, 0.28],
  [0.47, 0.36, 0.2, 0.14],
  [0.63, 0.73, 0.22, 0.12],
  [0.33, 0.56, 0.1, 0.16],
  [0.67, 0.56, 0.1, 0.14],
];

/** Person + speech-bubble overlap to inpaint away. */
const INPAINT_ELLIPSES = [
  [0.48, 0.52, 0.36, 0.42],
  [0.64, 0.17, 0.26, 0.17],
  [0.45, 0.24, 0.16, 0.09],
];

  /** Props / scenery forced transparent. */
const CUT_ELLIPSES = [
  [0.18, 0.42, 0.16, 0.35],
  [0.12, 0.62, 0.12, 0.2],
  [0.22, 0.72, 0.14, 0.12],
  [0.82, 0.52, 0.14, 0.35],
  [0.72, 0.22, 0.2, 0.16],
  [0.45, 0.24, 0.14, 0.08],
];

/** Speech bubble (geometric — avoids slow cream flood). */
const BUBBLE_ELLIPSE = [0.64, 0.17, 0.28, 0.18];

function parseArgs() {
  let preview = false;
  let inputPath = path.join(root, 'public/images/Ilustracje/0%.png');
  let outputPath = path.join(root, 'public/images/Ilustracje/barber-chair.png');

  for (const arg of process.argv.slice(2)) {
    if (arg === '--preview') preview = true;
    else if (arg.startsWith('--out=')) {
      outputPath = path.isAbsolute(arg.slice(5))
        ? arg.slice(5)
        : path.join(root, arg.slice(5).replace(/^\//, ''));
    } else if (!arg.startsWith('--')) {
      inputPath = path.isAbsolute(arg) ? arg : path.join(root, arg.replace(/^\//, ''));
    }
  }

  return { preview, inputPath, outputPath };
}

function inEllipse(x, y, width, height, [cx, cy, rx, ry]) {
  const nx = (x + 0.5) / width;
  const ny = (y + 0.5) / height;
  const dx = (nx - cx) / rx;
  const dy = (ny - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function buildEllipseMask(width, height, ellipses) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      for (const e of ellipses) {
        if (inEllipse(x, y, width, height, e)) {
          mask[idx] = 1;
          break;
        }
      }
    }
  }
  return mask;
}

function colorDist(r, g, b, key) {
  return Math.hypot(r - key.r, g - key.g, b - key.b);
}

function isLetterbox(r, g, b) {
  return Math.max(r, g, b) <= LETTERBOX_DARK_MAX;
}

function isRedBg(r, g, b) {
  return r > 110 && g < 115 && b < 115 && r > g + 25 && r > b + 25;
}

function isChairMaterial(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 105 && min < 95) return true;
  if (r > 178 && g > 172 && b > 158 && g >= r - 20 && b > 145) return true;
  if (max < 135 && min > 48 && Math.abs(r - g) < 28 && Math.abs(g - b) < 38) return true;
  return false;
}

function isPersonPixel(r, g, b) {
  if (r > 200 && g > 115 && g < 205 && b < 100) return true;
  if (r > 200 && g > 155 && b > 100 && r - b > 35 && g - b < 90) return true;
  if (g > 65 && r < 135 && b < 135 && g > r + 12) return true;
  if (r > 130 && g > 100 && b < 110 && r > b + 35) return true;
  if (r > 215 && g > 200 && b > 130 && b < 215) return true;
  if (r > 95 && g > 70 && b < 75 && r > g + 10) return true;
  return false;
}

function isBubblePixel(r, g, b) {
  return r > 215 && g > 195 && b > 130 && b < 220;
}

function floodRedBackground(data, width, height, channels, keepMask) {
  const size = width * height;
  const isBg = new Uint8Array(size);
  const queue = [];

  for (let idx = 0; idx < size; idx++) {
    if (keepMask[idx]) continue;
    const i = idx * channels;
    if (isRedBg(data[i], data[i + 1], data[i + 2])) {
      isBg[idx] = 1;
      queue.push(idx);
    }
  }

  while (queue.length > 0) {
    const idx = queue.shift();
    const x = idx % width;
    const y = (idx - x) / width;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nidx = ny * width + nx;
      if (isBg[nidx]) continue;
      const ni = nidx * channels;
      const r = data[ni];
      const g = data[ni + 1];
      const b = data[ni + 2];
      if (isChairMaterial(r, g, b)) continue;
      if (isRedBg(r, g, b) || colorDist(r, g, b, RED_KEY) < RED_TOLERANCE) {
        isBg[nidx] = 1;
        queue.push(nidx);
      }
    }
  }

  return isBg;
}

function averageMaskedColor(data, width, height, channels, mask, predicate) {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let idx = 0; idx < width * height; idx++) {
    if (!mask[idx]) continue;
    const i = idx * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (predicate && !predicate(r, g, b)) continue;
    sr += r;
    sg += g;
    sb += b;
    n++;
  }
  if (n === 0) return [42, 44, 46];
  return [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
}

function fillInpaintRegion(work, width, height, channels, inpaintGeom, leather, cream) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!inpaintGeom[idx]) continue;
      const ny = (y + 0.5) / height;
      const i = idx * channels;
      const pick = ny < 0.4 ? cream : leather;
      work[i] = pick[0];
      work[i + 1] = pick[1];
      work[i + 2] = pick[2];
    }
  }
}

function dilateMask(mask, width, height, radius) {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

function inpaintDiffuse(data, width, height, channels, holeMask, passes) {
  const size = width * height;
  const work = Buffer.from(data);
  const offsets = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];

  for (let pass = 0; pass < passes; pass++) {
    const next = Buffer.from(work);
    let changed = 0;

    for (let idx = 0; idx < size; idx++) {
      if (!holeMask[idx]) continue;

      let sr = 0;
      let sg = 0;
      let sb = 0;
      let n = 0;

      for (const off of offsets) {
        const nidx = idx + off;
        if (nidx < 0 || nidx >= size) continue;
        if (holeMask[nidx]) continue;
        const ni = nidx * channels;
        sr += work[ni];
        sg += work[ni + 1];
        sb += work[ni + 2];
        n++;
      }

      if (n === 0) continue;

      const i = idx * channels;
      next[i] = Math.round(sr / n);
      next[i + 1] = Math.round(sg / n);
      next[i + 2] = Math.round(sb / n);
      changed++;
    }

    work.set(next);
    if (changed === 0) break;
  }

  return work;
}

function keepLargestComponent(alpha, width, height) {
  const size = width * height;
  const labels = new Int32Array(size);
  let nextLabel = 1;
  const sizes = new Map();

  for (let idx = 0; idx < size; idx++) {
    if (alpha[idx] < 16 || labels[idx]) continue;
    const label = nextLabel++;
    const queue = [idx];
    labels[idx] = label;
    let count = 0;

    while (queue.length > 0) {
      const cur = queue.pop();
      count++;
      const x = cur % width;
      const y = (cur - x) / width;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nidx = ny * width + nx;
        if (alpha[nidx] < 16 || labels[nidx]) continue;
        labels[nidx] = label;
        queue.push(nidx);
      }
    }

    sizes.set(label, count);
  }

  let bestLabel = 0;
  let bestSize = 0;
  for (const [label, count] of sizes) {
    if (count > bestSize) {
      bestSize = count;
      bestLabel = label;
    }
  }

  if (bestLabel === 0) return alpha;

  const cleaned = new Uint8Array(size);
  for (let idx = 0; idx < size; idx++) {
    cleaned[idx] = labels[idx] === bestLabel ? alpha[idx] : 0;
  }
  return cleaned;
}

function trimBounds(alpha, width, height, pad = 4) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX) return { left: 0, top: 0, width, height };

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function loadRgb(inputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const size = width * height;
  const rgb = Buffer.alloc(size * 3);

  for (let idx = 0; idx < size; idx++) {
    const src = idx * channels;
    const dst = idx * 3;
    rgb[dst] = data[src];
    rgb[dst + 1] = data[src + 1];
    rgb[dst + 2] = data[src + 2];
  }

  return { rgb, width, height };
}

function maskToRgba(mask, width, height, r, g, b) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let idx = 0; idx < width * height; idx++) {
    const dst = idx * 4;
    rgba[dst] = r;
    rgba[dst + 1] = g;
    rgba[dst + 2] = b;
    rgba[dst + 3] = mask[idx] ? 200 : 0;
  }
  return rgba;
}

async function main() {
  const { preview, inputPath, outputPath } = parseArgs();

  if (!fs.existsSync(inputPath)) {
    console.error('Source not found:', inputPath);
    process.exit(1);
  }

  const { rgb, width, height } = await loadRgb(inputPath);
  const channels = 3;
  const size = width * height;

  const keepMask = buildEllipseMask(width, height, KEEP_ELLIPSES);
  const cutMask = buildEllipseMask(width, height, CUT_ELLIPSES);
  const inpaintGeom = buildEllipseMask(width, height, INPAINT_ELLIPSES);
  const bubbleGeom = buildEllipseMask(width, height, [BUBBLE_ELLIPSE]);
  const redBg = floodRedBackground(rgb, width, height, channels, keepMask);

  const chairVisible = new Uint8Array(size);
  const inpaintMask = new Uint8Array(size);

  for (let idx = 0; idx < size; idx++) {
    if (!keepMask[idx]) continue;
    if (cutMask[idx]) continue;

    const i = idx * channels;
    const r = rgb[i];
    const g = rgb[i + 1];
    const b = rgb[i + 2];

    if (isLetterbox(r, g, b)) continue;
    if (redBg[idx]) continue;
    if (bubbleGeom[idx] || isBubblePixel(r, g, b)) continue;

    if (inpaintGeom[idx]) {
      inpaintMask[idx] = 1;
      continue;
    }

    if (isPersonPixel(r, g, b)) {
      inpaintMask[idx] = 1;
      continue;
    }

    if (isChairMaterial(r, g, b)) {
      chairVisible[idx] = 1;
    }
  }

  let inpaintExpanded = dilateMask(inpaintMask, width, height, 3);
  for (let idx = 0; idx < size; idx++) {
    if (chairVisible[idx]) inpaintExpanded[idx] = 0;
  }

  const leather = averageMaskedColor(rgb, width, height, channels, chairVisible, (r, g, b) => {
    return Math.max(r, g, b) < 105;
  });
  const cream = averageMaskedColor(rgb, width, height, channels, chairVisible, (r, g, b) => {
    return r > 178 && g > 172 && b > 158;
  });

  let work = Buffer.from(rgb);
  fillInpaintRegion(work, width, height, channels, inpaintGeom, leather, cream);

  const borderMask = new Uint8Array(size);
  for (let idx = 0; idx < size; idx++) {
    if (!inpaintGeom[idx]) continue;
    const x = idx % width;
    const y = (idx - x) / width;
    const touchesChair = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ].some(([nx, ny]) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false;
      return chairVisible[ny * width + nx] === 1;
    });
    if (touchesChair) borderMask[idx] = 1;
  }

  if (borderMask.reduce((n, v) => n + v, 0) > 0) {
    work = inpaintDiffuse(work, width, height, channels, borderMask, 32);
  }

  const alpha = new Uint8Array(size);
  for (let idx = 0; idx < size; idx++) {
    if (!keepMask[idx]) continue;
    if (cutMask[idx]) continue;
    const i = idx * channels;
    const r = work[i];
    const g = work[i + 1];
    const b = work[i + 2];
    if (isLetterbox(r, g, b)) continue;
    if (redBg[idx]) continue;
    if (bubbleGeom[idx]) continue;
    if (isPersonPixel(r, g, b)) continue;

    if (chairVisible[idx] || inpaintGeom[idx]) {
      alpha[idx] = 255;
    }
  }

  const alphaClean = keepLargestComponent(alpha, width, height);

  const bounds = trimBounds(alphaClean, width, height, 6);
  const rgba = Buffer.alloc(size * 4);
  for (let idx = 0; idx < size; idx++) {
    const src = idx * channels;
    const dst = idx * 4;
    rgba[dst] = work[src];
    rgba[dst + 1] = work[src + 1];
    rgba[dst + 2] = work[src + 2];
    rgba[dst + 3] = alphaClean[idx];
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract(bounds)
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  if (preview) {
    const previewDir = path.dirname(outputPath);
    const previews = [
      ['keep', keepMask, 80, 200, 80],
      ['inpaint', inpaintExpanded, 255, 120, 40],
      ['visible', alpha, 60, 140, 255],
    ];
    for (const [name, mask, cr, cg, cb] of previews) {
      const p = path.join(previewDir, `barber-chair-${name}-mask.png`);
      const buf = maskToRgba(mask, width, height, cr, cg, cb);
      await sharp(buf, { raw: { width, height, channels: 4 } }).png().toFile(p);
      console.log('preview', path.relative(root, p));
    }
  }

  const meta = await sharp(outputPath).metadata();
  console.log('wrote', path.relative(root, outputPath), {
    w: meta.width,
    h: meta.height,
    hasAlpha: meta.hasAlpha,
    bytes: fs.statSync(outputPath).size,
    inpaintPixels: inpaintExpanded.reduce((n, v) => n + v, 0),
    visiblePixels: alphaClean.reduce((n, v) => n + (v > 0 ? 1 : 0), 0),
    trim: bounds,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
