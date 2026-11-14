// Usage: node scripts/_ai-visibility-shots.mjs <baseUrl> <label>
// Screenshots the pages touched by the seo/ai-visibility batch at 375 and 1440 px.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [baseUrl = 'http://localhost:4330', label = 'before'] = process.argv.slice(2);
const outDir = process.env.SHOTS_DIR ?? 'C:/tmp/kersivo-shots/ai-visibility';
mkdirSync(outDir, { recursive: true });
const widths = [375, 1440];
const paths = [
  '/compare',
  '/booksy-alternative',
  '/fresha-alternative',
  '/treatwell-alternative',
  '/vagaro-alternative',
  '/square-appointments-alternative',
  '/nearcut-alternative',
  '/timely-alternative',
  '/phorest-alternative',
  '/squire-alternative',
  '/setora-alternative',
  '/about',
];

const browser = await chromium.launch();
for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: width < 700 ? 812 : 900 }, deviceScaleFactor: 1 });
  for (const path of paths) {
   for (let attempt = 1; attempt <= 3; attempt++) {
    const page = await context.newPage();
    try {
    await page.goto(baseUrl + path, { waitUntil: 'load', timeout: 180000 });
    await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} *{animation-duration:0s!important;transition-duration:0s!important}' });
    try {
      const reject = page.getByRole('button', { name: 'Reject optional' });
      await reject.waitFor({ state: 'visible', timeout: 2500 });
      await reject.click();
    } catch {}
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const slug = path.replace(/\//g, '') || 'home';
    const target = path === '/about' ? page.locator('#at-a-glance') : page.locator('[data-in-short]');
    const file = join(outDir, `${label}-${slug}-${width}.png`);
    if (await target.count()) {
      await target.first().scrollIntoViewIfNeeded();
      const box = await target.first().boundingBox();
      const y = Math.max(0, (box?.y ?? 0) + (await page.evaluate(() => window.scrollY)) - 300);
      await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y, width, height: Math.min(2200, (box?.height ?? 0) + 900) } });
    } else {
      await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width, height: 2200 } });
    }
    console.log(`${file} overflowX=${overflow}`);
    await page.close();
    break;
    } catch (error) {
      console.log(`retry ${path} @${width}: ${String(error).split(String.fromCharCode(10))[0]}`);
      await page.close();
      await new Promise((r) => setTimeout(r, 3000));
    }
   }
  }
  await context.close();
}
await browser.close();
