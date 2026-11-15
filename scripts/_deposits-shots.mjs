// Screenshots of the /compare #deposits section at 4 widths + horizontal-overflow check.
import { chromium } from 'playwright';
const [baseUrl, label] = process.argv.slice(2);
const out = 'C:/tmp/kersivo-shots/buying-content';
const browser = await chromium.launch();
for (const width of [375, 768, 1024, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${baseUrl}/compare`, { waitUntil: 'networkidle' });
  const section = page.locator('#deposits');
  const exists = await section.count();
  if (exists) {
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: `${out}/compare-deposits-${label}-${width}.png` });
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(width, { exists, overflow, errors });
  await page.close();
}
await browser.close();
