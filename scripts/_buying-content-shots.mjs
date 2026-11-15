// Usage: node scripts/_buying-content-shots.mjs <baseUrl> <label> <path...>
// Full-page screenshots at 375/768/1024/1440 plus horizontal-overflow and console-error checks.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [baseUrl, label, ...paths] = process.argv.slice(2);
const outDir = process.env.SHOTS_DIR ?? 'C:/tmp/kersivo-shots/buying-content';
mkdirSync(outDir, { recursive: true });
const widths = (process.env.WIDTHS ?? '375,768,1024,1440').split(',').map(Number);
const browser = await chromium.launch();
for (const path of paths) {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const res = await page.goto(baseUrl + path, { waitUntil: 'load', timeout: 180000 });
    await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
    try { const r = page.getByRole('button', { name: 'Reject optional' }); await r.waitFor({ state: 'visible', timeout: 3000 }); await r.click(); } catch {}
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const file = `${outDir}/${label}${path.replace(/\//g, '_') || '_home'}-${width}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(JSON.stringify({ path, width, status: res?.status(), overflow, errors: errors.slice(0, 3), file }));
    await context.close();
  }
}
await browser.close();
