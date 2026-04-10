/**
 * Build public/hero-assets/screens/timeline.png from a high-res source with
 * mild sharpening and high-quality PNG export (BOOKING OVERVIEW bento).
 *
 * Usage:
 *   node scripts/enhance-timeline-screenshot.mjs
 *   node scripts/enhance-timeline-screenshot.mjs public/hero-assets/screens/my-source.png
 *
 * Default source is 3.png (wide desktop capture); output is always timeline.png.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const screens = path.join(root, "public/hero-assets/screens");
const outPath = path.join(screens, "timeline.png");

const arg = process.argv[2];
const inputPath = arg
  ? path.isAbsolute(arg)
    ? arg
    : path.join(root, arg.replace(/^\//, ""))
  : path.join(screens, "3.png");

if (!fs.existsSync(inputPath)) {
  console.error("Source not found:", inputPath);
  process.exit(1);
}

const before = await sharp(inputPath).metadata();
const buf = await sharp(inputPath)
  .sharpen({ sigma: 1.35, m1: 1, m2: 2, x1: 2, y2: 10, y3: 20 })
  .png({
    compressionLevel: 2,
    adaptiveFiltering: true,
    effort: 10,
  })
  .toBuffer();

await sharp(buf).toFile(outPath);

const after = await sharp(outPath).metadata();
const bytes = fs.statSync(outPath).size;
console.log("wrote", path.relative(root, outPath), {
  source: path.relative(root, inputPath),
  before: { w: before.width, h: before.height },
  after: { w: after.width, h: after.height, bytes },
});
