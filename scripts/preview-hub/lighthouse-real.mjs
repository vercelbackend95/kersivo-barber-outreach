import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const outDir = join(root, 'docs/preview-hub/screens/batch-7');
const seedPath = join(root, '.preview-hub-seed.json');
const origin = process.env.PREVIEW_HUB_REAL_ORIGIN || 'http://127.0.0.1:4397';

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

const screens = [
  { name: 'overview', path: `/preview/${seed.ready.token}` },
  { name: 'details', path: `/preview/${seed.ready.token}/details` },
  { name: 'website', path: `/preview/${seed.ready.token}/website` },
  { name: 'messages', path: `/preview/${seed.ready.token}/messages` },
  { name: 'checklist', path: '/admin/preview-launch' },
];

async function signInCookie() {
  const res = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: seed.owner.email, password: seed.owner.password }),
  });
  if (!res.ok) throw new Error(`sign-in failed ${res.status}`);
  return res.headers.getSetCookie?.().join('; ') || res.headers.get('set-cookie') || '';
}

async function run() {
  await mkdir(outDir, { recursive: true });
  const cookie = await signInCookie();
  const chromePath = chromium.executablePath();
  const tmp = mkdtempSync(join(tmpdir(), 'kersivo-hub-lh-real-'));
  const summary = [];
  try {
    for (const screen of screens) {
      const outPath = join(tmp, `${screen.name}.json`);
      await execFileAsync(
        'npx',
        [
          '--yes',
          'lighthouse@12.8.2',
          `${origin}${screen.path}`,
          '--quiet',
          '--output=json',
          `--output-path=${outPath}`,
          `--chrome-path=${chromePath}`,
          '--chrome-flags=--headless --no-sandbox --disable-gpu',
          '--form-factor=mobile',
          '--screenEmulation.mobile',
          '--only-categories=performance,accessibility',
          ...(cookie ? [`--extra-headers=${JSON.stringify({ Cookie: cookie })}`] : []),
        ],
        { cwd: root, maxBuffer: 20 * 1024 * 1024, windowsHide: true, shell: true },
      );
      const result = JSON.parse(readFileSync(outPath, 'utf8'));
      const perf = Math.round((result.categories.performance?.score ?? 0) * 100);
      const a11y = Math.round((result.categories.accessibility?.score ?? 0) * 100);
      const cls = result.audits?.['cumulative-layout-shift']?.numericValue ?? null;
      summary.push({ name: screen.name, path: screen.path, performance: perf, accessibility: a11y, cls });
      console.log(`[lighthouse-real] ${screen.name} perf=${perf} a11y=${a11y} cls=${cls}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  await writeFile(join(outDir, 'lighthouse-real-mobile-summary.json'), JSON.stringify(summary, null, 2));
  const failed = summary.filter((row) => row.performance < 90 || row.accessibility < 95 || (row.cls ?? 1) >= 0.05);
  if (failed.length) {
    console.error('[lighthouse-real] thresholds missed', failed);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
