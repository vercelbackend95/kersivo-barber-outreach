/**
 * Square 160px barber thumbnails for the Heritage Grooming marketing drawings (avatars in the booking
 * and website mock-ups). Cropped from the team-page portraits so the face sits in the circle.
 *
 *   node scripts/generate-heritage-barber-thumbs.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public/demo/heritage-grooming/assets/img');
const out = join(root, 'public/images/heritage/barbers');
mkdirSync(out, { recursive: true });

/** slug → [team-page photo, square crop of the 960×1286 portrait: left, top, size]. */
const BARBERS = {
  arthur: ['work-arthur-fade', 170, 230, 400],
  kit: ['work-kit-scissors', 450, 200, 400],
  rafi: ['work-rafi-neckline', 250, 380, 400],
  owen: ['work-owen-razor', 250, 350, 400],
};

for (const [slug, [photo, left, top, size]] of Object.entries(BARBERS)) {
  const file = join(out, `${slug}-160.webp`);
  const info = await sharp(join(source, `${photo}-960.webp`))
    .extract({ left, top, width: size, height: size })
    .resize(160, 160)
    .webp({ quality: 78, effort: 6 })
    .toFile(file);
  console.log(file, info.size, 'bytes');
}
