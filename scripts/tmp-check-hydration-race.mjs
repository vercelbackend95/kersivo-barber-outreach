import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => {
  document.querySelector('.feature261')?.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(300);
const beforeHydration = await page.evaluate(() => ({
  visible: Array.from(document.querySelectorAll('[data-feature261-card]')).map((c) => c.getAttribute('data-feature261-visible')),
  opacity: Array.from(document.querySelectorAll('[data-feature261-card]')).map((c) => getComputedStyle(c).opacity),
}));
console.log('After scroll, before hydration:', beforeHydration);

await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);
const afterHydration = await page.evaluate(() => ({
  visible: Array.from(document.querySelectorAll('[data-feature261-card]')).map((c) => c.getAttribute('data-feature261-visible')),
  opacity: Array.from(document.querySelectorAll('[data-feature261-card]')).map((c) => getComputedStyle(c).opacity),
  enhanced: document.querySelector('.feature261')?.getAttribute('data-feature261-enhanced'),
  iswH: document.querySelector('.isw')?.getBoundingClientRect().height ?? 0,
}));
console.log('After hydration (scrolled earlier):', afterHydration);

await browser.close();
