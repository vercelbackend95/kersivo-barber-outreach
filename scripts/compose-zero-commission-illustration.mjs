/**
 * Replace generic AI speech bubble on 0%.jpg with on-brand bubble + Bebas copy.
 * Not used by brand values — that section uses 0%.webp via npm run assets:zero-illustration.
 *
 * Usage:
 *   node scripts/compose-zero-commission-illustration.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const sourceCandidates = [
  path.join(root, "public/images/Ilustracje/0%.jpg"),
  path.join(root, "public/images/Ilustracje/0%.png"),
];
const outPath = path.join(root, "public/images/Ilustracje/zero-commission-composed.png");

const IVORY = "#f1eee8";
const INK = "#0b0d10";

/** Speech bubble — sized from cream-pixel bounds on 0%.jpg (912×1136). */
const BUBBLE = {
  left: 0.39,
  top: 0.08,
  width: 0.54,
  height: 0.31,
};

const BUBBLE_TEXT = "0% commission!";

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bubbleGeometry(width, height) {
  const bx = Math.round(width * BUBBLE.left);
  const by = Math.round(height * BUBBLE.top);
  const bw = Math.round(width * BUBBLE.width);
  const bh = Math.round(height * BUBBLE.height);
  const br = Math.round(bh * 0.38);

  const bodyRight = bx + bw;
  const bodyBottom = by + bh;
  const bodyMidY = by + Math.round(bh * 0.5);

  const tailBaseX = bx + Math.round(bw * 0.18);
  const tailTipX = bx - Math.round(width * 0.038);
  const tailTipY = bodyMidY + Math.round(bh * 0.45);
  const tailBaseY1 = bodyBottom - Math.round(bh * 0.08);
  const tailBaseY2 = bodyBottom - Math.round(bh * 0.01);

  const path = `
    M ${bx + br} ${by}
    L ${bodyRight - br} ${by}
    Q ${bodyRight} ${by} ${bodyRight} ${by + br}
    L ${bodyRight} ${bodyBottom - br}
    Q ${bodyRight} ${bodyBottom} ${bodyRight - br} ${bodyBottom}
    L ${tailBaseX + Math.round(bw * 0.12)} ${bodyBottom}
    L ${tailBaseX} ${tailBaseY2}
    L ${tailTipX} ${tailTipY}
    L ${tailBaseX} ${tailBaseY1}
    L ${bx + br} ${bodyBottom}
    Q ${bx} ${bodyBottom} ${bx} ${bodyBottom - br}
    L ${bx} ${by + br}
    Q ${bx} ${by} ${bx + br} ${by}
    Z`;

  return { bx, by, bw, bh, path };
}

function buildOverlay(width, height) {
  const bubble = bubbleGeometry(width, height);
  const fontSize = Math.round(width * 0.039);
  const textX = bubble.bx + Math.round(bubble.bw / 2);
  const textY = bubble.by + Math.round(bubble.bh * 0.36);
  const strokeW = Math.max(1.5, width * 0.0018);

  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="${INK}" flood-opacity="0.2"/>
        </filter>
      </defs>

      <path
        d="${bubble.path}"
        fill="${IVORY}"
        stroke="${INK}"
        stroke-opacity="0.3"
        stroke-width="${strokeW}"
      />

      <text
        x="${textX}"
        y="${textY}"
        text-anchor="middle"
        filter="url(#textShadow)"
        font-family="'Bebas Neue', Impact, 'Arial Narrow', sans-serif"
        font-size="${fontSize}"
        fill="${INK}"
        letter-spacing="0.03em"
      >${escapeXml(BUBBLE_TEXT)}</text>
    </svg>`,
  );
}

function resolveSource() {
  for (const p of sourceCandidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const sourcePath = resolveSource();
  if (!sourcePath) {
    console.error("Source not found. Expected one of:", sourceCandidates);
    process.exit(1);
  }

  const { width, height } = await sharp(sourcePath).metadata();
  const overlay = buildOverlay(width, height);

  await sharp(sourcePath)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log("source", path.relative(root, sourcePath));
  console.log("wrote", path.relative(root, outPath), {
    w: meta.width,
    h: meta.height,
    bytes: fs.statSync(outPath).size,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
