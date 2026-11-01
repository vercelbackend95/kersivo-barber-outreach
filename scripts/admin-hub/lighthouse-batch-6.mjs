/**
 * Mobile Lighthouse for /admin hub Overview and Website (Batch 6).
 * Measured on astro dev — performance is not the production bar.
 */
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const outDir = join(root, 'docs/admin-hub/screens/batch-6');
const seedPath = join(root, '.preview-hub-seed.json');
const origin = process.env.PREVIEW_HUB_REAL_ORIGIN || 'http://127.0.0.1:4397';
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

async function hubCookie() {
  const res = await fetch(`${origin}/preview/${seed.ready.token}`, { redirect: 'manual' });
  const raw = res.headers.getSetCookie?.() ?? [];
  const cookie = raw.find((value) => value.startsWith('ks_hub='));
  if (!cookie) throw new Error(`no ks_hub cookie from ${res.status}`);
  return cookie.split(';')[0];
}

async function measure(path, cookie, chromePath) {
  const tmp = mkdtempSync(join(tmpdir(), 'kersivo-admin-hub-lh6-'));
  const outPath = join(tmp, 'page.json');
  const configPath = join(tmp, 'lh-config.json');
  writeFileSync(
    configPath,
    JSON.stringify({
      extends: 'lighthouse:default',
      settings: {
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2.625, disabled: false },
        onlyCategories: ['performance', 'accessibility'],
        extraHeaders: { Cookie: cookie },
      },
    }),
  );
  try {
    await execFileAsync(
      'npx',
      [
        '--yes',
        'lighthouse@12.8.2',
        `${origin}${path}`,
        '--quiet',
        '--output=json',
        `--output-path=${outPath}`,
        `--chrome-path=${chromePath}`,
        '--chrome-flags=--headless --no-sandbox --disable-gpu',
        `--config-path=${configPath}`,
      ],
      { cwd: root, maxBuffer: 20 * 1024 * 1024, windowsHide: true, shell: true },
    );
    const result = JSON.parse(readFileSync(outPath, 'utf8'));
    const metric = (id) => result.audits?.[id]?.numericValue ?? null;
    return {
      path,
      mode: 'astro-dev',
      performance: Math.round((result.categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((result.categories.accessibility?.score ?? 0) * 100),
      cls: metric('cumulative-layout-shift'),
      fcpMs: metric('first-contentful-paint'),
      lcpMs: metric('largest-contentful-paint'),
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function run() {
  await mkdir(outDir, { recursive: true });
  const cookie = await hubCookie();
  const chromePath = chromium.executablePath();
  const overview = await measure('/admin', cookie, chromePath);
  const website = await measure('/admin/website', cookie, chromePath);
  const summary = { overview, website, origin };
  console.log(
    `[lighthouse-admin-hub] overview perf=${overview.performance} a11y=${overview.accessibility} cls=${overview.cls}`,
  );
  console.log(
    `[lighthouse-admin-hub] website perf=${website.performance} a11y=${website.accessibility} cls=${website.cls}`,
  );
  await writeFile(join(outDir, 'lighthouse-mobile-summary.json'), JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
