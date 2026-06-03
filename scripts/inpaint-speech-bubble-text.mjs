/**
 * Remove baked-in black lettering inside a cream speech-bubble PNG.
 * Default: public/images/Ilustracje/bubble.png (overwrites + writes .webp).
 *
 * Usage:
 *   node scripts/inpaint-speech-bubble-text.mjs
 *   node scripts/inpaint-speech-bubble-text.mjs --dry-run
 *   node scripts/inpaint-speech-bubble-text.mjs path/to/bubble.png --text-threshold=175 --ink-threshold=72
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const EDGE_DARK_MAX = 48;
const INPAINT_PASSES = 64;
const MEDIAN_BLEND = 0.3;

function parseArgs() {
  let dryRun = false;
  let textThreshold = 175;
  let inkThreshold = 72;
  let textDilate = 2;
  let inputPath = path.join(root, "public/images/Ilustracje/bubble.png");

  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--text-threshold=")) {
      textThreshold = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--text-dilate=")) {
      textDilate = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--ink-threshold=")) {
      inkThreshold = Number(arg.split("=")[1]);
    } else if (!arg.startsWith("--")) {
      inputPath = path.isAbsolute(arg) ? arg : path.join(root, arg.replace(/^\//, ""));
    }
  }

  return { dryRun, textThreshold, textDilate, inkThreshold, inputPath };
}

function isLetterbox(r, g, b) {
  return Math.max(r, g, b) <= EDGE_DARK_MAX;
}

function isCream(r, g, b) {
  if (isLetterbox(r, g, b)) return false;
  return r > 140 && g > 120 && b < 220;
}

function isTextPixel(r, g, b, textThreshold) {
  const max = Math.max(r, g, b);
  if (max >= textThreshold) return false;
  if (isCream(r, g, b)) return false;
  return true;
}

/** Flood cream from center seed; includes dark ink connected to interior. */
function buildInteriorMask(data, width, height, channels) {
  const size = width * height;
  const interior = new Uint8Array(size);
  const cx = Math.floor(width * 0.5);
  const cy = Math.floor(height * 0.42);
  const queue = [];
  const visited = new Uint8Array(size);

  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const idx = y * width + x;
      const i = idx * channels;
      if (isCream(data[i], data[i + 1], data[i + 2])) queue.push(idx);
    }
  }

  while (queue.length > 0) {
    const idx = queue.shift();
    if (visited[idx]) continue;
    visited[idx] = 1;

    const i = idx * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isLetterbox(r, g, b)) continue;

    const max = Math.max(r, g, b);
    if (!isCream(r, g, b) && max >= 95) continue;

    interior[idx] = 1;

    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) queue.push(idx - 1);
    if (x < width - 1) queue.push(idx + 1);
    if (y > 0) queue.push(idx - width);
    if (y < height - 1) queue.push(idx + width);
  }

  return interior;
}

/** Seed from black ink, then grow through halo pixels inside the bubble interior. */
function buildTextMask(data, width, height, channels, interior, textThreshold, inkThreshold) {
  const size = width * height;
  const text = new Uint8Array(size);
  const queue = [];

  for (let idx = 0; idx < size; idx++) {
    if (!interior[idx]) continue;
    const i = idx * channels;
    if (Math.max(data[i], data[i + 1], data[i + 2]) < inkThreshold) {
      text[idx] = 1;
      queue.push(idx);
    }
  }

  while (queue.length > 0) {
    const idx = queue.shift();
    const x = idx % width;
    const y = (idx - x) / width;
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nidx = ny * width + nx;
      if (text[nidx] || !interior[nidx]) continue;
      const ni = nidx * channels;
      if (isTextPixel(data[ni], data[ni + 1], data[ni + 2], textThreshold)) {
        text[nidx] = 1;
        queue.push(nidx);
      }
    }
  }

  return text;
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

function inpaintDiffuse(data, width, height, channels, textMask, passes) {
  const size = width * height;
  const work = Buffer.from(data);
  const offsets = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];

  for (let pass = 0; pass < passes; pass++) {
    const next = Buffer.from(work);
    let changed = 0;

    for (let idx = 0; idx < size; idx++) {
      if (!textMask[idx]) continue;

      let sr = 0;
      let sg = 0;
      let sb = 0;
      let n = 0;

      for (const off of offsets) {
        const nidx = idx + off;
        if (nidx < 0 || nidx >= size) continue;
        if (textMask[nidx]) continue;
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

function isSourcePixel(data, channels, idx, textMask) {
  if (textMask[idx]) return false;
  const i = idx * channels;
  return isCream(data[i], data[i + 1], data[i + 2]);
}

/** Fill text by interpolating between nearest cream samples on each row (then column). */
function inpaintRows(data, width, height, channels, textMask, interior) {
  const out = Buffer.from(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!textMask[idx]) continue;

      let left = -1;
      let right = -1;
      for (let lx = x - 1; lx >= 0; lx--) {
        const lidx = y * width + lx;
        if (!interior[lidx] || !isSourcePixel(data, channels, lidx, textMask)) continue;
        left = lidx;
        break;
      }
      for (let rx = x + 1; rx < width; rx++) {
        const ridx = y * width + rx;
        if (!interior[ridx] || !isSourcePixel(data, channels, ridx, textMask)) continue;
        right = ridx;
        break;
      }

      const i = idx * channels;
      if (left >= 0 && right >= 0) {
        const lx = left % width;
        const rx = right % width;
        const t = (x - lx) / (rx - lx);
        const li = left * channels;
        const ri = right * channels;
        out[i] = Math.round(data[li] * (1 - t) + data[ri] * t);
        out[i + 1] = Math.round(data[li + 1] * (1 - t) + data[ri + 1] * t);
        out[i + 2] = Math.round(data[li + 2] * (1 - t) + data[ri + 2] * t);
      } else if (left >= 0) {
        const li = left * channels;
        out[i] = data[li];
        out[i + 1] = data[li + 1];
        out[i + 2] = data[li + 2];
      } else if (right >= 0) {
        const ri = right * channels;
        out[i] = data[ri];
        out[i + 1] = data[ri + 1];
        out[i + 2] = data[ri + 2];
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!textMask[idx]) continue;

      const i = idx * channels;
      if (isCream(out[i], out[i + 1], out[i + 2])) continue;

      const isFilledSource = (sourceIdx) => {
        if (!interior[sourceIdx]) return false;
        const si = sourceIdx * channels;
        return isCream(out[si], out[si + 1], out[si + 2]);
      };

      let up = -1;
      let down = -1;
      for (let uy = y - 1; uy >= 0; uy--) {
        const uidx = uy * width + x;
        if (!isFilledSource(uidx)) continue;
        up = uidx;
        break;
      }
      for (let dy = y + 1; dy < height; dy++) {
        const didx = dy * width + x;
        if (!isFilledSource(didx)) continue;
        down = didx;
        break;
      }

      if (up >= 0 && down >= 0) {
        const uy = Math.floor(up / width);
        const dy = Math.floor(down / width);
        const t = (y - uy) / (dy - uy);
        const ui = up * channels;
        const di = down * channels;
        out[i] = Math.round(out[ui] * (1 - t) + out[di] * t);
        out[i + 1] = Math.round(out[ui + 1] * (1 - t) + out[di + 1] * t);
        out[i + 2] = Math.round(out[ui + 2] * (1 - t) + out[di + 2] * t);
      } else if (up >= 0) {
        const ui = up * channels;
        out[i] = out[ui];
        out[i + 1] = out[ui + 1];
        out[i + 2] = out[ui + 2];
      } else if (down >= 0) {
        const di = down * channels;
        out[i] = out[di];
        out[i + 1] = out[di + 1];
        out[i + 2] = out[di + 2];
      }
    }
  }

  return out;
}

async function medianPass(rgb, width, height, textMask) {
  const blurred = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .median(3)
    .raw()
    .toBuffer();

  const out = Buffer.from(rgb);
  for (let idx = 0; idx < width * height; idx++) {
    if (!textMask[idx]) continue;
    const i = idx * 3;
    out[i] = Math.round(rgb[i] * (1 - MEDIAN_BLEND) + blurred[i] * MEDIAN_BLEND);
    out[i + 1] = Math.round(rgb[i + 1] * (1 - MEDIAN_BLEND) + blurred[i + 1] * MEDIAN_BLEND);
    out[i + 2] = Math.round(rgb[i + 2] * (1 - MEDIAN_BLEND) + blurred[i + 2] * MEDIAN_BLEND);
  }
  return out;
}

async function loadRgb(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const size = width * height;
  const rgb = Buffer.alloc(size * 3);
  const alpha = channels === 4 ? Buffer.alloc(size) : null;

  for (let idx = 0; idx < size; idx++) {
    const src = idx * channels;
    const dst = idx * 3;
    rgb[dst] = data[src];
    rgb[dst + 1] = data[src + 1];
    rgb[dst + 2] = data[src + 2];
    if (alpha) alpha[idx] = data[src + 3];
  }

  return { rgb, width, height, alpha };
}

function applyInpaint(originalRgb, inpaintedRgb, textMask, width, height) {
  const out = Buffer.from(originalRgb);
  for (let idx = 0; idx < width * height; idx++) {
    if (!textMask[idx]) continue;
    const i = idx * 3;
    out[i] = inpaintedRgb[i];
    out[i + 1] = inpaintedRgb[i + 1];
    out[i + 2] = inpaintedRgb[i + 2];
  }
  return out;
}

async function writeOutputs(outRgb, width, height, alpha, pngPath, webpPath) {
  let pipeline;
  if (alpha) {
    const rgba = Buffer.alloc(width * height * 4);
    for (let idx = 0; idx < width * height; idx++) {
      const rgb = idx * 3;
      const dst = idx * 4;
      rgba[dst] = outRgb[rgb];
      rgba[dst + 1] = outRgb[rgb + 1];
      rgba[dst + 2] = outRgb[rgb + 2];
      rgba[dst + 3] = alpha[idx];
    }
    pipeline = sharp(rgba, { raw: { width, height, channels: 4 } });
  } else {
    pipeline = sharp(outRgb, { raw: { width, height, channels: 3 } });
  }

  await pipeline.clone().png({ compressionLevel: 9 }).toFile(pngPath);
  await pipeline.clone().webp({ quality: 92, effort: 6 }).toFile(webpPath);
}

async function main() {
  const { dryRun, textThreshold, textDilate, inkThreshold, inputPath } = parseArgs();

  if (!fs.existsSync(inputPath)) {
    console.error("Source not found:", inputPath);
    process.exit(1);
  }

  const outDir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const pngPath = dryRun
    ? path.join(outDir, `${base}-inpainted-preview.png`)
    : inputPath;
  const webpPath = path.join(outDir, `${base}.webp`);

  const { rgb, width, height, alpha } = await loadRgb(inputPath);

  const interior = buildInteriorMask(rgb, width, height, 3);
  let textMask = buildTextMask(rgb, width, height, 3, interior, textThreshold, inkThreshold);
  textMask = dilateMask(textMask, width, height, textDilate);

  const interiorPixels = interior.reduce((n, v) => n + v, 0);
  const textPixels = textMask.reduce((n, v) => n + v, 0);
  console.log("masks", {
    interiorPixels,
    textPixels,
    textThreshold,
    inkThreshold,
    textDilate,
    dryRun,
  });

  if (textPixels === 0) {
    console.error("No text pixels detected; adjust --text-threshold or check source.");
    process.exit(1);
  }

  let inpainted = inpaintRows(rgb, width, height, 3, textMask, interior);
  inpainted = inpaintDiffuse(inpainted, width, height, 3, textMask, INPAINT_PASSES);
  inpainted = await medianPass(inpainted, width, height, textMask);

  const touchUp = new Uint8Array(width * height);
  for (let idx = 0; idx < width * height; idx++) {
    if (!interior[idx]) continue;
    const i = idx * 3;
    if (Math.max(inpainted[i], inpainted[i + 1], inpainted[i + 2]) < 100) {
      touchUp[idx] = 1;
    }
  }
  if (touchUp.reduce((n, v) => n + v, 0) > 0) {
    inpainted = inpaintRows(inpainted, width, height, 3, touchUp, interior);
    inpainted = inpaintDiffuse(inpainted, width, height, 3, touchUp, 24);
    for (let idx = 0; idx < width * height; idx++) {
      if (touchUp[idx]) textMask[idx] = 1;
    }
  }

  const outRgb = applyInpaint(rgb, inpainted, textMask, width, height);

  await writeOutputs(outRgb, width, height, alpha, pngPath, webpPath);

  for (const p of [pngPath, webpPath]) {
    const meta = await sharp(p).metadata();
    console.log("wrote", path.relative(root, p), {
      w: meta.width,
      h: meta.height,
      bytes: fs.statSync(p).size,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
