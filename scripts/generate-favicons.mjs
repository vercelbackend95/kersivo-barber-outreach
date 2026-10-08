/**
 * Build the KERSIVO icon set from the ORIGINAL approved transparent logo.
 *
 * SOURCE: public/images/logo_nobg.png (796×555, exact user-supplied asset)
 * No AI artwork, redraw, colour replacement, stylisation or tracing.
 * Only crop the existing K (above the wordmark), resize, centre and export.
 *
 * Invoked in the Vercel build plan before Astro, and manually via:
 *   npm run generate:favicons
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const source = path.join(publicDir, 'images', 'logo_nobg.png');
const markPath = path.join(publicDir, 'images', 'brand', 'kersivo-mark.png');

// Pixel-aligned crop of the K only. Original wordmark begins at y≈442.
const K_CROP = { left: 230, top: 4, width: 337, height: 371 };
const CANVAS = 512;
const MARK_SIZE = 456; // comfortable margin at favicon sizes
const BACKGROUND = { r: 11, g: 13, b: 16, alpha: 1 };

const resizeOptions = {
  fit: 'contain',
  background: { r: 0, g: 0, b: 0, alpha: 0 },
};

/** Pack PNG data into an ICO containing 16, 32 and 48px entries. */
function pngsToIco(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;

  for (const [i, { size, png }] of images.entries()) {
    const e = 6 + 16 * i;
    header.writeUInt8(size, e);
    header.writeUInt8(size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  }
  return Buffer.concat([header, ...images.map(x => x.png)]);
}

export async function generateKersivoBrandIcons() {
  const original = await fs.readFile(source);
  // SHA-256 fingerprint protects against unintentionally swapping the approved source.
  const fingerprint = createHash('sha256').update(original).digest('hex');
  const meta = await sharp(original).metadata();
  if (meta.width !== 796 || meta.height !== 555 || meta.hasAlpha !== true) {
    throw new Error('KERSIVO logo_nobg.png has unexpected dimensions/transparency. Review K crop before generating icons.');
  }

  // Extract *exact original pixels* of the coloured K, omitting only the text.
  const k = await sharp(original).extract(K_CROP).png().toBuffer();

  // Transparent square K used in Comparison: same design, no backdrop or wordmark.
  const paddedK = await sharp(k).resize(MARK_SIZE, MARK_SIZE, resizeOptions).png().toBuffer();
  const pad = (CANVAS - MARK_SIZE) / 2;
  const transparentMark = await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: '#00000000' },
  }).composite([{ input: paddedK, left: pad, top: pad }]).png().toBuffer();

  // The dark field aids contrast at 16px. It does not change the logo itself.
  const faviconMaster = await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: BACKGROUND },
  }).composite([{ input: transparentMark, left: 0, top: 0 }]).png().toBuffer();

  const sizes = [16, 32, 48, 96, 180, 192, 512];
  const icons = new Map(await Promise.all(sizes.map(async size => [
    size, await sharp(faviconMaster).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer(),
  ])));

  const ico = pngsToIco([16, 32, 48].map(size => ({ size, png: icons.get(size) })));
  // Self-contained SVG (no cross-file mask, no CSS colour forcing).
  // Embeds an image resampled solely from the user's original letter K.
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,${icons.get(96).toString('base64')}"/></svg>\n`;

  await fs.mkdir(path.dirname(markPath), { recursive: true });
  await Promise.all([
    fs.writeFile(markPath, transparentMark),
    fs.writeFile(path.join(publicDir, 'favicon.ico'), ico),
    fs.writeFile(path.join(publicDir, 'favicon.svg'), faviconSvg),
    fs.writeFile(path.join(publicDir, 'favicon-32x32.png'), icons.get(32)),
    fs.writeFile(path.join(publicDir, 'favicon-48x48.png'), icons.get(48)),
    fs.writeFile(path.join(publicDir, 'favicon-96x96.png'), icons.get(96)),
    fs.writeFile(path.join(publicDir, 'favicon-192x192.png'), icons.get(192)),
    fs.writeFile(path.join(publicDir, 'favicon-512x512.png'), icons.get(512)),
    fs.writeFile(path.join(publicDir, 'apple-touch-icon.png'), icons.get(180)),
  ]);

  console.log(`[brand] Generated official colour K favicon/icon set from logo_nobg.png (sha256:${fingerprint.slice(0, 12)}…)`);
}

const calledDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (calledDirectly) {
  generateKersivoBrandIcons().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
