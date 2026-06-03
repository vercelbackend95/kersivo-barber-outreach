/**
 * Overlay the on-brand BUBBLE.png over the cream speech bubble in happy.png.
 * Outputs happy-composed.png + happy-composed.webp for use in brandValues.astro.
 *
 * Usage:
 *   node scripts/compose-happy-bubble.mjs
 *   node scripts/compose-happy-bubble.mjs --left=117 --top=20 --width=430 --height=335
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "public/images/Ilustracje");

const happyPath = path.join(dir, "happy.png");
const bubblePath = path.join(dir, "BUBBLE.png");
const outPng = path.join(dir, "happy-composed.png");
const outWebp = path.join(dir, "happy-composed.webp");

// Cream bubble bounding box in happy.png (measured via pixel scan, 960×1200 source).
// x: 135–549, y: 36–349 → centroid ≈ (342, 192).
// BUBBLE.png scaled to 430×335 then centered on that centroid.
const DEFAULTS = {
  left: 117,
  top: 20,
  width: 430,
  height: 335,
};

function parseArgs() {
  const opts = { ...DEFAULTS };
  for (const arg of process.argv.slice(2)) {
    for (const key of ["left", "top", "width", "height"]) {
      if (arg.startsWith(`--${key}=`)) opts[key] = Number(arg.split("=")[1]);
    }
  }
  return opts;
}

async function main() {
  const { left, top, width, height } = parseArgs();

  for (const p of [happyPath, bubblePath]) {
    if (!fs.existsSync(p)) {
      console.error("Missing source:", p);
      process.exit(1);
    }
  }

  const scaledBubble = await sharp(bubblePath)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const pipeline = sharp(happyPath).composite([
    { input: scaledBubble, left, top, blend: "over" },
  ]);

  await pipeline.clone().png({ compressionLevel: 9 }).toFile(outPng);
  await pipeline.clone().webp({ quality: 92, effort: 6 }).toFile(outWebp);

  for (const p of [outPng, outWebp]) {
    const meta = await sharp(p).metadata();
    console.log("wrote", path.relative(root, p), {
      w: meta.width,
      h: meta.height,
      bytes: fs.statSync(p).size,
    });
  }

  console.log("bubble overlay:", { left, top, width, height });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
