/**
 * Generate favicon assets from logo_nobg.png for public/ root.
 * Usage: node scripts/generate-favicons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const source = path.join(root, 'public', 'images', 'logo_nobg.png');
const publicDir = path.join(root, 'public');

const resizeOptions = {
  fit: 'contain',
  background: { r: 0, g: 0, b: 0, alpha: 0 },
};

async function resizePng(size) {
  return sharp(source).resize(size, size, resizeOptions).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing source image: ${source}`);
  }

  const [icon16, icon32, icon48] = await Promise.all([
    resizePng(16),
    resizePng(32),
    resizePng(48),
  ]);

  await Promise.all([
    fs.promises.writeFile(path.join(publicDir, 'favicon-32x32.png'), icon32),
    sharp(source).resize(180, 180, resizeOptions).png().toFile(path.join(publicDir, 'apple-touch-icon.png')),
    fs.promises.writeFile(path.join(publicDir, 'favicon.ico'), await toIco([icon16, icon32, icon48])),
  ]);

  console.log('Generated public/favicon.ico, favicon-32x32.png, apple-touch-icon.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
