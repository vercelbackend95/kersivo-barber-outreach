/**
 * Shop Hub Batch 6 screenshots (360px and 1280px).
 *
 *   node scripts/preview-hub/capture-batch-6.mjs
 */
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { CAPTURE_SCREENS, screenHtml } from './hub-screens.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/preview-hub/screens/batch-6');
mkdirSync(outDir, { recursive: true });

const server = createServer((req, res) => {
  const name = (req.url || '/').replace(/^\//, '').split('?')[0];
  if (!CAPTURE_SCREENS.includes(name)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(screenHtml(name));
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });
const saved = [];

try {
  for (const name of CAPTURE_SCREENS) {
    for (const width of [360, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: width === 360 ? 800 : 900 } });
      await page.goto(`http://127.0.0.1:${port}/${name}`, { waitUntil: 'domcontentloaded' });
      const file = `${name}-${width}.png`;
      await page.screenshot({ path: join(outDir, file), fullPage: true });
      saved.push(file);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(saved.join('\n'));
