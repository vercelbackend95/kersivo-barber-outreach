/**
 * Convert landing-page illustration PNGs to WebP siblings (PNG sources kept).
 * Used on the homepage landing — run: npm run assets:landing-illustrations-webp
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const INPUTS = [
  'public/images/hero/phone-5.png',
  'public/images/Ilustracje/8.png',
  'public/images/Ilustracje/shoppyonline.png',
  'public/images/Ilustracje/reminder.png',
  'public/images/Ilustracje/grupaludziidzie.png',
  'public/images/Ilustracje/barberwelcome.png',
];

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

let failed = false;

for (const relative of INPUTS) {
  const inputPath = path.join(root, relative);

  if (!fs.existsSync(inputPath)) {
    console.error(`[landing-illustrations-webp] missing: ${relative}`);
    failed = true;
    continue;
  }

  const outputPath = inputPath.replace(/\.png$/i, '.webp');
  const beforeBytes = fs.statSync(inputPath).size;

  await sharp(inputPath)
    .webp({ quality: 88, effort: 6, alphaQuality: 100 })
    .toFile(outputPath);

  const afterBytes = fs.statSync(outputPath).size;
  const saved = beforeBytes > 0 ? ((1 - afterBytes / beforeBytes) * 100).toFixed(0) : '0';

  console.info(
    `[landing-illustrations-webp] ${path.relative(root, outputPath)} — ${kb(beforeBytes)} → ${kb(afterBytes)} (−${saved}%)`,
  );
}

if (failed) {
  process.exit(1);
}

console.info(`[landing-illustrations-webp] done (${INPUTS.length} files)`);
