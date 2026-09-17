/**
 * Export the dedicated Facebook cover canvas to PNG + JPG.
 *
 * Prereq: `npm run dev` on localhost:4321 (override with FACEBOOK_COVER_BASE).
 *
 * Usage:
 *   npm run social:facebook-cover
 */
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const WIDTH = 1702;
const HEIGHT = 630;
const SCALE = 2;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'social');
const pngPath = join(outDir, 'kersivo-facebook-cover-1702x630.png');
const jpgPath = join(outDir, 'kersivo-facebook-cover-1702x630.jpg');

const base = (process.env.FACEBOOK_COVER_BASE ?? 'http://localhost:4321').replace(/\/$/, '');
const coverUrl = `${base}/facebook-cover`;

async function assertServer() {
  try {
    const res = await fetch(coverUrl, { redirect: 'manual' });
    if (!res.ok) {
      throw new Error(`GET ${coverUrl} returned ${res.status}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Facebook cover page is not reachable at ${coverUrl} (${reason}). Start the app with \`npm run dev\` first.`,
    );
  }
}

async function waitForCoverReady(page) {
  const cover = page.locator('[data-facebook-cover]');
  await cover.waitFor({ state: 'visible', timeout: 30000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const imgs = [...document.querySelectorAll('[data-facebook-cover] img')];
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve, reject) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener(
            'error',
            () => reject(new Error(`Failed to load ${img.currentSrc || img.src}`)),
            { once: true },
          );
        });
      }),
    );
  });
  await page.waitForTimeout(250);
}

async function main() {
  await assertServer();
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });

  try {
    await page.goto(coverUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await waitForCoverReady(page);

    const capture = await page.locator('[data-facebook-cover]').screenshot({
      type: 'png',
      animations: 'disabled',
      caret: 'hide',
    });

    const pngBuffer = await sharp(capture)
      .resize(WIDTH, HEIGHT, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .sharpen({ sigma: 0.55, m1: 0.7, m2: 0.3 })
      .png({
        compressionLevel: 6,
        adaptiveFiltering: true,
        effort: 8,
      })
      .toBuffer();

    await sharp(pngBuffer).toFile(pngPath);
    await sharp(pngBuffer)
      .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toFile(jpgPath);

    const pngMeta = await sharp(pngPath).metadata();
    if (pngMeta.width !== WIDTH || pngMeta.height !== HEIGHT) {
      throw new Error(`PNG is ${pngMeta.width}x${pngMeta.height}, expected ${WIDTH}x${HEIGHT}`);
    }

    const pngStat = await stat(pngPath);
    const jpgStat = await stat(jpgPath);

    console.log('Wrote Facebook cover assets:', {
      png: 'public/social/kersivo-facebook-cover-1702x630.png',
      jpg: 'public/social/kersivo-facebook-cover-1702x630.jpg',
      size: `${pngMeta.width}x${pngMeta.height}`,
      pngBytes: pngStat.size,
      jpgBytes: jpgStat.size,
      capturePx: `${WIDTH * SCALE}x${HEIGHT * SCALE}`,
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
