/**
 * Flip the walking barber on reminder.png (face right) while keeping the
 * speech bubble pixels fixed in the upper-right ROI.
 *
 * Pipeline: full horizontal flip → erase mirrored bubble on the left →
 * paste the original bubble extract at measured coordinates.
 *
 * Usage:
 *   node scripts/flip-setup-reminder.mjs
 *   node scripts/flip-setup-reminder.mjs --left=348 --top=112 --width=481 --height=438 --pad=10
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const inputPath = path.join(root, "public/images/Ilustracje/reminder.png");
const backupPath = path.join(root, "public/images/Ilustracje/reminder.png.bak");

/** Measured via red-pixel scan on reminder.png (928×1152), includes zigzag tail. */
const DEFAULTS = {
  left: 348,
  top: 112,
  width: 481,
  height: 438,
  pad: 10,
};

function parseArgs() {
  const opts = { ...DEFAULTS };
  for (const arg of process.argv.slice(2)) {
    for (const key of ["left", "top", "width", "height", "pad"]) {
      if (arg.startsWith(`--${key}=`)) opts[key] = Number(arg.split("=")[1]);
    }
  }
  return opts;
}

function clampRoi({ left, top, width, height, pad }, imgW, imgH) {
  const extractLeft = Math.max(0, left - pad);
  const extractTop = Math.max(0, top - pad);
  const extractRight = Math.min(imgW, left + width + pad);
  const extractBottom = Math.min(imgH, top + height + pad);
  const mirroredLeft = imgW - (left + width);
  const mirroredTop = top;
  const mirroredWidth = width;
  const mirroredHeight = height;
  return {
    extractLeft,
    extractTop,
    extractWidth: extractRight - extractLeft,
    extractHeight: extractBottom - extractTop,
    mirroredLeft: Math.max(0, mirroredLeft - pad),
    mirroredTop: Math.max(0, mirroredTop - pad),
    mirroredWidth: mirroredWidth + pad * 2,
    mirroredHeight: mirroredHeight + pad * 2,
  };
}

async function main() {
  const { left, top, width, height, pad } = parseArgs();

  if (!fs.existsSync(inputPath)) {
    console.error("Missing source:", inputPath);
    process.exit(1);
  }

  const sourcePath = fs.existsSync(backupPath) ? backupPath : inputPath;
  const { width: imgW, height: imgH } = await sharp(sourcePath).metadata();
  const roi = clampRoi({ left, top, width, height, pad }, imgW, imgH);

  const bubbleBuffer = await sharp(sourcePath)
    .extract({
      left: roi.extractLeft,
      top: roi.extractTop,
      width: roi.extractWidth,
      height: roi.extractHeight,
    })
    .png()
    .toBuffer();

  const eraseMirrored = await sharp({
    create: {
      width: Math.min(roi.mirroredWidth, imgW - roi.mirroredLeft),
      height: Math.min(roi.mirroredHeight, imgH - roi.mirroredTop),
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();

  if (!fs.existsSync(backupPath) && sourcePath === inputPath) {
    fs.copyFileSync(inputPath, backupPath);
    console.log("backup", path.relative(root, backupPath));
  }

  await sharp(sourcePath)
    .flop()
    .composite([
      {
        input: eraseMirrored,
        left: roi.mirroredLeft,
        top: roi.mirroredTop,
        blend: "over",
      },
      {
        input: bubbleBuffer,
        left: roi.extractLeft,
        top: roi.extractTop,
        blend: "over",
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(inputPath);

  const meta = await sharp(inputPath).metadata();
  console.log("source", path.relative(root, sourcePath));
  console.log("wrote", path.relative(root, inputPath), {
    w: meta.width,
    h: meta.height,
    bytes: fs.statSync(inputPath).size,
  });
  console.log("bubble ROI:", { left, top, width, height, pad, ...roi });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
