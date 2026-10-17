import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const base = process.env.INSIGHTS_PREVIEW_URL ?? 'http://127.0.0.1:4335/design-preview/insights';
const outDir = path.resolve('docs/insights/gate1-preview');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function dismissConsent(page) {
  try {
    const accept = page.getByRole('button', { name: /Accept all/i });
    await accept.waitFor({ state: 'visible', timeout: 4000 });
    await accept.click({ force: true });
    await page.waitForTimeout(400);
  } catch {
    // Consent may be absent.
  }
  await page.evaluate(() => {
    document
      .querySelectorAll('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [aria-modal="true"]')
      .forEach((el) => {
        const text = (el.textContent || '').toLowerCase();
        if (text.includes('privacy') || text.includes('cookie') || text.includes('consent')) {
          el.remove();
        }
      });
  });
}

async function prepare(page) {
  await page.waitForSelector('#insights-masthead-title', { timeout: 20000 });
  await page.evaluate(() => {
    document.querySelector('vite-error-overlay')?.remove();
    document.querySelector('#vite-error-overlay')?.remove();
  });
  await dismissConsent(page);
  await page.waitForTimeout(500);
}

async function measure(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('#insights-masthead-title');
    const frame = document.querySelector('.ins-frame');
    const mosaic = document.querySelector('.ins-mosaic');
    const desk = document.querySelector('.ins-desk');
    const icon = document.querySelector('.ins-topics__icon svg');
    const range = document.createRange();
    range.selectNodeContents(h1);
    const rects = [...range.getClientRects()];
    const lineTops = [...new Set(rects.map((r) => Math.round(r.top)))];
    const mosaicStyle = mosaic ? getComputedStyle(mosaic) : null;
    return {
      h1Text: h1?.innerText?.replace(/\s+/g, ' ').trim(),
      h1Lines: lineTops.length,
      h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
      frameWidth: frame ? Math.round(frame.getBoundingClientRect().width) : null,
      mosaicGap: mosaicStyle?.gap ?? null,
      mosaicHeight: mosaic ? Math.round(mosaic.getBoundingClientRect().height) : null,
      iconSize: icon ? Math.round(icon.getBoundingClientRect().width) : null,
      deskTop: desk ? Math.round(desk.getBoundingClientRect().top) : null,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });
}

async function capture(width, height, prefix, { fullPage = true } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const res = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log(prefix, 'status', res?.status());
  await prepare(page);
  console.log(prefix, JSON.stringify(await measure(page)));

  await page.screenshot({
    path: path.join(outDir, `${prefix}-viewport.png`),
    fullPage: false,
  });
  if (fullPage) {
    await page.screenshot({
      path: path.join(outDir, `${prefix}-full.png`),
      fullPage: true,
    });
  }
  await context.close();
}

async function captureDesk(width, height, prefix) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await prepare(page);
  const desk = page.locator('.ins-desk');
  await desk.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await desk.screenshot({ path: path.join(outDir, `${prefix}.png`) });
  console.log(prefix, 'desk close-up ok');
  await context.close();
}

await capture(1440, 900, 'desktop-1440');
await capture(390, 844, 'mobile-390');
await capture(320, 640, 'mobile-320');
await capture(768, 1024, 'tablet-768');
await captureDesk(1440, 900, 'owners-desk-desktop');
await captureDesk(390, 844, 'owners-desk-mobile');

await browser.close();
console.log('done →', outDir);
