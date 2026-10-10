/**
 * Builds cropped, lightweight derivatives of the BLACKLINE demo photography
 * for the /barbershop-websites hero. Sources live in public/demo; nothing new
 * is fetched. Re-run after changing a source image:
 *   node scripts/generate-barbershop-websites-hero-images.mjs
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = 'public/demo';
const OUT = 'public/images/barbershop-websites';

/** @type {Array<{ src: string; out: string; width: number; height: number; extract?: { left: number; top: number; width: number; height: number }; position?: string; quality?: number }>} */
const jobs = [
  { src: 'heroimg.webp', out: 'site-hero-1100.webp', width: 1100, height: 900, extract: { left: 0, top: 380, width: 1800, height: 1473 } },
  { src: 'heroimg.webp', out: 'site-hero-640.webp', width: 640, height: 524, extract: { left: 0, top: 380, width: 1800, height: 1473 } },
  { src: 'gallery/scissor-cut.webp', out: 'service-haircut.webp', width: 400, height: 300, position: 'attention' },
  { src: 'gallery/beard.webp', out: 'service-beard.webp', width: 400, height: 300, position: 'attention' },
  { src: 'gallery/fade.webp', out: 'service-fade.webp', width: 400, height: 300, position: 'attention' },
  { src: 'gallery/interior-detail.webp', out: 'service-style.webp', width: 400, height: 300, position: 'attention' },
  { src: 'heroimg.webp', out: 'thumb-hero.webp', width: 240, height: 150, extract: { left: 0, top: 500, width: 1800, height: 1125 } },
  { src: 'gallery/barber-at-work.webp', out: 'thumb-services.webp', width: 240, height: 150, position: 'attention' },
  { src: 'gallery/fade.webp', out: 'thumb-gallery-a.webp', width: 120, height: 150, position: 'attention' },
  { src: 'gallery/hairline.webp', out: 'thumb-gallery-b.webp', width: 120, height: 150, position: 'attention' },
  { src: 'barbers/ellis-ward.webp', out: 'barber-ellis-ward.webp', width: 160, height: 160, extract: { left: 800, top: 0, width: 420, height: 420 } },
  { src: 'barbers/noah-reid.webp', out: 'barber-noah-reid.webp', width: 160, height: 160, extract: { left: 500, top: 180, width: 640, height: 640 } },
  { src: 'barbers/marcus-bell.webp', out: 'barber-marcus-bell.webp', width: 160, height: 160, extract: { left: 700, top: 420, width: 560, height: 560 } },
  { src: 'barbers/ellis-ward.webp', out: 'team-ellis-ward.webp', width: 96, height: 150, extract: { left: 690, top: 0, width: 640, height: 1000 } },
  { src: 'barbers/noah-reid.webp', out: 'team-noah-reid.webp', width: 96, height: 150, extract: { left: 420, top: 160, width: 800, height: 1250 } },
  { src: 'barbers/marcus-bell.webp', out: 'team-marcus-bell.webp', width: 96, height: 150, extract: { left: 560, top: 400, width: 840, height: 1312 } },
];

await mkdir(OUT, { recursive: true });

for (const job of jobs) {
  let pipeline = sharp(join(SRC, job.src));
  if (job.extract) pipeline = pipeline.extract(job.extract);
  await pipeline
    .resize(job.width, job.height, { fit: 'cover', position: job.position ?? 'centre' })
    .webp({ quality: job.quality ?? 74 })
    .toFile(join(OUT, job.out));
  console.log(`${job.out} ${job.width}x${job.height}`);
}
