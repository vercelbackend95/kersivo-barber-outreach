/**
 * Derive social-share raster OG images from approved Insights heroes.
 * Does not invent photography — crops licensed Unsplash heroes or rasterises approved SVG artwork.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const outDir = path.join(root, 'public/images/insights/og');
mkdirSync(outDir, { recursive: true });

const WIDTH = 1200;
const HEIGHT = 630;

const jobs = [
  {
    slug: 'google-reviews-barbershop-uk-rules',
    type: 'remote',
    src: 'https://images.unsplash.com/photo-1768678218016-6bed23a35116?auto=format&fit=crop&fm=jpg&q=80&w=1600&h=900',
    ext: 'jpg',
  },
  {
    slug: 'get-more-barbershop-clients-locally-uk',
    type: 'remote',
    src: 'https://images.unsplash.com/photo-1781455793310-8427c96454c7?auto=format&fit=crop&fm=jpg&q=80&w=1600&h=900',
    ext: 'jpg',
  },
  {
    slug: 'barbershop-card-payment-fees-uk',
    type: 'svg',
    src: 'public/images/insights/card-fees/card-fees-hero.svg',
    ext: 'png',
  },
  {
    slug: 'barbershop-gift-vouchers-uk',
    type: 'svg',
    src: 'public/images/insights/gift-vouchers/voucher-hero.svg',
    ext: 'png',
  },
];

async function rasteriseSvg(relativePath) {
  const svg = readFileSync(path.join(root, relativePath));
  const artwork = await sharp(svg, { density: 180 })
    .resize({ width: 980, height: 520, fit: 'contain', background: { r: 242, g: 240, b: 235, alpha: 1 } })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: { r: 11, g: 13, b: 16 },
    },
  })
    .composite([{ input: artwork, gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function cropRemote(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return sharp(buf)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

for (const job of jobs) {
  const out = path.join(outDir, `${job.slug}-1200x630.${job.ext}`);
  const buffer = job.type === 'svg' ? await rasteriseSvg(job.src) : await cropRemote(job.src);
  writeFileSync(out, buffer);
  console.log(`WROTE ${path.relative(root, out)} (${buffer.length} bytes)`);
}

console.log('PASS: Insights OG images generated.');
