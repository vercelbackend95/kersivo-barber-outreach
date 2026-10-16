/**
 * Visual QA evidence for /barbershop-websites.
 *
 *   npm run qa:visual:barbershop-websites              # astro build, then capture
 *   npm run qa:visual:barbershop-websites -- --skip-build
 *   npm run qa:visual:barbershop-websites -- --base-url=http://127.0.0.1:4321
 *
 * Captures the real rendered page from a production build (served from `.vercel/output`)
 * in Chromium, and overwrites the PNGs in qa/visual/barbershop-websites/.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { startServer } from './serve-vercel-output.mjs';

const ROUTE = '/barbershop-websites';
const OUT_DIR = resolve('qa/visual/barbershop-websites');

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900, isMobile: false },
  { name: 'mobile-390x844', width: 390, height: 844, isMobile: true },
  { name: 'small-mobile-375x812', width: 375, height: 812, isMobile: true },
];

const SECTIONS = [
  { name: 'section-01-hero', selector: '.bsw-hero' },
  { name: 'section-02-definition', selector: '.bsw-definition' },
  { name: 'section-03-essentials', selector: '.bsw-essentials' },
];

const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  html { scroll-behavior: auto !important; }
`;

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const baseUrlArg = args.find((arg) => arg.startsWith('--base-url='))?.split('=')[1];

// Palette-quantised PNG keeps text edges crisp while making files small enough to view on GitHub.
async function optimisePng(path) {
  const input = readFileSync(path);
  const output = await sharp(input).png({ palette: true, quality: 92, effort: 10, compressionLevel: 9, dither: 0.6 }).toBuffer();
  if (output.length < input.length) writeFileSync(path, output);
  return Math.round(statSync(path).size / 1024);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(' ')} failed`);
}

async function preparePage(page, baseURL) {
  const response = await page.goto(`${baseURL}${ROUTE}`, { waitUntil: 'networkidle' });
  if (!response || response.status() !== 200) {
    throw new Error(`${ROUTE} responded with ${response?.status() ?? 'no response'}`);
  }
  await page.addStyleTag({ content: FREEZE_CSS });

  // Answer the cookie banner with the real UI, choosing necessary cookies only.
  const reject = page.getByRole('button', { name: 'Reject optional' });
  if (await reject.isVisible().catch(() => false)) {
    await reject.click();
    await reject.waitFor({ state: 'hidden' });
  }

  // Load every lazy image: switch to eager, walk the page, then wait for decode.
  await page.evaluate(() => {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
  });
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) =>
        img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }),
      ),
    );
    await Promise.all([...document.images].map((img) => img.decode?.().catch(() => null)));
  });
  await page.waitForTimeout(400);

  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  if (!robots?.includes('noindex')) throw new Error(`Expected noindex robots meta, got "${robots}"`);
}

async function captureFull(browser, baseURL, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  });
  const page = await context.newPage();
  await preparePage(page, baseURL);
  const file = `${viewport.name}-full.png`;
  await page.screenshot({ path: join(OUT_DIR, file), fullPage: true, animations: 'disabled' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await context.close();
  return { file, overflow };
}

async function captureSections(browser, baseURL, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.isMobile ? 2 : 1,
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  });
  const page = await context.newPage();
  await preparePage(page, baseURL);
  const files = [];
  for (const section of SECTIONS) {
    // Measure in document coordinates and clip a full-page capture, so tall sections and
    // sticky/fixed elements are not stitched or clipped by the viewport.
    const box = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: 0, y: Math.max(0, rect.top + window.scrollY), width: document.documentElement.clientWidth, height: rect.height };
    }, section.selector);
    if (!box || box.height < 1) throw new Error(`Section not found: ${section.selector}`);
    const file = `${viewport.name}-${section.name}.png`;
    await page.screenshot({ path: join(OUT_DIR, file), fullPage: true, clip: box, animations: 'disabled' });
    files.push(file);
  }
  await context.close();
  return files;
}

async function main() {
  if (!baseUrlArg && !skipBuild) run('npx', ['astro', 'build']);

  let server;
  let baseURL = baseUrlArg;
  if (!baseURL) {
    ({ server, baseURL } = await startServer());
  }

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const manifest = { route: ROUTE, source: baseUrlArg ? 'custom base URL' : 'local production build (.vercel/output)', browser: `chromium ${browser.version()}`, captures: [] };
  try {
    for (const viewport of VIEWPORTS) {
      const full = await captureFull(browser, baseURL, viewport);
      if (full.overflow > 0) throw new Error(`${viewport.name}: horizontal overflow of ${full.overflow}px`);
      const sections = await captureSections(browser, baseURL, viewport);
      const files = [full.file, ...sections];
      for (const file of files) await optimisePng(join(OUT_DIR, file));
      manifest.captures.push({
        viewport: `${viewport.width}x${viewport.height}`,
        name: viewport.name,
        files,
      });
      console.log(`[visual-qa] ${viewport.name}: ${1 + sections.length} screenshots`);
    }
  } finally {
    await browser.close();
    server?.close();
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[visual-qa] wrote ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(`[visual-qa] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
