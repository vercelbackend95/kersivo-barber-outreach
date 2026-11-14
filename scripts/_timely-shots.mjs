// QA for /timely-alternative: full-page screenshots, overflow, console errors, builder interaction.
// Usage: node scripts/_timely-shots.mjs <baseUrl> <outDir> [label]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [base = 'http://localhost:4341', out = 'shots', label = 'after'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
const report = [];
for (const width of [375, 768, 1024, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: width < 768 ? 812 : 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/timely-alternative`, { waitUntil: 'networkidle' });
  // Scroll through so reveals and the week timeline settle.
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 400) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(60); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2600);
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [...document.querySelectorAll('main.ta *')].filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1).slice(0, 5).map((el) => el.className || el.tagName);
    const hidden = [...document.querySelectorAll('[data-ta-reveal]')].filter((el) => getComputedStyle(el).opacity !== '1').length;
    const slots = [...document.querySelectorAll('[data-ta-slot]')].filter((el) => getComputedStyle(el).opacity !== '1').length;
    return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, wide, hiddenReveals: hidden, hiddenSlots: slots, h1: document.querySelectorAll('h1').length };
  });
  // Builder interaction: tick waitlist + type an invoice.
  const builder = page.locator('[data-ta-builder]');
  await builder.scrollIntoViewIfNeeded();
  await page.locator('label.ta-chip', { hasText: 'Waitlist' }).click();
  await page.fill('#ta-actual', '20');
  await page.waitForTimeout(700);
  const result = await page.evaluate(() => ({
    tier: document.querySelector('[data-ta-out="tier"]').textContent,
    timely: document.querySelector('[data-ta-out="timely"]').textContent,
    kersivo: document.querySelector('[data-ta-out="kersivo"]').textContent,
    verdict: document.querySelector('[data-ta-out="verdict"]').textContent,
    missing: document.querySelector('[data-ta-out="missing"]').textContent,
  }));
  await page.screenshot({ path: `${out}/${label}-${width}-builder.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${label}-${width}.png`, fullPage: true });
  report.push({ width, ...metrics, errors, result });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
