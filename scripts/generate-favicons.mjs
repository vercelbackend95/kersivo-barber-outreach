/**
 * Build the KERSIVO icon set only from user-approved artwork.
 *
 * COMPARISON SOURCE: public/images/logo_nobg.png (existing full brand logo)
 * FAVICON SOURCE: public/images/favicon.png (new transparent standalone K)
 *
 * The two sources serve different purposes. Favicon pixels are never drawn,
 * recoloured or placed on an opaque background.
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
const faviconSource = path.join(publicDir, 'images', 'favicon.png');

// Pixel-aligned crop of the K only. Original wordmark begins at y≈442.
const K_CROP = { left: 230, top: 4, width: 337, height: 371 };
const CANVAS = 512;
const MARK_SIZE = 456; // comfortable margin at favicon sizes
// Transparent canvas throughout. Do not add a dark square behind the K.

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

  // The new favicon source was approved separately by the founder: it is an
  // isolated K with alpha, already supplied at public/images/favicon.png.
  // Never regenerate it from the older wordmark or place it in a dark box.
  let sourcePixels;
  try {
    sourcePixels = await fs.readFile(faviconSource);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(
        'Missing public/images/favicon.png. Add and commit the approved transparent K asset before building.',
      );
    }
    throw error;
  }

  const iconMeta = await sharp(sourcePixels).metadata();
  if (
    iconMeta.format !== 'png' ||
    !iconMeta.hasAlpha ||
    Math.min(iconMeta.width ?? 0, iconMeta.height ?? 0) < 96
  ) {
    throw new Error(
      'public/images/favicon.png must be a transparent PNG with both dimensions at least 96px.',
    );
  }

  // Prevent accidentally publishing a square background again.
  const corner = await sharp(sourcePixels)
    .ensureAlpha()
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer();
  if (corner[3] !== 0) {
    throw new Error('public/images/favicon.png has an opaque top-left corner; remove its background.');
  }

  const faviconMaster = await sharp(sourcePixels)
    .resize(CANVAS, CANVAS, resizeOptions)
    .png()
    .toBuffer();

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
    // Backward-compatible URLs: replace the retired white artwork, not the approved source.
    fs.writeFile(path.join(publicDir, 'images', 'logo-kersivo.png'), original),
    fs.writeFile(path.join(publicDir, 'reel-assets', 'logo.png'), original),
    fs.writeFile(path.join(publicDir, 'favicon.ico'), ico),
    fs.writeFile(path.join(publicDir, 'favicon.svg'), faviconSvg),
    fs.writeFile(path.join(publicDir, 'favicon-32x32.png'), icons.get(32)),
    fs.writeFile(path.join(publicDir, 'favicon-48x48.png'), icons.get(48)),
    fs.writeFile(path.join(publicDir, 'favicon-96x96.png'), icons.get(96)),
    fs.writeFile(path.join(publicDir, 'favicon-192x192.png'), icons.get(192)),
    fs.writeFile(path.join(publicDir, 'favicon-512x512.png'), icons.get(512)),
    fs.writeFile(path.join(publicDir, 'apple-touch-icon.png'), icons.get(180)),
  ]);

  console.log(`[brand] Generated transparent K favicon from public/images/favicon.png; comparison remains based on logo_nobg.png (sha256:${fingerprint.slice(0, 12)}…)`);
}

const calledDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (calledDirectly) {
  generateKersivoBrandIcons().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
