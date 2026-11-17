/**
 * Build the KERSIVO icon set only from user-approved artwork.
 *
 * SOURCE: public/images/brand/kersivo-mark.svg — the approved 2026 flat
 * vector K (four pieces on one 45° grid, near-black #0b0d10 + brand red
 * #d72638). Every icon below is rasterised from that SVG; nothing is redrawn,
 * recoloured by hand or cropped from older raster artwork.
 *
 * Transparent canvas throughout, except apple-touch-icon.png: iOS fills
 * transparency with black, which would hide the near-black pieces, so that one
 * icon sits on white.
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
const source = path.join(publicDir, 'images', 'brand', 'kersivo-mark.svg');
const markPath = path.join(publicDir, 'images', 'brand', 'kersivo-mark.png');

const INK = '#0b0d10';
const CANVAS = 512;
const MARK_SIZE = 456; // comfortable margin for the 512px JSON-LD / directory mark
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Rasterise the SVG so that the mark fits `box`×`box`, centred on a `size` canvas. */
export async function renderMark(svg, size, box = size, background = TRANSPARENT) {
  const pixels = await sharp(Buffer.from(svg), { density: Math.min(2400, Math.max(72, (72 * box * 2) / 520)) })
    .resize(box, box, { fit: 'contain', background: TRANSPARENT, kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const pad = Math.round((size - box) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: pixels, left: pad, top: pad }])
    .png()
    .toBuffer();
}

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

/**
 * favicon.svg: the same vector, with a square viewBox and the near-black
 * pieces switching to white when the browser UI is dark.
 */
function adaptiveFaviconSvg(svg) {
  const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  if (!vb) throw new Error('kersivo-mark.svg has no viewBox.');
  const [x, y, w, h] = vb.slice(1).map(Number);
  const side = Math.max(w, h);
  const square = `${x - (side - w) / 2} ${y - (side - h) / 2} ${side} ${side}`;
  const paths = svg.match(/<path [^>]*\/>/g) ?? [];
  const body = paths
    .map(p => p.replace(`fill="${INK}"`, 'class="k-ink"'))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${square}"><style>.k-ink{fill:${INK}}@media (prefers-color-scheme:dark){.k-ink{fill:#ffffff}}</style>${body}</svg>\n`;
}

export async function generateKersivoBrandIcons() {
  const svg = await fs.readFile(source, 'utf8');
  // SHA-256 fingerprint protects against unintentionally swapping the approved source.
  const fingerprint = createHash('sha256').update(svg).digest('hex');
  if (!svg.includes(INK) || !svg.includes('#d72638') || /<(image|linearGradient|radialGradient|filter)\b/.test(svg)) {
    throw new Error('kersivo-mark.svg must be the flat two-colour KERSIVO mark (no images, gradients or filters).');
  }

  // Small sizes fill the canvas edge to edge; larger ones keep a margin.
  const iconBox = { 16: 16, 32: 32, 48: 48, 96: 88, 192: 172, 512: 456 };
  const icons = new Map();
  for (const [size, box] of Object.entries(iconBox)) {
    icons.set(Number(size), await renderMark(svg, Number(size), box));
  }

  const ico = pngsToIco([16, 32, 48].map(size => ({ size, png: icons.get(size) })));
  const transparentMark = await renderMark(svg, CANVAS, MARK_SIZE);
  const appleTouch = await renderMark(svg, 180, 128, { r: 255, g: 255, b: 255, alpha: 1 });

  await fs.mkdir(path.dirname(markPath), { recursive: true });
  await Promise.all([
    // Organization JSON-LD logo (Google uses this URL): keep the filename.
    fs.writeFile(markPath, transparentMark),
    fs.writeFile(path.join(publicDir, 'favicon.ico'), ico),
    fs.writeFile(path.join(publicDir, 'favicon.svg'), adaptiveFaviconSvg(svg)),
    fs.writeFile(path.join(publicDir, 'favicon-32x32.png'), icons.get(32)),
    fs.writeFile(path.join(publicDir, 'favicon-48x48.png'), icons.get(48)),
    fs.writeFile(path.join(publicDir, 'favicon-96x96.png'), icons.get(96)),
    fs.writeFile(path.join(publicDir, 'favicon-192x192.png'), icons.get(192)),
    fs.writeFile(path.join(publicDir, 'favicon-512x512.png'), icons.get(512)),
    fs.writeFile(path.join(publicDir, 'apple-touch-icon.png'), appleTouch),
  ]);

  console.log(`[brand] Generated KERSIVO icons from images/brand/kersivo-mark.svg (sha256:${fingerprint.slice(0, 12)}…)`);
}

const calledDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (calledDirectly) {
  generateKersivoBrandIcons().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
