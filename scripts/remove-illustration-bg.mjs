/**
 * Remove uniform outer background from illustration JPG/PNG → PNG/WebP with alpha.
 * Flood-fill from image edges; feather softens the cut line (Booksy-style float).
 *
 * Usage:
 *   node scripts/remove-illustration-bg.mjs
 *   node scripts/remove-illustration-bg.mjs --tolerance=14 --feather=18
 *   node scripts/remove-illustration-bg.mjs path/to/source.jpg
 *   node scripts/remove-illustration-bg.mjs public/images/Ilustracje/0%.jpg --strip-watermark
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const defaultInput = path.join(root, "public/images/Ilustracje/shoppyonline-source.jpg");

/** Bottom-right ROI for Gemini star on 0% illustration (925×1152). */
const WATERMARK_ROI = { left: 0.82, top: 0.88, width: 0.18, height: 0.12 };

/** Edge-connected pixels at or below this level are treated as outer background. */
const EDGE_DARK_MAX = 48;

/** Pure black letterbox (Gemini export) — flood separately so it does not rely on grey key. */
const LETTERBOX_DARK_MAX = 10;

function parseArgs() {
  let tolerance = 14;
  let feather = 18;
  let stripWatermark = null;
  let inputPath = defaultInput;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--tolerance=")) {
      tolerance = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--feather=")) {
      feather = Number(arg.split("=")[1]);
    } else if (arg === "--strip-watermark") {
      stripWatermark = true;
    } else if (arg === "--no-strip-watermark") {
      stripWatermark = false;
    } else if (!arg.startsWith("--")) {
      inputPath = path.isAbsolute(arg) ? arg : path.join(root, arg.replace(/^\//, ""));
    }
  }

  if (stripWatermark === null) {
    stripWatermark = /0%/.test(path.basename(inputPath));
  }

  if (stripWatermark && tolerance === 14 && feather === 18) {
    tolerance = 18;
    feather = 22;
  }

  return { tolerance, feather, stripWatermark, inputPath };
}

function resolveInputPath(requestedPath) {
  if (fs.existsSync(requestedPath)) return requestedPath;

  const dir = path.dirname(requestedPath);
  const base = path.basename(requestedPath, path.extname(requestedPath));
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const candidate = path.join(dir, `${base}${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return requestedPath;
}

function colorDist(r, g, b, key) {
  return Math.hypot(r - key[0], g - key[1], b - key[2]);
}

function sampleKeyColor(data, width, height, channels, existingBg) {
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (const [x, y] of corners) {
    const idx = y * width + x;
    if (existingBg?.[idx]) continue;
    const i = idx * channels;
    sr += data[i];
    sg += data[i + 1];
    sb += data[i + 2];
    n++;
  }
  if (n === 0) {
    const i = 0;
    return [data[i], data[i + 1], data[i + 2]];
  }
  return [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
}

async function loadRgbBuffer(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const size = width * height;
  const rgb = Buffer.alloc(size * 3);
  const existingBg = new Uint8Array(size);

  for (let idx = 0; idx < size; idx++) {
    const src = idx * channels;
    const dst = idx * 3;
    rgb[dst] = data[src];
    rgb[dst + 1] = data[src + 1];
    rgb[dst + 2] = data[src + 2];
    if (channels === 4 && data[src + 3] < 20) {
      existingBg[idx] = 1;
    }
  }

  return { rgb, width, height, existingBg };
}

/**
 * Force Gemini watermark pixels transparent via mask (before flood-fill).
 */
function buildWatermarkMask(data, width, height, channels, key, tolerance) {
  const mask = new Uint8Array(width * height);
  const x0 = Math.floor(width * WATERMARK_ROI.left);
  const y0 = Math.floor(height * WATERMARK_ROI.top);
  const x1 = width;
  const y1 = height;
  const markTolerance = tolerance * 2.5;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = y * width + x;
      const i = idx * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max - min;
      const d = colorDist(r, g, b, key);
      const isLightMark = max > 140 && sat < 55;
      const isBgLike = d <= markTolerance;
      const isDarkCorner = max <= EDGE_DARK_MAX + 12;

      if (isLightMark || isBgLike || isDarkCorner) {
        mask[idx] = 1;
        data[i] = key[0];
        data[i + 1] = key[1];
        data[i + 2] = key[2];
      }
    }
  }

  return mask;
}

function floodBackgroundMask(data, width, height, channels, key, tolerance, existingBg) {
  const size = width * height;
  const isBg = new Uint8Array(size);
  if (existingBg) {
    for (let idx = 0; idx < size; idx++) {
      if (existingBg[idx]) isBg[idx] = 1;
    }
  }
  const visited = new Uint8Array(size);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push(x, 0, x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(0, y, width - 1, y);
  }

  const matchesKey = (idx) => {
    if (existingBg?.[idx]) return true;
    const i = idx * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    if (max <= EDGE_DARK_MAX) return true;
    return colorDist(r, g, b, key) <= tolerance;
  };

  const pushNeighbors = (x, y) => {
    queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  };

  while (queue.length > 0) {
    const y = queue.pop();
    const x = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    if (existingBg?.[idx]) {
      pushNeighbors(x, y);
      continue;
    }

    if (!matchesKey(idx)) continue;

    isBg[idx] = 1;
    pushNeighbors(x, y);
  }

  return isBg;
}

/** Flood near-black pixels from edges (letterbox), passing through existing bg/transparent. */
function floodLetterboxDark(isBg, data, width, height, channels, existingBg) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push(x, 0, x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(0, y, width - 1, y);
  }

  const isPassable = (idx) => existingBg?.[idx] || isBg[idx];

  const isLetterbox = (idx) => {
    if (isPassable(idx)) return true;
    const i = idx * channels;
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    return max <= LETTERBOX_DARK_MAX;
  };

  const pushNeighbors = (x, y) => {
    queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  };

  while (queue.length > 0) {
    const y = queue.pop();
    const x = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (!isLetterbox(idx)) continue;

    if (!isPassable(idx)) {
      isBg[idx] = 1;
    }
    pushNeighbors(x, y);
  }
}

/** Remove isolated dark letterbox in outer margins (not chair leather in the scene). */
function stripMarginDark(isBg, data, width, height, channels) {
  const marginX = Math.max(8, Math.floor(width * 0.06));
  const marginY = Math.max(8, Math.floor(height * 0.06));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onMargin =
        x < marginX ||
        x >= width - marginX ||
        y < marginY ||
        y >= height - marginY;
      if (!onMargin) continue;

      const idx = y * width + x;
      const i = idx * channels;
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      if (max <= EDGE_DARK_MAX + 8) {
        isBg[idx] = 1;
      }
    }
  }
}

function applyAlpha(data, width, height, channels, key, tolerance, feather, isBg, watermarkMask, stripWatermark) {
  const out = Buffer.alloc(width * height * 4);
  const cornerX0 = Math.floor(width * WATERMARK_ROI.left);
  const cornerY0 = Math.floor(height * WATERMARK_ROI.top);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const src = idx * channels;
      const dst = idx * 4;

      out[dst] = data[src];
      out[dst + 1] = data[src + 1];
      out[dst + 2] = data[src + 2];

      const inCornerStrip =
        stripWatermark && x >= cornerX0 && y >= cornerY0;

      if (inCornerStrip || watermarkMask?.[idx] || isBg[idx]) {
        out[dst + 3] = 0;
        continue;
      }

      const d = colorDist(data[src], data[src + 1], data[src + 2], key);
      if (d <= tolerance) {
        out[dst + 3] = 255;
      } else if (d <= tolerance + feather) {
        const t = (d - tolerance) / feather;
        out[dst + 3] = Math.round(Math.min(1, Math.max(0, t)) * 255);
      } else {
        out[dst + 3] = 255;
      }
    }
  }

  return out;
}

async function main() {
  let { tolerance, feather, stripWatermark, inputPath } = parseArgs();
  inputPath = resolveInputPath(inputPath);

  if (!fs.existsSync(inputPath)) {
    console.error("Source not found:", inputPath);
    process.exit(1);
  }

  const outDir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const pngPath = path.join(outDir, `${base}.png`);
  const webpPath = path.join(outDir, `${base}.webp`);

  const { rgb: data, width, height, existingBg } = await loadRgbBuffer(inputPath);
  const channels = 3;
  const key = sampleKeyColor(data, width, height, channels, existingBg);

  const watermarkMask = stripWatermark
    ? buildWatermarkMask(data, width, height, channels, key, tolerance)
    : null;

  const isBg = floodBackgroundMask(data, width, height, channels, key, tolerance, existingBg);
  if (stripWatermark) {
    floodLetterboxDark(isBg, data, width, height, channels, existingBg);
    stripMarginDark(isBg, data, width, height, channels);
  }
  const rgba = applyAlpha(
    data,
    width,
    height,
    channels,
    key,
    tolerance,
    feather,
    isBg,
    watermarkMask,
    stripWatermark,
  );

  const wmPixels = watermarkMask?.reduce((n, v) => n + v, 0) ?? 0;
  const bgPixels = isBg.reduce((n, v) => n + v, 0);
  console.log("key color RGB:", key, {
    tolerance,
    feather,
    stripWatermark,
    watermarkPixels: wmPixels,
    bgPixels,
    total: width * height,
  });

  const pipeline = sharp(rgba, { raw: { width, height, channels: 4 } });

  await pipeline
    .clone()
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(pngPath);

  await pipeline
    .clone()
    .webp({ quality: 92, effort: 6, alphaQuality: 100 })
    .toFile(webpPath);

  for (const outPath of [pngPath, webpPath]) {
    const meta = await sharp(outPath).metadata();
    console.log("wrote", path.relative(root, outPath), {
      w: meta.width,
      h: meta.height,
      bytes: fs.statSync(outPath).size,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
