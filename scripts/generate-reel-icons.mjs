/**
 * Export reel stat icons (retail bag + calendar) as high-quality PNGs.
 * Shapes match reel/src/scenes/DualZeroScene.tsx inline SVG icons.
 *
 * Usage: node scripts/generate-reel-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'public', 'images');

const ACCENT = '#d72638';
const OUTPUT_SIZE = 512;
const RENDER_SIZE = 1024;

const ICONS = {
  'retail-bag.png': [
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />',
    '<path d="M3 6h18" />',
    '<path d="M16 10a4 4 0 0 1-8 0" />',
  ],
  'calendar.png': [
    '<rect x="3" y="4" width="18" height="18" rx="2" />',
    '<path d="M16 2v4M8 2v4M3 10h18" />',
  ],
};

function buildIconSvg(elements) {
  const body = elements.join('\n    ');
  return Buffer.from(
    `<svg width="${RENDER_SIZE}" height="${RENDER_SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </g>
</svg>`,
  );
}

async function writeIcon(filename, elements) {
  const svg = buildIconSvg(elements);
  const outPath = path.join(outDir, filename);

  await sharp(svg)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log('wrote', path.relative(root, outPath), {
    w: meta.width,
    h: meta.height,
    hasAlpha: meta.hasAlpha,
    bytes: fs.statSync(outPath).size,
  });
}

fs.mkdirSync(outDir, { recursive: true });

for (const [filename, elements] of Object.entries(ICONS)) {
  await writeIcon(filename, elements);
}

console.log('done — accent', ACCENT);
