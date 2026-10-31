/**
 * Shop Hub Batch 4 screenshots (360px and 1280px).
 *
 *   node scripts/preview-hub/capture-batch-4.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/preview-hub/screens/batch-4');
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

function shell(inner, { currentTab = 0, stage = 'review', stageLabel = 'Review', openChanges = 0 } = {}) {
  const nav = TABS.map((label, i) => {
    const current = i === currentTab ? ' aria-current="page"' : '';
    const count = label === 'Changes' && openChanges ? `<span class="hub-count">${openChanges}</span>` : '';
    return `<a class="hub-nav__item"${current} href="#">${label}${count}</a>`;
  }).join('');
  const tabs = TABS.map((label, i) => {
    const current = i === currentTab ? ' aria-current="page"' : '';
    const count = label === 'Changes' && openChanges ? `<span class="hub-count">${openChanges}</span>` : '';
    return `<a class="hub-tabs__item"${current} href="#">${label}${count}</a>`;
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

const overviewReview = `<article class="hub-overview">
  <header class="hub-header">
    <div>
      <h1>Your preview is ready</h1>
      <p class="hub-header__sub">Have a look, check your details and tell us what to change.</p>
    </div>
    <div class="hub-header__actions"><a class="btn btn--primary" href="#">Open your preview</a></div>
  </header>
  <section class="hub-card ks-glass-card ks-glass-card--accent">
    <h2 class="hub-card__title">Now</h2>
    <div class="hub-now">
      <div><h3>What we're doing</h3><p>Your preview is ready for you to review.</p></div>
      <div><h3>What we need from you</h3><p>Check your services and hours, then subscribe when you're happy.</p></div>
    </div>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Check your details</h2>
    <ul class="hub-review-strip">
      <li><a class="hub-review-strip__card is-not_checked" href="#"><span>Services &amp; prices</span><span class="hub-review-chip">Not checked</span></a></li>
      <li><a class="hub-review-strip__card is-confirmed" href="#"><span>Team</span><span class="hub-review-chip">Confirmed</span></a></li>
      <li><a class="hub-review-strip__card is-corrections_sent" href="#"><span>Opening hours</span><span class="hub-review-chip">Corrections sent</span></a></li>
    </ul>
  </section>
</article>`;

const detailsReview = `<div class="hub-review-stack">
  <section class="hub-card ks-glass-card hub-review-card is-not_checked">
    <header class="hub-review-card__head"><h2 class="hub-card__title">Services &amp; prices</h2><span class="hub-review-chip">Not checked</span></header>
    <div class="hub-review-row"><span>Skin fade</span><span>45 min</span><span>£25.00</span></div>
    <p class="hub-card__body">Corrections to your details don't use your round of design changes.</p>
    <div class="hub-review-card__actions">
      <button class="btn btn--secondary btn--sm">Looks right ✓</button>
      <button class="btn btn--primary btn--sm">Send corrections</button>
    </div>
  </section>
  <section class="hub-card ks-glass-card hub-review-card is-updated">
    <header class="hub-review-card__head"><h2 class="hub-card__title">Opening hours</h2><span class="hub-review-chip">Updated on your preview</span></header>
    <p class="hub-card__body">Sunday is closed. Monday–Saturday 09:00–18:00.</p>
  </section>
</div>`;

const websitePhone = `<div class="hub-website">
  <div class="hub-website-toolbar">
    <div class="hub-seg"><a class="hub-seg__btn" aria-current="page">Website</a><a class="hub-seg__btn">Booking</a></div>
    <div class="hub-seg"><button class="hub-seg__btn" aria-pressed="true">Phone</button><button class="hub-seg__btn">Desktop</button></div>
    <p class="hub-website-toolbar__note">Test bookings only — no payments are taken.</p>
    <div class="hub-website-toolbar__actions">
      <a class="btn btn--ghost btn--sm" href="#">Open in new tab</a>
      <a class="btn btn--secondary btn--sm" href="#">Request changes</a>
      <button class="btn btn--secondary btn--sm">Suggest a change</button>
    </div>
  </div>
  <div class="hub-device hub-device--phone">
    <div class="hub-device__stage" style="transform:scale(0.85)"><div style="padding:24px;color:#fff8ee">Sharp Cuts preview</div></div>
  </div>
</div>`;

const websiteDesktop = `<div class="hub-website">
  <div class="hub-website-toolbar">
    <div class="hub-seg"><a class="hub-seg__btn">Website</a><a class="hub-seg__btn" aria-current="page">Booking</a></div>
    <div class="hub-seg"><button class="hub-seg__btn">Phone</button><button class="hub-seg__btn" aria-pressed="true">Desktop</button></div>
    <p class="hub-website-toolbar__note">Test bookings only — no payments are taken.</p>
  </div>
  <div class="hub-device hub-device--desktop">
    <div class="hub-device__stage hub-device__stage--booking"><p class="hub-card__body" style="padding:24px">Skin fade · 45 min · £22.00</p></div>
  </div>
</div>`;

const changesDrafts = `<article class="hub-changes">
  <header class="hub-review-card__head"><p class="hub-card__body">Round 1 of 1 included</p><button class="btn btn--secondary btn--sm">Suggest a change</button></header>
  <ul class="hub-change-list">
    <li class="hub-change-item is-draft"><div><p class="hub-change-item__page">Home</p><p>Make the logo larger</p></div><span class="hub-review-chip">Draft</span></li>
    <li class="hub-change-item is-draft"><div><p class="hub-change-item__page">Services</p><p>Show the beard trim first</p></div><span class="hub-review-chip">Draft</span></li>
    <li class="hub-change-item is-draft"><div><p class="hub-change-item__page">Contact</p><p>Use the Leeds address</p></div><span class="hub-review-chip">Draft</span></li>
  </ul>
  <div class="hub-changes__send"><button class="btn btn--primary">Send changes to KERSIVO</button></div>
</article>`;

const changesBlocked = `<article class="hub-changes">
  <header class="hub-review-card__head"><p class="hub-card__body">Round 1 of 1 included</p></header>
  <ul class="hub-change-list">
    <li class="hub-change-item is-sent"><div><p class="hub-change-item__page">Home</p><p>Make the logo larger</p></div><span class="hub-review-chip">Sent</span></li>
  </ul>
  <div class="hub-changes__send">
    <button class="btn btn--primary" disabled>Send changes to KERSIVO</button>
    <p class="hub-card__body">You've used your included round of changes. Message us if something isn't right.</p>
  </div>
</article>`;

const changesEmpty = `<article class="hub-changes">
  <header class="hub-review-card__head"><p class="hub-card__body">Round 1 of 1 included</p><button class="btn btn--secondary btn--sm">Suggest a change</button></header>
  <p class="hub-card__body">No changes yet. Suggest something from your website preview or add one here.</p>
  <div class="hub-changes__send"><button class="btn btn--primary" disabled>Send changes to KERSIVO</button></div>
</article>`;

const opsContent = `<section class="ops-hub-content">
  <p class="ops-pr__empty">Applying booking data updates the booking page immediately. The website at the site preview URL is a separate build — update that too.</p>
  <article class="ops-hub-section">
    <header class="hub-review-card__head"><h3>Services &amp; prices</h3><span class="hub-review-chip">CORRECTIONS_SENT</span></header>
    <ul class="ops-hub-diff"><li><strong>Skin fade</strong><span>£25.00</span><span>→</span><span>£22.00</span></li></ul>
    <div class="hub-review-card__actions">
      <button class="btn btn--primary btn--sm">Apply</button>
      <button class="btn btn--secondary btn--sm">Dismiss with note</button>
    </div>
  </article>
</section>`;

const opsChanges = `<section class="ops-hub-changes">
  <p>1 of 1 included rounds used</p>
  <button class="btn btn--secondary btn--sm">Grant extra round</button>
  <ul class="hub-change-list">
    <li class="hub-change-item is-sent">
      <div><p class="hub-change-item__page">Home</p><p>Make the logo larger</p></div>
      <span class="hub-review-chip">SENT</span>
      <div class="hub-change-item__actions">
        <button class="btn btn--ghost btn--sm">In progress</button>
        <button class="btn btn--ghost btn--sm">Done</button>
        <button class="btn btn--ghost btn--sm">Not possible</button>
      </div>
    </li>
  </ul>
</section>`;

const shots = [
  ['overview-review-strip', hubPage('Overview', shell(overviewReview, { currentTab: 0 }))],
  ['details-review', hubPage('Details', shell(detailsReview, { currentTab: 2 }))],
  ['website-phone', hubPage('Website', shell(websitePhone, { currentTab: 1 }))],
  ['website-desktop', hubPage('Website booking', shell(websiteDesktop, { currentTab: 1 }))],
  ['changes-empty', hubPage('Changes', shell(changesEmpty, { currentTab: 3 }))],
  ['changes-drafts', hubPage('Changes drafts', shell(changesDrafts, { currentTab: 3, openChanges: 3 }))],
  ['changes-blocked', hubPage('Changes blocked', shell(changesBlocked, { currentTab: 3, openChanges: 1 }))],
  ['ops-content', opsPage('Ops content', opsContent)],
  ['ops-changes', opsPage('Ops changes', opsChanges)],
];

const dir = mkdtempSync(join(tmpdir(), 'hub-batch-4-'));
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
