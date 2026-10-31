/**
 * Shop Hub Batch 5 screenshots (360px and 1280px).
 *
 *   node scripts/preview-hub/capture-batch-5.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/preview-hub/screens/batch-5');
mkdirSync(outDir, { recursive: true });

const hubCss = [
  'src/styles/tokens.css',
  'src/styles/global.css',
  'src/styles/components/buttons.css',
  'src/styles/components/inputs.css',
  'src/styles/components/ks-glass-card.css',
  'src/styles/components/preview-hub.css',
]
  .map((rel) => readFileSync(join(root, rel), 'utf8'))
  .join('\n');

const opsCss = [
  'src/styles/tokens.css',
  'src/styles/global.css',
  'src/styles/components/buttons.css',
  'src/styles/components/badge.css',
  'src/styles/components/ops-recommendations.css',
  'src/styles/components/ops-preview-requests.css',
  'src/styles/components/preview-hub.css',
]
  .map((rel) => readFileSync(join(root, rel), 'utf8'))
  .join('\n');

const TABS = ['Overview', 'Website', 'Your shop', 'Changes', 'Messages'];

function hubPage(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title}</title>
<style>${hubCss}
body.admin-theme-premium-black { --bg:#030303; --fg:#fff8ee; background:#030303; color:#fff8ee; margin:0; font-family: Inter, system-ui, sans-serif; }
.btn { min-height: 44px; }
</style></head>
<body class="admin-theme-premium-black hub-page-body">${body}</body></html>`;
}

function opsPage(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>${opsCss}
body.admin-theme-premium-black { --bg:#030303; --fg:#fff8ee; background:#030303; color:#fff8ee; margin:0; font-family: Inter, system-ui, sans-serif; padding: 24px; }
</style></head>
<body class="admin-theme-premium-black ops-app">${body}</body></html>`;
}

function shell(inner, { currentTab = 0, stage = 'launch', stageLabel = 'Launch' } = {}) {
  const nav = TABS.map((label, i) => {
    const current = i === currentTab ? ' aria-current="page"' : '';
    return `<a class="hub-nav__item"${current} href="#">${label}</a>`;
  }).join('');
  const tabs = TABS.map((label, i) => {
    const current = i === currentTab ? ' aria-current="page"' : '';
    return `<a class="hub-tabs__item"${current} href="#">${label}</a>`;
  }).join('');
  return `<div class="hub-shell">
    <aside class="hub-sidebar" aria-label="Shop hub">
      <div class="hub-brand">
        <p class="hub-brand__mark">KERSIVO</p>
        <p class="hub-brand__shop">Sharp Cuts</p>
        <p class="hub-stage-pill hub-stage-pill--${stage}">${stageLabel}</p>
        <p class="hub-private">Private · hidden from search engines</p>
      </div>
      <nav class="hub-nav" aria-label="Hub sections">${nav}</nav>
    </aside>
    <div class="hub-content">
      <header class="hub-topbar">
        <p class="hub-topbar__shop">Sharp Cuts</p>
        <p class="hub-stage-pill hub-stage-pill--${stage}">${stageLabel}</p>
      </header>
      <div class="hub-main" id="hub-main"><div class="hub-main__inner">${inner}</div></div>
    </div>
    <nav class="hub-tabs" aria-label="Hub pages">${tabs}</nav>
  </div>`;
}

const launchChecklistSole = `<div class="hub-launch">
  <header class="hub-launch__header">
    <h1>Launch checklist</h1>
    <p class="hub-launch__progress">1 of 5 done</p>
    <div class="hub-launch__bar" role="progressbar" aria-valuenow="1" aria-valuemin="0" aria-valuemax="5"><span style="width:20%"></span></div>
    <p class="hub-launch__save" role="status">Saved</p>
  </header>
  <section class="hub-card ks-glass-card hub-launch__item">
    <button type="button" class="hub-launch__item-toggle" aria-expanded="true"><span>Business details</span><span class="hub-launch__chip is-done">Done</span></button>
    <div class="hub-launch__item-body">
      <div class="hub-launch__grid">
        <label>Name shown on your website<input class="input" value="Sharp Cuts" readonly></label>
        <label>Public email<input class="input" value="hello@sharpcuts.co.uk"></label>
        <fieldset class="hub-launch__ltd">
          <legend>Is your shop a limited company?</legend>
          <p class="hub-launch__hint">Limited companies must show their registered name, number and office address on their website. We'll add them to your footer.</p>
          <label class="fpo-check"><input type="radio" name="ltd" checked><span>No</span></label>
          <label class="fpo-check"><input type="radio" name="ltd2"><span>Yes</span></label>
        </fieldset>
      </div>
    </div>
  </section>
  <section class="hub-card ks-glass-card hub-launch__item">
    <button type="button" class="hub-launch__item-toggle" aria-expanded="false"><span>Domain</span><span class="hub-launch__chip is-todo">To do</span></button>
  </section>
  <section class="hub-card ks-glass-card hub-launch__item">
    <button type="button" class="hub-launch__item-toggle" aria-expanded="false"><span>Payments (optional)</span><span class="hub-launch__chip is-todo">To do</span></button>
  </section>
  <section class="hub-card ks-glass-card hub-launch__item">
    <button type="button" class="hub-launch__item-toggle" aria-expanded="false"><span>Moving your clients (optional)</span><span class="hub-launch__chip is-todo">To do</span></button>
  </section>
  <section class="hub-card ks-glass-card hub-launch__item">
    <button type="button" class="hub-launch__item-toggle" aria-expanded="false"><span>Approve your website</span><span class="hub-launch__chip is-todo">To do</span></button>
  </section>
</div>`;

const launchChecklistLtd = `<div class="hub-launch">
  <header class="hub-launch__header">
    <h1>Launch checklist</h1>
    <p class="hub-launch__progress">0 of 5 done</p>
    <div class="hub-launch__bar"><span style="width:0%"></span></div>
  </header>
  <section class="hub-card ks-glass-card hub-launch__item">
    <button type="button" class="hub-launch__item-toggle" aria-expanded="true"><span>Business details</span><span class="hub-launch__chip is-todo">To do</span></button>
    <div class="hub-launch__item-body">
      <div class="hub-launch__grid">
        <fieldset class="hub-launch__ltd">
          <legend>Is your shop a limited company?</legend>
          <label class="fpo-check"><input type="radio" name="ltd" checked><span>Yes</span></label>
        </fieldset>
        <label>Registered company name<input class="input" value="Sharp Cuts Ltd"></label>
        <label>Company number<input class="input" value="SC123456" maxlength="8"></label>
        <p class="hub-launch__hint">Eight characters. Use the SC, NI or OC prefix when Companies House shows one.</p>
        <label>Registered office address<textarea class="input" rows="3">1 Queen Street, Edinburgh</textarea></label>
      </div>
    </div>
  </section>
</div>`;

const hubLaunch = `<article class="hub-overview">
  <header class="hub-header"><div><h1>Let's put Sharp Cuts live</h1><p class="hub-header__sub">A few details from you, then we connect your domain and publish.</p></div>
  <div class="hub-header__actions"><a class="btn btn--primary" href="#">Finish in your dashboard</a></div></header>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Launch progress</h2>
    <div class="hub-launch-progress">
      <div>
        <h3>Your steps</h3>
        <ul class="hub-checklist">
          <li class="hub-checklist__item is-done"><span class="hub-checklist__mark"></span><span>Business details<span class="hub-checklist__hint">Done</span></span></li>
          <li class="hub-checklist__item is-todo"><span class="hub-checklist__mark"></span><span>Domain<span class="hub-checklist__hint">To do</span></span></li>
          <li class="hub-checklist__item is-done"><span class="hub-checklist__mark"></span><span>Payments (optional)<span class="hub-checklist__hint">Done</span></span></li>
          <li class="hub-checklist__item is-done"><span class="hub-checklist__mark"></span><span>Moving your clients (optional)<span class="hub-checklist__hint">Done</span></span></li>
          <li class="hub-checklist__item is-todo"><span class="hub-checklist__mark"></span><span>Approve your website<span class="hub-checklist__hint">To do</span></span></li>
        </ul>
        <a class="btn btn--primary btn--sm" href="#">Finish in your dashboard</a>
      </div>
      <div>
        <h3>Our steps</h3>
        <ul class="hub-checklist">
          <li class="hub-checklist__item is-todo"><span class="hub-checklist__mark"></span><span>Connect your domain<span class="hub-checklist__hint">Pending</span></span></li>
          <li class="hub-checklist__item is-todo"><span class="hub-checklist__mark"></span><span>Secure it (SSL)<span class="hub-checklist__hint">Pending</span></span></li>
          <li class="hub-checklist__item is-todo"><span class="hub-checklist__mark"></span><span>Publish your website<span class="hub-checklist__hint">Pending</span></span></li>
        </ul>
      </div>
    </div>
  </section>
</article>`;

const hubLive = `<article class="hub-overview">
  <header class="hub-header"><div><h1>Sharp Cuts is live</h1><p class="hub-header__sub">Your website and booking page are open to clients.</p></div>
  <div class="hub-header__actions"><a class="btn btn--primary" href="#">Go to your dashboard</a></div></header>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Sharp Cuts</h2>
    <a class="btn btn--primary btn--sm" href="#">Open your live website</a>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Next in your dashboard</h2>
    <ul class="hub-live-next">
      <li><a class="hub-live-next__card" href="#">Add your booking link to Google</a></li>
      <li><a class="hub-live-next__card" href="#">Order your QR Kit</a></li>
      <li><a class="hub-live-next__card" href="#">Set deposits (optional)</a></li>
      <li><a class="hub-live-next__card" href="#">Start selling products</a></li>
      <li><a class="hub-live-next__card" href="#">Add your team's working hours</a></li>
    </ul>
  </section>
</article>`;

const opsList = `<article class="ops-card">
  <div class="ops-card__top">
    <div><h2 class="ops-card__name">Sharp Cuts</h2><p class="ops-card__meta">Leeds · 2h</p></div>
    <div>
      <span class="ops-pr__status ops-pr__status--converted">Converted</span>
      <span class="ops-pr__status ops-pr__status--approved">Approved — ready to launch</span>
    </div>
  </div>
</article>`;

const opsLaunch = `<section class="ops-pr-actions__block">
  <h2 class="ops-pr-actions__title">Launch steps</h2>
  <div class="ops-pr-actions__row">
    <button class="btn btn--secondary btn--sm">Domain connected</button>
    <button class="btn btn--secondary btn--sm">SSL active</button>
    <button class="btn btn--primary btn--sm">Mark live</button>
  </div>
</section>`;

const shots = [
  ['checklist-sole', hubPage('Launch sole trader', launchChecklistSole)],
  ['checklist-ltd', hubPage('Launch Ltd', launchChecklistLtd)],
  ['overview-launch', hubPage('Hub launch', shell(hubLaunch))],
  ['overview-live', hubPage('Hub live', shell(hubLive, { stage: 'live', stageLabel: 'Live' }))],
  ['ops-approved', opsPage('Ops approved', opsList)],
  ['ops-launch-steps', opsPage('Ops launch steps', opsLaunch)],
];

const dir = mkdtempSync(join(tmpdir(), 'hub-batch-5-'));
const browser = await chromium.launch();
for (const [name, html] of shots) {
  const file = join(dir, `${name}.html`);
  writeFileSync(file, html);
  for (const width of [360, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: width === 360 ? 800 : 900 } });
    await page.goto(`file://${file.replace(/\\/g, '/')}`);
    await page.screenshot({ path: join(outDir, `${name}-${width}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
rmSync(dir, { recursive: true, force: true });
console.log(`Wrote ${shots.length * 2} screenshots to ${outDir}`);
