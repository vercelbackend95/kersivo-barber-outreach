/**
 * Mobile Lighthouse for /admin hub Overview (Batch 3).
 * Run against the real QA server after seed:
 *   node scripts/admin-hub/lighthouse-overview.mjs
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
const outDir = join(root, 'docs/admin-hub/screens/batch-3');
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

async function run() {
  await mkdir(outDir, { recursive: true });
  const cookie = await hubCookie();
  const chromePath = chromium.executablePath();
  const tmp = mkdtempSync(join(tmpdir(), 'kersivo-admin-hub-lh-'));
  const outPath = join(tmp, 'overview.json');
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
        `${origin}/admin`,
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
    const summary = {
      name: 'overview',
      path: '/admin',
      mode: 'astro-dev',
      origin,
      performance: Math.round((result.categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((result.categories.accessibility?.score ?? 0) * 100),
      cls: metric('cumulative-layout-shift'),
      fcpMs: metric('first-contentful-paint'),
      lcpMs: metric('largest-contentful-paint'),
      tbtMs: metric('total-blocking-time'),
      opportunities: (result.categories.performance?.auditRefs ?? [])
        .filter((ref) => result.audits[ref.id]?.details?.overallSavingsMs)
        .map((ref) => ({
          id: ref.id,
          title: result.audits[ref.id]?.title,
          savingsMs: result.audits[ref.id]?.details?.overallSavingsMs,
        }))
        .sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0))
        .slice(0, 8),
    };
    console.log(`[lighthouse-admin-hub] overview perf=${summary.performance} a11y=${summary.accessibility} cls=${summary.cls}`);
    await writeFile(join(outDir, 'lighthouse-overview-mobile-summary.json'), JSON.stringify(summary, null, 2));
    if (summary.performance < 90 || summary.accessibility < 95 || (summary.cls ?? 1) >= 0.05) {
      console.error('[lighthouse-admin-hub] thresholds missed', summary);
      process.exit(1);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
