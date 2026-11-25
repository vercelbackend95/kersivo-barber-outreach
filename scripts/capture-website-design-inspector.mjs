/**
 * Captures the real Heritage Grooming demo home page on a phone for the design inspector at the top of
 * /barbershop-website-design (src/components/websiteDesign/WdHero.astro), and measures the parts the
 * inspector frames, so the film points at the real design rather than a drawing of it.
 *
 * The page is loaded with ?static (no loader, no reveals). KERSIVO's demo bar, the custom cursor and the
 * floating "Book a chair" bar are hidden for the capture: the inspector draws that bar itself, fixed to
 * the bottom of the phone, as it behaves on the real site. The crop runs from the top of the page to the
 * top of #visit, split into the first screen (loaded eagerly) and the rest (loaded lazily).
 *
 * Writes:
 *   public/images/website-design/inspector-phone-top.webp, inspector-phone-rest.webp
 *   src/lib/websiteDesign/inspectorCapture.json  (page size and the measured rectangles, in CSS px at 390 wide)
 *
 * Usage:
 *   npx astro dev --port 4331
 *   node scripts/capture-website-design-inspector.mjs --base http://localhost:4331
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:4331' },
    quality: { type: 'string', default: '70' },
  },
});

const WIDTH = 390;
const HEIGHT = 844;
const DPR = 2;
const outDir = join(root, 'public', 'images', 'website-design');
const dataFile = join(root, 'src', 'lib', 'websiteDesign', 'inspectorCapture.json');

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: DPR,
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
await page.goto(`${values.base}/demo/heritage-grooming/index.html?static`, { waitUntil: 'networkidle' });
await page.addStyleTag({
  content: '.kd-bar, .loader, .cursor, .skip, .bookbar { display: none !important; } html, body { scroll-behavior: auto !important; }',
});
await page.evaluate(async () => {
  await document.fonts.ready;
  for (const img of document.images) img.loading = 'eager';
  await Promise.all(
    Array.from(document.images).map((img) => (img.complete ? null : new Promise((done) => img.addEventListener('load', done, { once: true })))),
  );
  window.scrollTo(0, 0);
});
await page.waitForTimeout(500);
// A full-page capture resizes the page once, and the demo re-lays its header out on resize (the hidden demo
// bar's offset goes away). Take a throwaway capture first so the measurements match the final screenshot.
await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
await page.waitForTimeout(300);

const measured = await page.evaluate(() => {
  const rect = (el) => {
    const box = el.getBoundingClientRect();
    return { x: Math.round(box.left), y: Math.round(box.top + window.scrollY), w: Math.round(box.width), h: Math.round(box.height) };
  };
  const union = (els) => {
    const boxes = els.map(rect);
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
  };
  const one = (selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Missing ${selector}`);
    return el;
  };
  const visit = one('#visit');
  return {
    until: Math.round(visit.getBoundingClientRect().top + window.scrollY),
    regions: {
      identity: rect(one('header a.brand')),
      title: rect(one('.hero h1')),
      photo: rect(one('.hero__media')),
      prices: union([...document.querySelectorAll('.svc-list .svc')].slice(0, 3)),
      menu: rect(one('.nav__toggle')),
      cta: rect(one('.hero__actions .btn')),
      link: rect(one('.hero__actions .link')),
      facts: rect(one('.hero__facts')),
    },
  };
});

const png = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: WIDTH, height: measured.until } });
await mkdir(outDir, { recursive: true });
const { width, height } = await sharp(png).metadata();
const fold = Math.min(height, HEIGHT * DPR);
for (const part of [
  { suffix: 'top', top: 0, height: fold },
  { suffix: 'rest', top: fold, height: height - fold },
]) {
  const file = join(outDir, `inspector-phone-${part.suffix}.webp`);
  const info = await sharp(png)
    .extract({ left: 0, top: part.top, width, height: part.height })
    .webp({ quality: Number(values.quality), effort: 6 })
    .toFile(file);
  console.log(`${file}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}

const data = { width: WIDTH, viewport: HEIGHT, height: measured.until, fold: HEIGHT, regions: measured.regions };
await writeFile(dataFile, `${JSON.stringify(data, null, 2)}\n`);
console.log(dataFile, JSON.stringify(data));
await context.close();
await browser.close();
