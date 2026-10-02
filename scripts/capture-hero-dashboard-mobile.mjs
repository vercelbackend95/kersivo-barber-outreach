/**
 * Captures the static phone/tablet hero images from the real KERSIVO demo dashboard
 * (`/demo/admin?embed=hero&section=bookings_dashboard`).
 *
 * The hero embed pins its clock to BLACKLINE_HERO_SHOWCASE_NOW_ISO (15:25 on the showcase
 * day), so the bookings shown are the same on every run. As on the landing page, the embed
 * is loaded in a same-origin iframe; once it reports ready
 * (`html[data-hero-showcase-ready="true"]`), the parent posts the real
 * `kersivo:hero-showcase-visible` message, which scrolls the timeline to the frozen "now"
 * row exactly as the desktop showcase does. Animations are then frozen and a
 * native-resolution clip is taken at each DPR — every width is rendered, never resampled.
 *
 * Both presets crop the same 1100x900 dashboard from its top-left corner:
 *   phone   640x720 → hero-dashboard-mobile-{800,1000,1200,1280,1600}
 *   tablet  840x680 → hero-dashboard-tablet-{840,1260,1680} (shallower, for 641–768px)
 * Each width is written as a PNG master, a lossless WebP and a 4:4:4 AVIF.
 *
 * Usage:
 *   npx astro build && node <any static server for .vercel/output or astro preview>
 *   node scripts/capture-hero-dashboard-mobile.mjs --base http://127.0.0.1:4321
 * Options:
 *   --base <origin>       server serving the site (default http://127.0.0.1:4321)
 *   --out <dir>           output directory (default public/images/hero-dashboard)
 *   --preset <name>       phone | tablet | all (default all)
 *   --viewport <w>x<h>    CSS size of the dashboard frame (default 1100x900)
 *   --crop <x,y,w,h>      override the preset's CSS-pixel clip (single preset only)
 *   --dprs <list>         override the preset's device pixel ratios (single preset only)
 *   --name <base>         override the preset's file base name (single preset only)
 *   --avif-quality <n>    AVIF quality (default 70)
 * Set PLAYWRIGHT_CHANNEL (e.g. msedge, chrome) to use an installed browser.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import sharp from 'sharp';

const PRESETS = {
  phone: { crop: '0,0,640,720', dprs: '2.5,2,1.875,1.5625,1.25', name: 'hero-dashboard-mobile' },
  tablet: { crop: '0,0,840,680', dprs: '2,1.5,1', name: 'hero-dashboard-tablet' },
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://127.0.0.1:4321' },
    out: { type: 'string', default: join(root, 'public', 'images', 'hero-dashboard') },
    preset: { type: 'string', default: 'all' },
    viewport: { type: 'string', default: '1100x900' },
    crop: { type: 'string' },
    dprs: { type: 'string' },
    name: { type: 'string' },
    'avif-quality': { type: 'string', default: '70' },
  },
});

const presetNames = values.preset === 'all' ? Object.keys(PRESETS) : [values.preset];
if (presetNames.some((name) => !PRESETS[name])) throw new Error(`Unknown preset: ${values.preset}`);
const jobs = presetNames.map((name) =>
  presetNames.length === 1
    ? { ...PRESETS[name], ...Object.fromEntries(['crop', 'dprs', 'name'].filter((k) => values[k]).map((k) => [k, values[k]])) }
    : PRESETS[name],
);

const [vw, vh] = values.viewport.split('x').map(Number);
const outDir = resolve(values.out);
const url = `${values.base}/demo/admin?embed=hero&section=bookings_dashboard`;
const avifQuality = Number(values['avif-quality']);

const FREEZE_CSS = `
  *, *::before, *::after {
    animation-play-state: paused !important;
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    transition: none !important;
    caret-color: transparent !important;
  }
  html, body { scrollbar-width: none !important; }
  ::-webkit-scrollbar { display: none !important; }
`;

async function capture(browser, dpr, clip) {
  const context = await browser.newContext({
    viewport: { width: vw, height: vh },
    deviceScaleFactor: dpr,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await page.goto(`${values.base}/robots.txt`);
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:#030303;overflow:hidden">` +
      `<iframe id="hero" src="${url}" style="display:block;border:0;width:${vw}px;height:${vh}px"></iframe>` +
      `</body></html>`,
  );
  const frame = await (await page.waitForSelector('#hero')).contentFrame();
  await frame.waitForSelector('html[data-hero-showcase-ready="true"]', { timeout: 30000 });
  await page.evaluate((type) => {
    document.getElementById('hero').contentWindow.postMessage({ type }, location.origin);
  }, 'kersivo:hero-showcase-visible');
  await frame.waitForFunction(() => (document.querySelector('.admin-vtl-scroll')?.scrollTop ?? 0) > 0, null, {
    timeout: 10000,
  });
  const nowLabel = await frame.evaluate(() => document.querySelector('.admin-vtl-now-row')?.textContent?.trim() ?? '');
  if (!nowLabel.includes('15:25')) throw new Error(`Unexpected showcase "now" row: ${nowLabel}`);
  await frame.addStyleTag({ content: FREEZE_CSS });
  await frame.evaluate(() => document.fonts.ready);
  await frame.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(800);
  const png = await page.screenshot({ clip, animations: 'disabled', caret: 'hide', scale: 'device', type: 'png' });
  await context.close();
  return png;
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
await mkdir(outDir, { recursive: true });
const written = [];
for (const job of jobs) {
  const [x, y, width, height] = job.crop.split(',').map(Number);
  for (const dpr of job.dprs.split(',').map(Number)) {
    const raw = await capture(browser, dpr, { x, y, width, height });
    const base = join(outDir, `${job.name}-${Math.round(width * dpr)}`);
    const png = await sharp(raw).png({ compressionLevel: 9, effort: 10, palette: false }).toBuffer();
    // In lossless mode `quality` is compression effort, not fidelity: 100 is pixel-identical and ~40% smaller.
    const webp = await sharp(raw).webp({ lossless: true, quality: 100, effort: 6 }).toBuffer();
    // Full-resolution chroma keeps thin red lines and small text clean; 4:2:0 smears them.
    const avif = await sharp(raw).avif({ quality: avifQuality, effort: 9, chromaSubsampling: '4:4:4' }).toBuffer();
    await writeFile(`${base}.png`, png);
    await writeFile(`${base}.webp`, webp);
    await writeFile(`${base}.avif`, avif);
    written.push([`${base}.png`, png.length], [`${base}.webp`, webp.length], [`${base}.avif`, avif.length]);
  }
}
await browser.close();
for (const [file, bytes] of written) console.log(`${file}  ${bytes} bytes`);
