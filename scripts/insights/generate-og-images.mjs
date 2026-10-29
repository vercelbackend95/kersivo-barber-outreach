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
  // Self-hosted copies of the approved 1200x630 Unsplash hero crops, so og:image and the
  // Article image live on kersivo.co.uk. Pexels heroes are handled by self-host-pexels.mjs.
  ...[
    ['barbershop-christmas-opening-hours-planning', 'photo-1672257493626-038f96997ade?auto=format&fit=crop&q=78&w=1200&h=630'],
    ['how-to-price-haircut-uk-barber', 'photo-1769034260387-39fa07f0c0fa?auto=format&fit=crop&fm=jpg&q=78&w=1200&h=630'],
    ['barber-dermatitis-skin-care-hse', 'photo-1761931403671-d020a14928d9?auto=format&fit=crop&fm=jpg&q=75&w=1200&h=630'],
    ['barbershop-client-retention-second-visit', 'photo-1772657850401-a15d99f505d4?auto=format&fit=crop&fm=jpg&q=75&w=1200&h=630'],
    ['making-tax-digital-barbers', 'photo-1739302493888-6f96cbc37105?auto=format&fit=crop&fm=jpg&q=80&w=1200&h=630'],
    ['apprentice-barber-funding-costs-2026', 'photo-1640301133857-c4bc5789c1bb?auto=format&fit=crop&fm=jpg&q=78&w=1200&h=630'],
    ['barbershop-loyalty-scheme-uk', 'photo-1640301133543-41fe25ad6450?auto=format&fit=crop&fm=jpg&q=78&w=1200&h=630'],
    ['busy-barbershop-low-profit-chair-hour', 'photo-1786057424913-6954b0f424af?auto=format&fit=crop&fm=jpg&q=75&w=1200&h=630'],
    ['barbershop-walk-ins-vs-appointments', 'photo-1578853283498-cc994096481b?auto=format&fit=crop&fm=jpg&q=75&w=1200&h=630'],
    ['barber-commission-pay-minimum-wage-uk', 'photo-1722635255984-827851ba91be?auto=format&fit=crop&fm=jpg&q=75&w=1200&h=630'],
    ['barbershop-no-show-cost-when-deposit-makes-sense', 'photo-1569832947682-77c9164611df?auto=format&fit=crop&fm=jpg&q=78&w=1200&h=630'],
  ].map(([slug, photo]) => ({ slug, type: 'remote', src: `https://images.unsplash.com/${photo}`, ext: 'jpg' })),
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
