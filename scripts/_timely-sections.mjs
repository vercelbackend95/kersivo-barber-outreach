// Section-by-section screenshots of /timely-alternative. Usage: node scripts/_timely-sections.mjs <base> <outDir> <width>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [base, out, w = '1440'] = process.argv.slice(2);
const width = Number(w);
mkdirSync(out, { recursive: true });
let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
const page = await browser.newPage({ viewport: { width, height: width < 768 ? 812 : 900 } });
await page.goto(`${base}/timely-alternative`, { waitUntil: 'networkidle' });
const height = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < height; y += 400) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(50); }
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(2500);
const ids = ['.ta-hero', '#quick-answer', '#timely-pricing', '#bill-builder', '#your-week', '#comparison', '#switching', '#pricing'];
for (const [i, sel] of ids.entries()) {
  await page.locator(sel).screenshot({ path: `${out}/s${width}-${i}.png` });
}
await browser.close();
