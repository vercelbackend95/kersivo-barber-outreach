/**
 * Shop Hub Batch 3 screenshots (360px and 1280px).
 * Fixture markup + real CSS so we don't need a seeded database.
 *
 *   node scripts/preview-hub/capture-batch-3.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/preview-hub/screens/batch-3');
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
  'src/styles/components/table.css',
  'src/styles/components/ops-recommendations.css',
  'src/styles/components/ops-preview-requests.css',
  'src/styles/components/preview-hub.css',
]
  .map((rel) => readFileSync(join(root, rel), 'utf8'))
  .join('\n');

const legalCss = [
  'src/styles/tokens.css',
  'src/styles/global.css',
  'src/styles/legal-pages.css',
]
  .map((rel) => readFileSync(join(root, rel), 'utf8'))
  .join('\n');

const TABS = ['Overview', 'Website', 'Your shop', 'Changes', 'Messages'];
const PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#3a2a22"/></svg>`);

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

function legalPage(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>${legalCss}
body { margin:0; font-family: Inter, system-ui, sans-serif; }
</style></head>
<body>${body}</body></html>`;
}

function shell(inner, { currentTab = 4, unread = false, stage = 'requested', stageLabel = 'Requested' } = {}) {
  const nav = TABS.map((label, i) => {
    const current = i === currentTab ? ' aria-current="page"' : '';
    const unreadDot = label === 'Messages' && unread ? '<span class="hub-unread" aria-label="Unread messages"></span>' : '';
    return `<a class="hub-nav__item"${current} href="#">${label}${unreadDot}</a>`;
  }).join('');
  const tabs = TABS.map((label, i) => {
    const current = i === currentTab ? ' aria-current="page"' : '';
    const unreadDot =
      label === 'Messages' && unread
        ? '<span class="hub-tabs__icon"><span class="hub-unread" aria-hidden="true"></span></span>'
        : '';
    return `<a class="hub-tabs__item"${current} href="#">${unreadDot}${label}</a>`;
  }).join('');
  return `<div class="hub-shell">
    <a class="hub-shell__skip" href="#hub-main">Skip to content</a>
    <aside class="hub-sidebar" aria-label="Shop hub">
      <div class="hub-brand">
        <p class="hub-brand__mark">KERSIVO</p>
        <p class="hub-brand__shop">Sharp Cuts</p>
        <p class="hub-stage-pill hub-stage-pill--${stage}">${stageLabel}</p>
        <p class="hub-private">Private · hidden from search engines</p>
      </div>
      <nav class="hub-nav" aria-label="Hub sections">${nav}</nav>
      <div class="hub-sidebar__footer">
        <p>Questions? Message us</p>
        <a class="btn btn--secondary btn--sm" href="#">Message us</a>
      </div>
    </aside>
    <div class="hub-content">
      <header class="hub-topbar">
        <p class="hub-topbar__shop">Sharp Cuts</p>
        <p class="hub-stage-pill hub-stage-pill--${stage}">${stageLabel}</p>
        <a class="hub-topbar__msg" href="#" aria-label="${unread ? 'Unread messages' : 'Messages'}">
          <span>✉</span>
          ${unread ? '<span class="hub-unread" aria-hidden="true"></span>' : ''}
        </a>
      </header>
      <p class="hub-private hub-private--mobile">Private · hidden from search engines</p>
      <div class="hub-main" id="hub-main"><div class="hub-main__inner">${inner}</div></div>
    </div>
    <nav class="hub-tabs" aria-label="Hub pages">${tabs}</nav>
  </div>`;
}

const composer = (draft = '') => `<form class="hub-composer">
  <textarea class="hub-composer__input" rows="3" maxlength="2000" placeholder="Write a message">${draft}</textarea>
  <div class="hub-composer__row">
    <div class="hub-uploader hub-uploader--compact">
      <div class="hub-uploader__compact-actions">
        <span class="btn btn--ghost btn--sm">Attach a file</span>
        <span class="btn btn--ghost btn--sm">Take a photo</span>
      </div>
    </div>
    <p class="hub-composer__count">${draft.length} / 2000</p>
    <button type="button" class="btn btn--primary"${draft ? '' : ' disabled'}>Send</button>
  </div>
  <p class="hub-composer__hint">Ctrl or Cmd + Enter to send. Enter starts a new line.</p>
</form>`;

const messagesEmpty = `<section class="hub-messages">
  <h1 class="hub-messages__title">Sharp Cuts</h1>
  <div class="hub-messages__thread">
    <p class="hub-messages__empty">Got a question or something we should know? Send us a message — we reply by email and here.</p>
  </div>
  ${composer()}
</section>`;

const messagesThread = `<section class="hub-messages">
  <h1 class="hub-messages__title">Sharp Cuts</h1>
  <div class="hub-messages__thread">
    <div class="hub-messages__day">
      <p class="hub-messages__day-label">31 October 2026</p>
      <article class="hub-msg is-mine">
        <header class="hub-msg__meta"><span>You</span><time>12:04</time></header>
        <p class="hub-msg__body">Here are two photos of the shop.</p>
        <ul class="hub-msg__files">
          <li><a class="hub-msg__thumb" href="#"><img src="${PHOTO}" alt="shop-1.jpg"></a></li>
          <li><a class="hub-msg__thumb" href="#"><img src="${PHOTO}" alt="shop-2.jpg"></a></li>
        </ul>
        <p class="hub-msg__seen">Seen</p>
      </article>
      <article class="hub-msg">
        <header class="hub-msg__meta"><span>KERSIVO</span><time>12:11</time></header>
        <p class="hub-msg__body">Thanks — we've got these and we'll use them on your preview.</p>
      </article>
    </div>
  </div>
  ${composer()}
</section>`;

const messagesReopen = `<section class="hub-messages">
  <h1 class="hub-messages__title">Sharp Cuts</h1>
  <div class="hub-messages__thread">
    <p class="hub-messages__empty">Got a question or something we should know? Send us a message — we reply by email and here.</p>
  </div>
  ${composer('Please reopen this preview.')}
</section>`;

const overviewExpired = `<article class="hub-overview">
  <header class="hub-header">
    <div>
      <h1>This preview has expired</h1>
      <p class="hub-header__sub">Ask us to reopen it and we'll get back to you.</p>
    </div>
    <div class="hub-header__actions">
      <a class="btn btn--primary" href="#">Ask us to reopen it</a>
    </div>
  </header>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Need a hand?</h2>
    <p class="hub-card__body">Questions about your preview? Message us here or by email.</p>
    <div class="hub-help__row">
      <a class="btn btn--secondary btn--sm" href="#">Message KERSIVO</a>
      <a class="btn btn--ghost btn--sm" href="#">hello@kersivo.co.uk</a>
    </div>
  </section>
</article>`;

const overviewActivity = `<article class="hub-overview">
  <header class="hub-header"><div><h1>We've got your request</h1><p class="hub-header__sub">We'll start designing Sharp Cuts's website soon.</p></div></header>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Activity</h2>
    <ol class="hub-activity">
      <li><span>You sent a message</span><time>2 minutes ago</time></li>
      <li><span>KERSIVO replied</span><time>just now</time></li>
    </ol>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Need a hand?</h2>
    <a class="btn btn--secondary btn--sm" href="#">Message KERSIVO</a>
  </section>
</article>`;

const opsList = `<div class="ops-cr ops-pr">
  <header class="ops-cr__header"><div class="ops-cr__brand"><p class="ops-cr__brand-kicker">KERSIVO Ops</p><h1 class="ops-cr__title">Free preview requests</h1></div></header>
  <div class="ops-cards">
    <article class="ops-card">
      <div class="ops-card__top">
        <div><h2 class="ops-card__name">Sharp Cuts</h2><p class="ops-card__meta">Leeds · 2h</p></div>
        <div>
          <span class="ops-pr__status ops-pr__status--requested">Requested</span>
          <span class="ops-pr__status ops-pr__status--unread">2 unread</span>
        </div>
      </div>
    </article>
    <article class="ops-card">
      <div class="ops-card__top">
        <div><h2 class="ops-card__name">Fade Room</h2><p class="ops-card__meta">York · 1d</p></div>
        <div><span class="ops-pr__status ops-pr__status--ready">Ready</span></div>
      </div>
    </article>
  </div>
  <div class="ops-table-wrap">
    <table class="ops-table">
      <thead><tr><th>Shop</th><th>Status</th></tr></thead>
      <tbody>
        <tr>
          <td>Sharp Cuts<div class="ops-table__muted">Leeds</div></td>
          <td><span class="ops-pr__status ops-pr__status--requested">Requested</span><span class="ops-pr__status ops-pr__status--unread">2 unread</span></td>
        </tr>
        <tr>
          <td>Fade Room<div class="ops-table__muted">York</div></td>
          <td><span class="ops-pr__status ops-pr__status--ready">Ready</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>`;

const opsMessages = (empty) => `<div class="ops-cr ops-pr">
  <header class="ops-cr__header"><div class="ops-cr__brand"><p class="ops-cr__brand-kicker">← Free preview requests</p><h1 class="ops-cr__title">Sharp Cuts</h1></div></header>
  <nav class="ops-pr-tabs" aria-label="Request workspace">
    <a href="#">Overview</a>
    <a href="#">Files</a>
    <a href="#" aria-current="page">Messages</a>
  </nav>
  ${
    empty
      ? `<section class="hub-messages"><h1 class="hub-messages__title">Sharp Cuts</h1><div class="hub-messages__thread"><p class="hub-messages__empty">Got a question or something we should know? Send us a message — we reply by email and here.</p></div>${composer()}</section>`
      : messagesThread
  }
</div>`;

const privacy = `<main class="legal-page"><article class="container legal-page__inner">
  <h1 class="legal-page__title">Privacy Policy</h1>
  <p class="legal-page__updated">Last updated: 31 October 2026</p>
  <h2>What we collect</h2>
  <ul>
    <li>
      <strong>Free website preview requests</strong> —
      Files you add in your private shop hub (logo, photos, price lists) are used only to build your preview and website, and are deleted with your preview if you don't launch.
      Messages you send in your private shop hub are used only to talk about your preview, and are deleted with your preview if you don't launch.
    </li>
  </ul>
</article></main>`;

const files = [
  { id: 'messages-empty', html: hubPage('Messages', shell(messagesEmpty)) },
  { id: 'messages-thread', html: hubPage('Messages', shell(messagesThread, { unread: false, stage: 'review', stageLabel: 'Review' })) },
  { id: 'messages-reopen', html: hubPage('Messages', shell(messagesReopen, { stage: 'expired', stageLabel: 'Expired' })) },
  { id: 'messages-unread-shell', html: hubPage('Overview', shell(overviewActivity, { currentTab: 0, unread: true })) },
  { id: 'overview-expired-cta', html: hubPage('Overview', shell(overviewExpired, { currentTab: 0, stage: 'expired', stageLabel: 'Expired' })) },
  { id: 'ops-list-unread', html: opsPage('Ops list', opsList) },
  { id: 'ops-messages-empty', html: opsPage('Ops messages', opsMessages(true)) },
  { id: 'ops-messages-thread', html: opsPage('Ops messages', opsMessages(false)) },
  { id: 'privacy-hub-messages', html: legalPage('Privacy', privacy) },
];

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '1280', width: 1280, height: 900 },
];

const tmp = mkdtempSync(join(tmpdir(), 'kersivo-hub-batch-3-'));
for (const file of files) writeFileSync(join(tmp, `${file.id}.html`), file.html);

const browser = await chromium.launch();
for (const file of files) {
  for (const vp of VIEWPORTS) {
    const pageHandle = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await pageHandle.goto(`file://${join(tmp, `${file.id}.html`).replaceAll('\\', '/')}`, { waitUntil: 'load' });
    const dest = join(outDir, `${file.id}-${vp.name}.png`);
    await pageHandle.screenshot({ path: dest, fullPage: true });
    await pageHandle.close();
    console.log(dest);
  }
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote ${files.length * VIEWPORTS.length} screenshots to ${outDir}`);
