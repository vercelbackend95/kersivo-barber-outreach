/**
 * Generate favicon assets from logo_nobg.png for public/ root.
 * Usage: node scripts/generate-favicons.mjs
 *
 * Uses sharp only (no to-ico / jimp / request) — H08 Phase A.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

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

/**
 * Pack PNG buffers into a multi-size .ico (PNG-compressed ICO entries).
 * @param {Array<{ size: number; png: Buffer }>} images
 */
function pngsToIco(images) {
  const count = images.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const chunks = [Buffer.alloc(headerSize)];

  // ICONDIR
  chunks[0].writeUInt16LE(0, 0); // reserved
  chunks[0].writeUInt16LE(1, 2); // type: icon
  chunks[0].writeUInt16LE(count, 4);

  for (let i = 0; i < count; i += 1) {
    const { size, png } = images[i];
    const entryOffset = 6 + i * 16;
    const widthByte = size >= 256 ? 0 : size;
    const heightByte = size >= 256 ? 0 : size;
    chunks[0].writeUInt8(widthByte, entryOffset);
    chunks[0].writeUInt8(heightByte, entryOffset + 1);
    chunks[0].writeUInt8(0, entryOffset + 2); // color palette
    chunks[0].writeUInt8(0, entryOffset + 3); // reserved
    chunks[0].writeUInt16LE(1, entryOffset + 4); // color planes
    chunks[0].writeUInt16LE(32, entryOffset + 6); // bits per pixel
    chunks[0].writeUInt32LE(png.length, entryOffset + 8);
    chunks[0].writeUInt32LE(offset, entryOffset + 12);
    chunks.push(png);
    offset += png.length;
  }

  return Buffer.concat(chunks);
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

  const ico = pngsToIco([
    { size: 16, png: icon16 },
    { size: 32, png: icon32 },
    { size: 48, png: icon48 },
  ]);

  await Promise.all([
    fs.promises.writeFile(path.join(publicDir, 'favicon-32x32.png'), icon32),
    sharp(source)
      .resize(180, 180, resizeOptions)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png')),
    fs.promises.writeFile(path.join(publicDir, 'favicon.ico'), ico),
  ]);

  console.log('Generated public/favicon.ico, favicon-32x32.png, apple-touch-icon.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
