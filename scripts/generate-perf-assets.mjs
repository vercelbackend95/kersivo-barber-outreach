/**
 * Generate performance-optimized image variants (landing value cards).
 * Run: npm run assets:perf-images
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function resizeWebp(inputPath, outputPath, width) {
  const before = fs.statSync(inputPath).size;
  await sharp(inputPath)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 88, effort: 6, alphaQuality: 100 })
    .toFile(outputPath);
  const after = fs.statSync(outputPath).size;
  console.info(
    `[perf-assets] ${path.relative(root, outputPath)} (${width}w) — ${kb(before)} → ${kb(after)}`,
  );
}

async function main() {
  // Navbar logo WebPs are rendered from the vector masters by
  // scripts/build-brand-assets.mjs (npm run generate:brand-assets).

  const valueCardSources = [
    { file: '8.webp', widths: [320, 480, 768, 1024] },
    { file: 'shoppyonline.webp', widths: [320, 480, 768, 1024] },
    { file: 'reminder.webp', widths: [320, 480, 768, 1024] },
  ];

  for (const { file, widths } of valueCardSources) {
    const inputPath = path.join(root, 'public/images/Ilustracje', file);
    if (!fs.existsSync(inputPath)) {
      console.error(`[perf-assets] missing: ${file}`);
      process.exitCode = 1;
      continue;
    }
    const base = file.replace(/\.webp$/i, '');
    for (const width of widths) {
      const outputPath = path.join(root, 'public/images/Ilustracje', `${base}-${width}w.webp`);
      await resizeWebp(inputPath, outputPath, width);
    }
  }

  console.info('[perf-assets] done');
}

main().catch((err) => {
  console.error('[perf-assets] failed:', err);
  process.exit(1);
});
