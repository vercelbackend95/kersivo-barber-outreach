/**
 * Lighthouse mobile on a Shop Hub Overview fixture (same CSS + structure as capture-batch-1).
 *
 *   node scripts/preview-hub/lighthouse-overview.mjs
 */
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/preview-hub/screens/batch-1');
mkdirSync(outDir, { recursive: true });

const css = [
  'src/styles/tokens.css',
  'src/styles/global.css',
  'src/styles/components/buttons.css',
  'src/styles/components/ks-glass-card.css',
  'src/styles/components/preview-hub.css',
]
  .map((rel) => readFileSync(join(root, rel), 'utf8'))
  .join('\n');

const html = `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>We've got your request</title>
  <style>
    ${css}
    body.admin-theme-premium-black { --bg:#030303; --fg:#fff8ee; background:#030303; color:#fff8ee; margin:0; font-family: Inter, system-ui, sans-serif; }
    .btn { min-height: 44px; }
  </style>
</head>
<body class="admin-theme-premium-black hub-page-body">
  <div class="hub-shell">
    <a class="hub-shell__skip" href="#hub-main">Skip to content</a>
    <aside class="hub-sidebar" aria-label="Shop hub">
      <div class="hub-brand">
        <p class="hub-brand__mark">KERSIVO</p>
        <p class="hub-brand__shop">Sharp Cuts</p>
        <p class="hub-stage-pill hub-stage-pill--requested">Requested</p>
        <p class="hub-private">Private · hidden from search engines</p>
      </div>
      <nav class="hub-nav" aria-label="Hub sections">
        <a class="hub-nav__item" aria-current="page" href="#">Overview</a>
        <a class="hub-nav__item is-locked" href="#" title="Available when your preview is ready">Website</a>
        <a class="hub-nav__item" href="#">Your shop</a>
        <a class="hub-nav__item is-locked" href="#" title="Available when your preview is ready">Changes</a>
        <a class="hub-nav__item" href="#">Messages</a>
      </nav>
      <div class="hub-sidebar__footer">
        <p>Questions? Message us</p>
        <a class="btn btn--secondary btn--sm" href="#">Message us</a>
      </div>
    </aside>
    <div class="hub-content">
      <header class="hub-topbar">
        <p class="hub-topbar__shop">Sharp Cuts</p>
        <p class="hub-stage-pill">Requested</p>
        <a class="hub-topbar__msg" href="#" aria-label="Messages"></a>
      </header>
      <p class="hub-private hub-private--mobile">Private · hidden from search engines</p>
      <div class="hub-main" id="hub-main">
        <div class="hub-main__inner">
          <article class="hub-overview">
            <header class="hub-header">
              <div>
                <h1>We've got your request</h1>
                <p class="hub-header__sub">We'll start designing Sharp Cuts's website soon. Add anything that helps — it's all optional.</p>
              </div>
              <div class="hub-header__actions">
                <a class="btn btn--primary" href="#">Add photos or a logo</a>
              </div>
            </header>
            <ol class="hub-stepper" aria-label="Preview progress">
              <li class="hub-stepper__item is-current"><span class="hub-stepper__bar"></span><span class="hub-stepper__label">Requested</span></li>
              <li class="hub-stepper__item is-upcoming"><span class="hub-stepper__bar"></span><span class="hub-stepper__label">Designing</span></li>
              <li class="hub-stepper__item is-upcoming"><span class="hub-stepper__bar"></span><span class="hub-stepper__label">Review</span></li>
              <li class="hub-stepper__item is-upcoming"><span class="hub-stepper__bar"></span><span class="hub-stepper__label">Launch</span></li>
              <li class="hub-stepper__item is-upcoming"><span class="hub-stepper__bar"></span><span class="hub-stepper__label">Live</span></li>
            </ol>
            <section class="hub-card ks-glass-card ks-glass-card--accent" aria-labelledby="hub-now-title">
              <h2 id="hub-now-title" class="hub-card__title">Now</h2>
              <div class="hub-now">
                <div><h3>What we're doing</h3><p>We've got your request and we'll start designing soon.</p></div>
                <div><h3>What we need from you</h3><p>Add anything that helps — logo, photos or a photo of your price list. It is all optional.</p></div>
              </div>
            </section>
            <section class="hub-card ks-glass-card" aria-labelledby="hub-preview-title">
              <h2 id="hub-preview-title" class="hub-card__title">Your preview</h2>
              <div class="hub-preview-lock">
                <p class="ks-eyebrow">Sharp Cuts</p>
                <p>Your preview will appear here</p>
              </div>
            </section>
            <section class="hub-card ks-glass-card" aria-labelledby="hub-activity-title">
              <h2 id="hub-activity-title" class="hub-card__title">Activity</h2>
              <ol class="hub-activity"><li><span>Request received</span><time datetime="2026-10-29T12:00:00.000Z">2 days ago</time></li></ol>
            </section>
            <section class="hub-card ks-glass-card" aria-labelledby="hub-help-title">
              <h2 id="hub-help-title" class="hub-card__title">Need a hand?</h2>
              <p class="hub-card__body">Questions about your preview? Message us here or by email.</p>
              <div class="hub-help__row">
                <a class="btn btn--secondary btn--sm" href="#">Message KERSIVO</a>
                <a class="btn btn--ghost btn--sm" href="mailto:hello@kersivo.co.uk">hello@kersivo.co.uk</a>
              </div>
            </section>
          </article>
        </div>
      </div>
    </div>
    <nav class="hub-tabs" aria-label="Hub pages">
      <a class="hub-tabs__item" aria-current="page" href="#">Overview</a>
      <a class="hub-tabs__item is-locked" href="#" title="Available when your preview is ready">Website</a>
      <a class="hub-tabs__item" href="#">Your shop</a>
      <a class="hub-tabs__item is-locked" href="#" title="Available when your preview is ready">Changes</a>
      <a class="hub-tabs__item" href="#">Messages</a>
    </nav>
  </div>
</body>
</html>`;

const server = createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/overview`;
const tmp = mkdtempSync(join(tmpdir(), 'kersivo-hub-lh-'));
const outPath = join(tmp, 'lighthouse-overview-mobile.json');
const chromePath = chromium.executablePath();

try {
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
  const summary = { performance, accessibility, a11yFailed };
  writeFileSync(join(outDir, 'lighthouse-overview-mobile-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (performance < 90 || accessibility < 95) {
    process.exitCode = 1;
  }
} finally {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}
