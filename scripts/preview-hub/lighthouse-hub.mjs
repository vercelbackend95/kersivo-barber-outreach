/**
 * Lighthouse mobile on Shop Hub Overview, Details, Website, Messages.
 *
 *   node scripts/preview-hub/lighthouse-hub.mjs
 */
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import { LIGHTHOUSE_SCREENS, screenHtml } from './hub-screens.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/preview-hub/screens/batch-6');
mkdirSync(outDir, { recursive: true });

const server = createServer((req, res) => {
  const name = (req.url || '/').replace(/^\//, '').split('?')[0] || 'overview';
  if (!LIGHTHOUSE_SCREENS.includes(name)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(screenHtml(name));
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const chromePath = chromium.executablePath();
const tmp = mkdtempSync(join(tmpdir(), 'kersivo-hub-lh-'));
const summary = {};

try {
  for (const name of LIGHTHOUSE_SCREENS) {
    const url = `http://127.0.0.1:${port}/${name}`;
    const outPath = join(tmp, `${name}.json`);
    await execFileAsync(
      'npx',
      [
        '--yes',
        'lighthouse@12.8.2',
        url,
        '--quiet',
        '--output=json',
        `--output-path=${outPath}`,
        `--chrome-path=${chromePath}`,
        '--chrome-flags=--headless --no-sandbox --disable-gpu',
        '--form-factor=mobile',
        '--screenEmulation.mobile',
        '--only-categories=performance,accessibility',
      ],
      { cwd: root, maxBuffer: 20 * 1024 * 1024, windowsHide: true, shell: true },
    );
    const result = JSON.parse(readFileSync(outPath, 'utf8'));
    const performance = Math.round((result.categories.performance?.score ?? 0) * 100);
    const accessibility = Math.round((result.categories.accessibility?.score ?? 0) * 100);
    const a11yFailed = (result.categories.accessibility?.auditRefs || [])
      .filter((ref) => result.audits[ref.id]?.score === 0 && result.audits[ref.id]?.scoreDisplayMode === 'binary')
      .map((ref) => ref.id);
    summary[name] = { performance, accessibility, a11yFailed };
    if (performance < 90 || accessibility < 95) process.exitCode = 1;
  }
  writeFileSync(join(outDir, 'lighthouse-hub-mobile-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}
