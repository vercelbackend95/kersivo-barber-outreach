#!/usr/bin/env node
/**
 * Self-host the licensed Pexels photos used in Insights articles.
 *
 * Downloads each original once (cached in tmp/, which is gitignored) and writes committed,
 * optimised derivatives next to the article's other assets:
 *   public/images/insights/<folder>/<name>-<width>.{avif,webp}  responsive srcset variants
 *   public/images/insights/<folder>/<name>-1600.jpg             <img> fallback
 *   public/images/insights/og/<slug>-1200x630.jpg               og:image / Article image (heroes)
 *
 * The visual manifests (editorial-staging/insights/*.visuals.json) reference the local
 * fallback JPG with `responsive` widths; compose-article.mjs turns that into <picture>.
 * Credits and licence evidence stay in the manifests unchanged.
 *
 * Photos are pre-cropped to the box insights-preview.css displays them in (object-fit: cover):
 * heroes 16:9 at object-position 50% 42%, photos 1.9:1 centred. The visible crop is unchanged,
 * but the browser no longer downloads pixels it would hide, and width/height match the box.
 *
 * Usage: node scripts/insights/self-host-pexels.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const cacheDir = path.join(root, 'tmp/insights-originals');
const ogDir = path.join(root, 'public/images/insights/og');

export const PHOTO_WIDTHS = [640, 1024, 1600];
export const HERO_WIDTHS = [640, 1024, 1600, 2400];
export const FALLBACK_WIDTH = 1600;
/** Mirrors .insights-figure--hero img / .insights-figure--photo img in insights-preview.css. */
const CROPS = { hero: { ratio: 16 / 9, x: 0.5, y: 0.42 }, photo: { ratio: 1.9, x: 0.5, y: 0.5 } };

function cropBox(width, height, { ratio, x, y }) {
  if (width / height > ratio) {
    const w = Math.round(height * ratio);
    return { left: Math.round((width - w) * x), top: 0, width: w, height };
  }
  const h = Math.round(width / ratio);
  return { left: 0, top: Math.round((height - h) * y), width, height: h };
}

/** slug: article slug; folder: existing public/images/insights folder; name: descriptive kebab-case basename. */
export const PEXELS_JOBS = [
  { id: 9703068, slug: 'how-much-do-barbershop-owners-make-uk', folder: 'barbershop-owner-earnings', name: 'red-barber-chair-london', hero: true },
  { id: 4163939, slug: 'how-much-do-barbershop-owners-make-uk', folder: 'barbershop-owner-earnings', name: 'neon-sign-interior-manchester' },
  { id: 35903164, slug: 'unfair-dismissal-six-months-barbershop-employers', folder: 'unfair-dismissal-2027', name: 'red-barbershop-sign-abergele-wales', hero: true },
  { id: 1020544, slug: 'unfair-dismissal-six-months-barbershop-employers', folder: 'unfair-dismissal-2027', name: 'hairdresser-street-photo-greater-london' },
  { id: 20692738, slug: 'barbershop-business-rates-2026-england', folder: 'business-rates-2026', name: 'barbershop-penny-lane-liverpool', hero: true },
  { id: 20231931, slug: 'barbershop-loyalty-scheme-uk', folder: 'loyalty-schemes', name: 'corner-barber-shop-bangor-wales' },
  { id: 16815780, slug: 'barbershop-walk-ins-vs-appointments', folder: 'walk-ins-vs-appointments', name: 'london-barber-shopfront-pole' },
  { id: 5464697, slug: 'do-barbers-need-a-website-uk', folder: 'do-barbers-need-website', name: 'barbershop-storefront-neon-manchester', hero: true },
  { id: 7192863, slug: 'do-barbers-need-a-website-uk', folder: 'do-barbers-need-website', name: 'traditional-barbershop-client-london' },
  { id: 35430743, slug: 'google-business-profile-booking-link-barbershop', folder: 'google-booking-link', name: 'london-barber-shop-window', hero: true },
  { id: 37328594, slug: 'google-business-profile-booking-link-barbershop', folder: 'google-booking-link', name: 'vintage-london-barbershop-brickwork' },
  { id: 27306926, slug: 'making-tax-digital-barbers', folder: 'making-tax-digital-barbers', name: 'two-men-outside-london-shop' },
];

async function original(id) {
  mkdirSync(cacheDir, { recursive: true });
  const cached = path.join(cacheDir, `pexels-${id}.jpeg`);
  if (existsSync(cached)) return readFileSync(cached);
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} — download it manually to ${cached}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(cached, buffer);
  return buffer;
}

const summary = [];
for (const job of PEXELS_JOBS) {
  const source = await original(job.id);
  const oriented = await sharp(source).rotate().toBuffer();
  const meta = await sharp(oriented).metadata();
  const box = cropBox(meta.width, meta.height, CROPS[job.hero ? 'hero' : 'photo']);
  const base = sharp(oriented).extract(box);
  const originalWidth = box.width;
  const outDir = path.join(root, 'public/images/insights', job.folder);
  mkdirSync(outDir, { recursive: true });
  const widths = (job.hero ? HERO_WIDTHS : PHOTO_WIDTHS).filter((w) => w <= originalWidth);
  for (const width of widths) {
    const resized = base.clone().resize({ width, withoutEnlargement: true });
    writeFileSync(path.join(outDir, `${job.name}-${width}.avif`), await resized.clone().avif({ quality: 50, effort: 6 }).toBuffer());
    writeFileSync(path.join(outDir, `${job.name}-${width}.webp`), await resized.clone().webp({ quality: 72 }).toBuffer());
  }
  const fallbackWidth = Math.min(FALLBACK_WIDTH, originalWidth);
  const fallback = await base.clone().resize({ width: fallbackWidth }).jpeg({ quality: 80, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  writeFileSync(path.join(outDir, `${job.name}-${fallbackWidth}.jpg`), fallback.data);
  if (job.hero) {
    mkdirSync(ogDir, { recursive: true });
    const og = await sharp(oriented).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    writeFileSync(path.join(ogDir, `${job.slug}-1200x630.jpg`), og);
  }
  summary.push({
    id: job.id,
    slug: job.slug,
    src: `/images/insights/${job.folder}/${job.name}-${fallbackWidth}.jpg`,
    width: fallback.info.width,
    height: fallback.info.height,
    responsive: widths,
  });
}
console.log(JSON.stringify(summary, null, 2));
