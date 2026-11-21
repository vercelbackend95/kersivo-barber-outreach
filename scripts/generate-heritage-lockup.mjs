/**
 * Renders the Heritage Grooming logo lockup (seal + "Heritage Grooming" in Libre Caslon Text,
 * as in the demo site's nav) to a transparent 3:1 image for the marketing-page drawings.
 *
 *   node scripts/generate-heritage-lockup.mjs
 *
 * Output: public/images/heritage/heritage-lockup.webp (648×216) and a @2x PNG source next to it.
 * Needs network access for the Google Fonts stylesheet the demo site itself uses.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = process.cwd();
const outDir = join(root, 'public/images/heritage');
mkdirSync(outDir, { recursive: true });
const seal = readFileSync(join(root, 'public/demo/heritage-grooming/assets/img/seal-192.webp')).toString('base64');

const html = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; background: transparent; }
  .lockup { width: 648px; height: 216px; display: flex; align-items: center; gap: 30px; padding: 0 6px; box-sizing: border-box; }
  .lockup img { width: 168px; height: 168px; border-radius: 50%; padding: 4px; background: #0a100f;
    box-shadow: 0 0 0 3px #c6a766; filter: brightness(1.22) contrast(1.08); flex: none; }
  .lockup span { font: 400 64px/1.02 'Libre Caslon Text', Georgia, serif; color: #efe8d8; letter-spacing: .005em; }
  .lockup i { font-style: normal; color: #c6a766; display: block; }
</style></head><body>
<div class="lockup"><img src="data:image/webp;base64,${seal}" alt=""><span>Heritage <i>Grooming</i></span></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const png = await page.locator('.lockup').screenshot({ omitBackground: true });
await browser.close();

writeFileSync(join(outDir, 'heritage-lockup@2x.png'), png);
await sharp(png).resize(648, 216).webp({ quality: 92, alphaQuality: 100 }).toFile(join(outDir, 'heritage-lockup.webp'));
await sharp(png).webp({ quality: 90, alphaQuality: 100 }).toFile(join(outDir, 'heritage-lockup@2x.webp'));
console.log('wrote', outDir);
