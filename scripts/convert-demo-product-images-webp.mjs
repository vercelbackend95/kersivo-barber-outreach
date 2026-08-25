/**
 * Convert new BLACKLINE demo product PNGs to WebP siblings (sources kept).
 * Run: npm run assets:demo-products-webp
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const productsDir = path.join(root, 'public/demo/products');

/** @type {ReadonlyArray<[sourcePng: string, outputWebp: string]>} */
const CONVERSIONS = [
  ['essential styling set.png', 'essential-styling-set.webp'],
  ['fibre paste.png', 'fibre-paste.webp'],
  ['matte clay.png', 'matte-clay.webp'],
  ['styling cream.png', 'styling-cream.webp'],
  ['daily conditioner.png', 'daily-conditioner.webp'],
  ['scalp scrub.png', 'scalp-scrub.webp'],
  ['claryfing rinse.png', 'clarifying-rinse.webp'],
  ['beard wash.png', 'beard-wash.webp'],
  ['beard butter.png', 'beard-butter.webp'],
  ['moustache wax.png', 'moustache-wax.webp'],
  ['shave cream.png', 'shave-cream.webp'],
  ['aftershave balm.png', 'aftershave-balm.webp'],
  ['face wash.png', 'face-wash.webp'],
  ['daily moisturiser.png', 'daily-moisturiser.webp'],
  ['cutting comb.png', 'cutting-comb.webp'],
  ['boar bristle brush.png', 'boar-bristle-brush.webp'],
  ['neck duster.png', 'neck-duster.webp'],
  ['clipper guard set.png', 'clipper-guard-set.webp'],
  ['beard kit.png', 'beard-kit.webp'],
  ['travel grooming set.png', 'travel-grooming-set.webp'],
  ['shop gift box.png', 'shop-gift-box.webp'],
  ['hot towel home kit.png', 'hot-towel-kit.webp'],
];

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

let failed = false;

for (const [sourceName, outputName] of CONVERSIONS) {
  const inputPath = path.join(productsDir, sourceName);
  const outputPath = path.join(productsDir, outputName);

  if (!fs.existsSync(inputPath)) {
    console.error(`[demo-products-webp] missing: ${sourceName}`);
    failed = true;
    continue;
  }

  const beforeBytes = fs.statSync(inputPath).size;

  await sharp(inputPath)
    .webp({ quality: 88, effort: 6, alphaQuality: 100 })
    .toFile(outputPath);

  const afterBytes = fs.statSync(outputPath).size;
  const saved = beforeBytes > 0 ? ((1 - afterBytes / beforeBytes) * 100).toFixed(0) : '0';
  console.info(
    `[demo-products-webp] ${outputName} — ${kb(beforeBytes)} → ${kb(afterBytes)} (−${saved}%)`,
  );
}

if (failed) {
  process.exit(1);
}

console.info(`[demo-products-webp] done (${CONVERSIONS.length} files)`);
