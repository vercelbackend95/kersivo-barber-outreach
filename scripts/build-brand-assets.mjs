/**
 * Raster KERSIVO brand assets, all rendered from the approved SVG masters in
 * public/images/brand/ (kersivo-mark*.svg, kersivo-lockup-*.svg).
 *
 *   npm run generate:brand-assets
 *
 * Favicons and the 512px JSON-LD mark come from scripts/generate-favicons.mjs,
 * which runs on every build. This script writes the committed rasters:
 *   - lockup PNGs (horizontal + stacked, positive + reversed)
 *   - images/logo_nobg.png: stacked lockup, reversed, 796×555 (legacy URL)
 *   - reel-assets/kersivo-mark-reversed.svg for the Remotion carousel
 *   - navbar WebPs at their existing sizes
 *   - brand/kersivo-logo-512.png for directory listings (G2, Capterra)
 *   - og/kersivo-og.jpg: the existing OG photo with the new lockup
 *   - og/barbershop-cancellation-policy-template.jpg: the existing OG card with the new lockup
 *   - hero/iphonemockup.jpg + .webp: the admin phone screenshot (Facebook cover) with the new header logo
 * Logo-free bases for the last three live in scripts/brand-assets/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (...p) => path.join(root, 'public', ...p);
const brand = (f) => pub('images', 'brand', f);
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

const svg = (f) => fs.readFile(brand(f));

/** sharp instance for an SVG, rasterised at about twice the target size (never huge). */
async function load(file, width, height) {
  const buf = await svg(file);
  const text = buf.toString('utf8');
  const iw = Number(text.match(/ width="([\d.]+)"/)[1]);
  const ih = Number(text.match(/ height="([\d.]+)"/)[1]);
  const scale = Math.max((width ?? 0) / iw, (height ?? 0) / ih) * 2;
  return sharp(buf, { density: Math.min(2400, Math.max(72, 72 * scale)) });
}

/** Render an SVG to fit inside w×h (contain), optionally on a canvas of w×h. */
async function render(file, { width, height, canvas = false, background = TRANSPARENT }) {
  const img = (await load(file, width, height)).resize(width, height, {
    fit: 'contain',
    background: TRANSPARENT,
    kernel: 'lanczos3',
  });
  if (!canvas) return img.trim({ threshold: 0 }).png().toBuffer();
  const pixels = await img.png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background } }).composite([{ input: pixels }]).png().toBuffer();
}

async function write(target, buffer) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  const m = await sharp(buffer).metadata();
  console.log(`[brand-assets] ${path.relative(root, target)} ${m.width}×${m.height}`);
}

async function main() {
  // Lockup PNGs, transparent.
  for (const [name, width] of [['horizontal', 1200], ['stacked', 800]]) {
    for (const suffix of ['', '-reversed']) {
      const file = `kersivo-lockup-${name}${suffix}.svg`;
      const png = await (await load(file, width)).resize({ width, kernel: 'lanczos3' }).png().toBuffer();
      await write(brand(`kersivo-lockup-${name}${suffix}.png`), png);
    }
  }

  // Stacked lockup in the legacy 796×555 transparent canvas (dark UI: reversed).
  const nobg = await render('kersivo-lockup-stacked-reversed.svg', { width: 796, height: 555, canvas: true });
  await write(pub('images', 'logo_nobg.png'), nobg);
  // Remotion carousel (reel/) serves public/reel-assets: give it the vector mark.
  await fs.copyFile(brand('kersivo-mark-reversed.svg'), pub('reel-assets', 'kersivo-mark-reversed.svg'));

  // Navbar assets at their existing sizes (dark navbars: reversed artwork).
  for (const [w, h] of [[228, 159], [456, 318]]) {
    const png = await render('kersivo-lockup-stacked-reversed.svg', { width: w, height: h, canvas: true });
    await write(brand(`logo-navbar-${w}.webp`), await sharp(png).webp({ quality: 92, effort: 6, alphaQuality: 100 }).toBuffer());
  }
  for (const h of [36, 72]) {
    const png = await (await load('kersivo-mark-reversed.svg', undefined, h))
      .resize({ height: h, kernel: 'lanczos3' })
      .png()
      .toBuffer();
    await write(brand(`logo-mark-nav-${h}.webp`), await sharp(png).webp({ quality: 92, effort: 6, alphaQuality: 100 }).toBuffer());
  }

  // Directory listings: stacked lockup on white, 512×512.
  const listing = await render('kersivo-lockup-stacked.svg', { width: 400, height: 400 });
  const lm = await sharp(listing).metadata();
  await write(
    brand('kersivo-logo-512.png'),
    await sharp({ create: { width: 512, height: 512, channels: 4, background: WHITE } })
      .composite([{ input: listing, left: Math.round((512 - lm.width) / 2), top: Math.round((512 - lm.height) / 2) }])
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer(),
  );

  // Open Graph: keep the approved photo and copy, add the horizontal lockup bottom-left.
  const base = path.join(root, 'scripts', 'brand-assets', 'kersivo-og-base.jpg');
  const lockup = await (await load('kersivo-lockup-horizontal-reversed.svg', undefined, 56))
    .resize({ height: 56, kernel: 'lanczos3' })
    .png()
    .toBuffer();
  await write(
    pub('images', 'og', 'kersivo-og.jpg'),
    await sharp(base).resize(1200, 630).composite([{ input: lockup, left: 80, top: 630 - 56 - 64 }]).jpeg({ quality: 88, mozjpeg: true }).toBuffer(),
  );

  // Cancellation policy template OG: same layout as before, with the horizontal lockup where the old raster logo sat.
  const policyLockup = await (await load('kersivo-lockup-horizontal-reversed.svg', undefined, 32))
    .resize({ height: 32, kernel: 'lanczos3' })
    .png()
    .toBuffer();
  await write(
    pub('images', 'og', 'barbershop-cancellation-policy-template.jpg'),
    await sharp(path.join(root, 'scripts', 'brand-assets', 'cancellation-policy-og-base.jpg'))
      .composite([{ input: policyLockup, left: 72, top: 579 - 32 }])
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer(),
  );

  // Admin phone screenshot (Facebook cover): stacked lockup centred where the old header logo sat.
  const headerLogo = await render('kersivo-lockup-stacked-reversed.svg', { width: 124, height: 122 });
  const hm = await sharp(headerLogo).metadata();
  const phone = sharp(path.join(root, 'scripts', 'brand-assets', 'iphonemockup-base.png')).composite([
    { input: headerLogo, left: Math.round(150 - hm.width / 2), top: Math.round(280 - hm.height / 2) },
  ]);
  await write(pub('images', 'hero', 'iphonemockup.jpg'), await phone.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer());
  await write(pub('images', 'hero', 'iphonemockup.webp'), await phone.clone().webp({ quality: 88, effort: 6 }).toBuffer());
}

main().catch((error) => {
  console.error('[brand-assets] failed:', error);
  process.exitCode = 1;
});
