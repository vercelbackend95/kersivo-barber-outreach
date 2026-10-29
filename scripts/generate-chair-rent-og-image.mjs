/**
 * Renders the 1200×630 Open Graph card for /chair-rent-vs-commission-calculator
 * from HTML with the self-hosted brand fonts. Run: node scripts/generate-chair-rent-og-image.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const font = (file) => `data:font/woff2;base64,${readFileSync(join(root, 'public/fonts', file)).toString('base64')}`;
const out = join(root, 'public/images/og/chair-rent-vs-commission-calculator-1200x630.png');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Bebas; src: url(${font('bebas-neue-latin-400-normal.woff2')}); }
@font-face { font-family: Inter; font-weight: 400; src: url(${font('inter-latin-400-normal.woff2')}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${font('inter-latin-600-normal.woff2')}); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #050506; color: #f5f3ee; font-family: Inter; }
.card { position: relative; width: 100%; height: 100%; padding: 60px 80px 56px; display: flex; flex-direction: column;
  background: radial-gradient(ellipse at 80% 20%, rgba(201,165,74,0.12), transparent 60%), #050506; }
.eyebrow { color: #c9a54a; font-size: 22px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; }
h1 { margin-top: 22px; font-family: Bebas; font-weight: 400; font-size: 118px; line-height: 0.92; letter-spacing: 0.01em; }
h1 span { color: #c9a54a; display: block; }
.sub { margin-top: 26px; max-width: 900px; color: #b9b6ae; font-size: 28px; line-height: 1.35; }
.brand { font-family: Bebas; font-size: 44px; letter-spacing: 0.08em; }
.foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; }
.chips { display: flex; align-items: center; gap: 16px; font-family: Bebas; font-size: 32px; letter-spacing: 0.06em; }
.chip { padding: 10px 22px 6px; border: 2px solid #4a4b50; border-radius: 999px; color: #f5f3ee; }
.vs { color: #c9a54a; font-size: 26px; }
</style></head><body><div class="card">
<p class="eyebrow">Free calculator for UK barbershops</p>
<h1>Chair rent or commission?<span>Run the numbers.</span></h1>
<p class="sub">Profit, break-even rent, minimum wage top-ups and employer costs for one chair.</p>
<div class="foot"><p class="brand">KERSIVO</p>
<div class="chips"><span class="chip">Commission</span><span class="vs">vs</span><span class="chip">Chair rent</span></div></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, type: 'png' });
await browser.close();
console.log(`Wrote ${out}`);
