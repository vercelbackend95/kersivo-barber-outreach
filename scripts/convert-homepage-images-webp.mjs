/**
 * Convert homepage PNG/JPG assets to WebP siblings (sources kept).
 * Run: npm run assets:homepage-images-webp
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const PNG_INPUTS = [
  'public/images/hero/phone-5.png',
  'public/images/Ilustracje/8.png',
  'public/images/Ilustracje/shoppyonline.png',
  'public/images/Ilustracje/reminder.png',
  'public/images/Ilustracje/3.png',
  'public/images/Ilustracje/0%.png',
  'public/images/Ilustracje/barberszyld.png',
  'public/images/Ilustracje/switch.png',
  'public/images/Ilustracje/newshop.png',
  'public/images/Ilustracje/grupaludziidzie.png',
  'public/images/Ilustracje/barberwelcome.png',
  'public/images/Ilustracje/POV.png',
];

const JPG_INPUTS = [
  'public/images/discoverypic.jpg',
  'public/images/Buildpic.jpg',
  'public/images/Reviewpic.jpg',
  'public/images/Launchpic.jpg',
];

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function convertPng(relative) {
  const inputPath = path.join(root, relative);
  if (!fs.existsSync(inputPath)) {
    console.error(`[homepage-images-webp] missing: ${relative}`);
    return false;
  }

  const outputPath = inputPath.replace(/\.png$/i, '.webp');
  const beforeBytes = fs.statSync(inputPath).size;

  await sharp(inputPath)
    .webp({ quality: 88, effort: 6, alphaQuality: 100 })
    .toFile(outputPath);

  const afterBytes = fs.statSync(outputPath).size;
  const saved = beforeBytes > 0 ? ((1 - afterBytes / beforeBytes) * 100).toFixed(0) : '0';
  console.info(
    `[homepage-images-webp] ${path.relative(root, outputPath)} — ${kb(beforeBytes)} → ${kb(afterBytes)} (−${saved}%)`,
  );
  return true;
}

async function convertJpg(relative) {
  const inputPath = path.join(root, relative);
  if (!fs.existsSync(inputPath)) {
    console.error(`[homepage-images-webp] missing: ${relative}`);
    return false;
  }

  const outputPath = inputPath.replace(/\.jpe?g$/i, '.webp');
  const beforeBytes = fs.statSync(inputPath).size;

  await sharp(inputPath)
    .webp({ quality: 85, effort: 6 })
    .toFile(outputPath);

  const afterBytes = fs.statSync(outputPath).size;
  const saved = beforeBytes > 0 ? ((1 - afterBytes / beforeBytes) * 100).toFixed(0) : '0';
  console.info(
    `[homepage-images-webp] ${path.relative(root, outputPath)} — ${kb(beforeBytes)} → ${kb(afterBytes)} (−${saved}%)`,
  );
  return true;
}

let failed = false;

for (const relative of PNG_INPUTS) {
  if (!(await convertPng(relative))) failed = true;
}

for (const relative of JPG_INPUTS) {
  if (!(await convertJpg(relative))) failed = true;
}

if (failed) {
  process.exit(1);
}

console.info(`[homepage-images-webp] done (${PNG_INPUTS.length + JPG_INPUTS.length} files)`);
