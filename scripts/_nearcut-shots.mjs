// QA for /nearcut-alternative: full-page screenshots, overflow, console errors, interactions.
// Usage: node scripts/_nearcut-shots.mjs <baseUrl> <outDir> [label] [--no-interact]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const interact = !process.argv.includes('--no-interact');
const [base = 'http://localhost:4352', out = 'shots', label = 'after'] = args;
mkdirSync(out, { recursive: true });
let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
const context = await browser.newContext();
if (process.env.AUTH_URL) { const p0 = await context.newPage(); await p0.goto(process.env.AUTH_URL); await p0.close(); }
const report = [];
for (const width of [375, 768, 1024, 1440]) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/nearcut-alternative`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3600);
  const reject = page.getByRole('button', { name: 'Reject optional' });
  if (await reject.isVisible().catch(() => false)) await reject.click();
  await page.screenshot({ path: `${out}/${label}-${width}-hero.png` });
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 500) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(50); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [...document.querySelectorAll('main *')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > doc.clientWidth + 1 && !el.closest('.nc-tabs, .nc-site, .nc-plain, [class*="rail"], [class*="carousel"]'); })
      .slice(0, 6).map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`);
    const smallTargets = [...document.querySelectorAll('main.nc a, main.nc button, main.nc input')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 24 && !el.closest('p, li, .nc-breadcrumb'); })
      .slice(0, 6).map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40));
    return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, wide, smallTargets, h1: document.querySelectorAll('h1').length };
  });
  let result = null;
  if (interact) {
    // Hero slider via keyboard.
    const range = page.locator('[data-nc-range]');
    await range.focus();
    await page.keyboard.press('Home');
    const posHome = await page.evaluate(() => getComputedStyle(document.querySelector('[data-nc-compare]')).getPropertyValue('--pos'));
    await page.keyboard.press('End');
    const posEnd = await page.evaluate(() => document.querySelector('[data-nc-compare]').style.getPropertyValue('--pos'));
    // Anatomy: click "book".
    const btn = page.locator('[data-nc-part-btn="book"]');
    await btn.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(300);
    await btn.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${label}-${width}-anatomy.png` });
    const anatomy = await page.evaluate(() => {
      const frame = document.querySelector('[data-nc-anatomy-frame]');
      const part = frame.querySelector('[data-nc-part="book"]').getBoundingClientRect();
      const vp = frame.querySelector('.nc-site__viewport').getBoundingClientRect();
      return { active: frame.dataset.active, partVisible: part.top >= vp.top - 1 && part.top < vp.bottom, pressed: document.querySelector('[data-nc-part-btn="book"]').getAttribute('aria-pressed') };
    });
    // Estimator.
    const est = page.locator('[data-nc-bookings]');
    await est.scrollIntoViewIfNeeded();
    await est.fill('400');
    await page.waitForTimeout(800);
    const estimate = await page.evaluate(() => ({
      bookings: document.querySelector('[data-nc-out="bookings"]').textContent,
      monthly: document.querySelector('[data-nc-out="monthly"]').textContent,
      yearly: document.querySelector('[data-nc-out="yearly"]').textContent,
    }));
    await page.screenshot({ path: `${out}/${label}-${width}-estimator.png` });
    // Tabs.
    const tab = page.locator('#nc-tab-brand');
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await page.keyboard.press('ArrowRight');
    const tabs = await page.evaluate(() => ({
      selected: document.querySelector('[role="tab"][aria-selected="true"]').id,
      visiblePanels: [...document.querySelectorAll('.nc-tabs__panel')].filter((p) => !p.hidden).map((p) => p.id),
      focused: document.activeElement?.id,
    }));
    result = { posHome, posEnd, anatomy, estimate, tabs };
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${out}/${label}-${width}.png`, fullPage: true });
  report.push({ width, ...metrics, errors: errors.slice(0, 5), result });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
