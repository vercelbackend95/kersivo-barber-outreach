/**
 * Captures the real Heritage Grooming demo home page (public/demo/heritage-grooming/index.html) for the
 * shop side of the homepage hero stage (src/components/homeV2/HomeV2WipeStage.astro). The stage shows
 * these screenshots instead of a hand-drawn imitation, so what a visitor sees there is what they find
 * when they open the demo.
 *
 * The page is loaded with ?static (its own reduced-motion version: no loader, no reveal animations).
 * The KERSIVO demo bar and the custom cursor are KERSIVO's chrome around the demo, not part of the
 * shop's website, so they are hidden; so is the phone's floating "Book a chair" bar, which a
 * full-page capture would otherwise freeze halfway down the page. The crop runs from the top of the page to the top of the
 * section named by --until, so the stage scrolls through the hero, prices, shop and services.
 *
 * Usage:
 *   npx astro dev --port 4331
 *   node scripts/capture-heritage-stage.mjs --base http://localhost:4331
 * Options:
 *   --base <origin>    server serving the site (default http://localhost:4331)
 *   --out <dir>        output directory (default public/images/home-v2)
 *   --until <selector> crop ends at the top of this element (default #visit)
 *   --quality <n>      WebP quality (default 72)
 * Set PLAYWRIGHT_CHANNEL (e.g. msedge, chrome) to use an installed browser.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:4331' },
    out: { type: 'string', default: join(root, 'public', 'images', 'home-v2') },
    until: { type: 'string', default: '#visit' },
    quality: { type: 'string', default: '72' },
  },
});

/** Desktop: the site's laptop layout. Phone: its mobile layout, at 2x so it stays sharp in the stage. */
const SHOTS = [
  { name: 'heritage-stage-desktop', width: 1280, height: 800, dpr: 1.25, mobile: false },
  { name: 'heritage-stage-phone', width: 390, height: 844, dpr: 2, mobile: true },
];

const HIDE_CHROME = `
  .kd-bar, .loader, .cursor, .skip, .bookbar { display: none !important; }
  html, body { scroll-behavior: auto !important; }
`;

await mkdir(values.out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.dpr,
    isMobile: shot.mobile,
    hasTouch: shot.mobile,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`${values.base}/demo/heritage-grooming/index.html?static`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE_CHROME });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Load every lazy image above the crop before the screenshot.
    for (const img of document.images) img.loading = 'eager';
    await Promise.all(
      Array.from(document.images).map((img) => (img.complete ? null : new Promise((done) => img.addEventListener('load', done, { once: true })))),
    );
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);

  const until = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : document.documentElement.scrollHeight;
  }, values.until);

  const png = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: shot.width, height: until } });
  // Two files: the first screen (the hero's LCP image, kept small and loaded eagerly) and the rest of
  // the page under it (loaded lazily). The stage stacks them so they read as one page.
  const { width, height } = await sharp(png).metadata();
  const fold = Math.min(height, Math.round(shot.height * shot.dpr));
  const parts = [
    { suffix: 'top', top: 0, height: fold },
    { suffix: 'rest', top: fold, height: height - fold },
  ];
  for (const part of parts) {
    const file = join(values.out, `${shot.name}-${part.suffix}.webp`);
    const info = await sharp(png)
      .extract({ left: 0, top: part.top, width, height: part.height })
      .webp({ quality: Number(values.quality), effort: 6 })
      .toFile(file);
    console.log(`${file}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
  }
  await context.close();
}

await browser.close();
