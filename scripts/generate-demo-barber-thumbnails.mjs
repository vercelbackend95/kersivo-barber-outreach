/**
 * Create the small CUTSTATE demo barber portraits used by the booking hero
 * and booking-journey illustrations. Run before tests, development and builds.
 *
 * The generated files are build artifacts. Keep the original photos intact.
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'public/demo/barbers');
const outputDir = path.join(sourceDir, 'thumbs');
const dimension = 160;
const maxBytes = 12 * 1024;

await mkdir(outputDir, { recursive: true });

const photos = (await readdir(sourceDir))
  .filter((filename) => filename.endsWith('.webp'))
  .sort();

if (photos.length === 0) {
  throw new Error('[demo-barber-thumbs] No source WebP portraits found.');
}

for (const filename of photos) {
  const source = path.join(sourceDir, filename);
  const target = path.join(outputDir, filename.replace(/\.webp$/, `-${dimension}.webp`));
  const image = sharp(source).rotate().resize(dimension, dimension, {
    fit: 'cover',
    position: 'attention',
  });

  let result;
  for (const quality of [75, 65, 55, 45, 35, 25]) {
    result = await image.clone().webp({ quality, effort: 6 }).toBuffer();
    if (result.length < maxBytes) break;
  }

  if (!result || result.length >= maxBytes) {
    throw new Error(`[demo-barber-thumbs] Unable to reduce ${filename} below ${maxBytes} bytes`);
  }

  await writeFile(target, result);
  const size = (await stat(target)).size;
  console.log(`[demo-barber-thumbs] ${path.relative(root, target)}: ${size} bytes`);
}
