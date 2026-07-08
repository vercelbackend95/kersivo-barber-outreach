import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded', timeout: 60000 });

const immediate = await page.evaluate(() => ({
  isw: Boolean(document.querySelector('.isw')),
  iswH: document.querySelector('.isw')?.getBoundingClientRect().height ?? 0,
  cardOpacities: Array.from(document.querySelectorAll('[data-feature261-card]')).map((c) => getComputedStyle(c).opacity),
  enhanced: document.querySelector('.feature261')?.getAttribute('data-feature261-enhanced'),
}));

console.log('Immediate after DOMContentLoaded:', immediate);

await page.waitForTimeout(500);
const after500 = await page.evaluate(() => ({
  isw: Boolean(document.querySelector('.isw')),
  iswH: document.querySelector('.isw')?.getBoundingClientRect().height ?? 0,
  cardOpacities: Array.from(document.querySelectorAll('[data-feature261-card]')).map((c) => getComputedStyle(c).opacity),
}));

console.log('After 500ms:', after500);

await page.waitForLoadState('networkidle');
await page.waitForTimeout(100);
const afterIdle = await page.evaluate(() => ({
  isw: Boolean(document.querySelector('.isw')),
  iswH: document.querySelector('.isw')?.getBoundingClientRect().height ?? 0,
  cardOpacities: Array.from(document.querySelectorAll('[data-feature261-card]')).map((c) => getComputedStyle(c).opacity),
}));

console.log('After networkidle:', afterIdle);

await browser.close();
