/**
 * Shop Hub Batch 2 screenshots (360px and 1280px).
 * Fixture markup + real CSS so we don't need a seeded database.
 *
 *   node scripts/preview-hub/capture-batch-2.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/preview-hub/screens/batch-2');
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
const STEPS = ['Requested', 'Designing', 'Review', 'Launch', 'Live'];
const LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="#111"/><text x="20" y="52" fill="#D72638" font-size="36" font-family="Inter,sans-serif">SC</text></svg>`,
  );
const PHOTO = (colour) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${colour}"/></svg>`)}`;

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

function shell(inner, currentTab = 2) {
  const nav = TABS.map((label, i) => {
    const current = i === currentTab ? ' aria-current="page"' : '';
    const locked = label === 'Website' || label === 'Changes';
    return `<a class="hub-nav__item${locked ? ' is-locked' : ''}"${current} href="#">${label}</a>`;
  }).join('');
  const tabs = TABS.map((label, i) => {
    const current = i === currentTab ? ' aria-current="page"' : '';
    return `<a class="hub-tabs__item"${current} href="#">${label}</a>`;
  }).join('');
  return `<div class="hub-shell">
    <a class="hub-shell__skip" href="#hub-main">Skip to content</a>
    <aside class="hub-sidebar" aria-label="Shop hub">
      <div class="hub-brand">
        <p class="hub-brand__mark">KERSIVO</p>
        <p class="hub-brand__shop">Sharp Cuts</p>
        <p class="hub-stage-pill hub-stage-pill--requested">Requested</p>
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
        <p class="hub-stage-pill">Requested</p>
      </header>
      <p class="hub-private hub-private--mobile">Private · hidden from search engines</p>
      <div class="hub-main" id="hub-main"><div class="hub-main__inner">${inner}</div></div>
    </div>
    <nav class="hub-tabs" aria-label="Hub pages">${tabs}</nav>
  </div>`;
}

function dropzone(hint, extra = '') {
  return `<div class="hub-uploader">
    <div class="hub-uploader__drop">
      <p class="hub-uploader__title">Drop files here, or tap to choose</p>
      <p class="hub-uploader__hint">${hint}</p>
      <div class="hub-uploader__actions">
        <span class="btn btn--secondary btn--sm">Choose files</span>
        ${extra}
      </div>
    </div>
  </div>`;
}

function placeholderCard(title) {
  return `<section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">${title}</h2>
    <p class="hub-card__body">We'll fill these from your links — you'll confirm them on your preview</p>
  </section>`;
}

const detailsEmpty = `<article class="hub-details">
  <header class="hub-header">
    <div>
      <h1>Your shop</h1>
      <p class="hub-header__sub">Your files are private. If you don't launch, we delete them with your preview.</p>
    </div>
  </header>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Brand</h2>
    <div class="hub-swatches">
      <figure class="hub-swatch hub-swatch--dark"><p>No logo yet.</p><figcaption>On dark</figcaption></figure>
      <figure class="hub-swatch hub-swatch--light"><p>No logo yet.</p><figcaption>On light</figcaption></figure>
    </div>
    ${dropzone('Phone photos are perfect. JPG, PNG, WEBP or PDF.')}
    <div class="hub-colours">
      <div class="field"><label class="field__label">Primary colour</label><div class="hub-hex"><span class="hub-hex__swatch" style="background:#333"></span><input class="input" value="" /></div></div>
      <div class="field"><label class="field__label">Secondary colour</label><div class="hub-hex"><span class="hub-hex__swatch" style="background:#333"></span><input class="input" value="" /></div></div>
    </div>
    <div class="field"><label class="field__label">Anything about your style?</label><p class="field__hint">Optional. Up to 500 characters.</p><textarea class="textarea"></textarea></div>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Shop photos</h2>
    <p class="hub-card__body">Phone photos are perfect. Landscape works best for the top of your website.</p>
    ${dropzone('Phone photos are perfect. Landscape works best for the top of your website.', '<span class="btn btn--ghost btn--sm">Take a photo</span>')}
    <p class="hub-card__body">No shop photos yet.</p>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Team photos</h2>
    ${dropzone('Phone photos are perfect. JPG, PNG, WEBP or PDF.', '<span class="btn btn--ghost btn--sm">Take a photo</span>')}
    <p class="hub-card__body">No team photos yet.</p>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Price list</h2>
    <p class="hub-card__body">Snap your price list. We'll copy your services and prices from it.</p>
    ${dropzone("We'll copy your services and prices from it.")}
    <p class="hub-card__body">No price list yet.</p>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">About your shop</h2>
    <p class="field__hint">Two or three sentences is enough. Optional.</p>
    <textarea class="textarea"></textarea>
  </section>
  ${placeholderCard('Services &amp; prices')}
  ${placeholderCard('Team')}
  ${placeholderCard('Opening hours')}
</article>`;

const detailsFilled = `<article class="hub-details">
  <header class="hub-header">
    <div>
      <h1>Your shop</h1>
      <p class="hub-header__sub">Your files are private. If you don't launch, we delete them with your preview.</p>
    </div>
    <p class="hub-savehint">Saved</p>
  </header>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Brand</h2>
    <div class="hub-swatches">
      <figure class="hub-swatch hub-swatch--dark"><img src="${LOGO}" alt=""><figcaption>On dark</figcaption></figure>
      <figure class="hub-swatch hub-swatch--light"><img src="${LOGO}" alt=""><figcaption>On light</figcaption></figure>
    </div>
    ${dropzone('Phone photos are perfect. JPG, PNG, WEBP or PDF.')}
    <div class="hub-chips">
      <button type="button" class="hub-chip is-selected" style="background:#D72638" aria-label="Use #D72638"></button>
      <button type="button" class="hub-chip" style="background:#1B4D8C" aria-label="Use #1B4D8C"></button>
      <button type="button" class="hub-chip" style="background:#D4A017" aria-label="Use #D4A017"></button>
    </div>
    <p><button type="button" class="btn btn--ghost btn--sm">Pick from my logo</button></p>
    <div class="hub-colours">
      <div class="field"><label class="field__label">Primary colour</label><div class="hub-hex"><span class="hub-hex__swatch" style="background:#D72638"></span><input class="input" value="#D72638" /></div></div>
      <div class="field"><label class="field__label">Secondary colour</label><div class="hub-hex"><span class="hub-hex__swatch" style="background:#1B4D8C"></span><input class="input" value="#1B4D8C" /></div></div>
    </div>
    <div class="field"><label class="field__label">Anything about your style?</label><textarea class="textarea">Dark shop, gold lettering, no neon.</textarea></div>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Shop photos</h2>
    ${dropzone('Phone photos are perfect. Landscape works best for the top of your website.', '<span class="btn btn--ghost btn--sm">Take a photo</span>')}
    <ul class="hub-photo-grid">
      ${['#3a2a22', '#5a4638', '#2c3338']
        .map(
          (colour, i) => `<li class="hub-photo">
        <div class="hub-photo__media"><img src="${PHOTO(colour)}" alt=""></div>
        <label class="field__label" for="cap-${i}">Caption</label>
        <input class="input" id="cap-${i}" value="${i === 0 ? 'Front chairs' : ''}" placeholder="Optional caption" />
        <div class="hub-photo__tools">
          <button type="button" class="btn btn--ghost btn--sm hub-photo__move">Move up</button>
          <button type="button" class="btn btn--ghost btn--sm hub-photo__move">Move down</button>
          <button type="button" class="btn btn--ghost btn--sm">Delete</button>
        </div>
      </li>`,
        )
        .join('')}
    </ul>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Team photos</h2>
    ${dropzone('Phone photos are perfect. JPG, PNG, WEBP or PDF.', '<span class="btn btn--ghost btn--sm">Take a photo</span>')}
    <ul class="hub-photo-grid">
      <li class="hub-photo"><div class="hub-photo__media"><img src="${PHOTO('#4a3b2f')}" alt=""></div><p class="hub-photo__file">alex.jpg</p></li>
    </ul>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Price list</h2>
    ${dropzone("We'll copy your services and prices from it.")}
    <ul class="hub-photo-grid">
      <li class="hub-photo"><p class="hub-photo__file">menu.pdf</p></li>
    </ul>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">About your shop</h2>
    <textarea class="textarea">Family shop on the high street. Fades, beard work and a proper wet shave.</textarea>
  </section>
  ${placeholderCard('Services &amp; prices')}
  ${placeholderCard('Team')}
  ${placeholderCard('Opening hours')}
</article>`;

const detailsUploading = `<article class="hub-details">
  <header class="hub-header"><div><h1>Your shop</h1><p class="hub-header__sub">Your files are private. If you don't launch, we delete them with your preview.</p></div></header>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Shop photos</h2>
    <div class="hub-uploader">
      <div class="hub-uploader__drop is-over">
        <p class="hub-uploader__title">Drop files here, or tap to choose</p>
        <p class="hub-uploader__hint">Phone photos are perfect. Landscape works best for the top of your website.</p>
        <div class="hub-uploader__actions"><span class="btn btn--secondary btn--sm">Choose files</span></div>
      </div>
      <ul class="hub-uploader__list">
        <li class="hub-uploader__row"><span>chair-1.jpg</span><span>Uploading 2 of 10 files</span></li>
        <li><div class="hub-uploader__bar"><span style="width:42%"></span></div></li>
        <li class="hub-uploader__row"><span>virus.jpg</span><span class="hub-uploader__error">We could not use that file. Try a JPG, PNG, WEBP or PDF.</span></li>
        <li class="hub-uploader__row"><span>too-big.jpg</span><button type="button" class="btn btn--ghost btn--sm">Try again</button></li>
      </ul>
    </div>
    <p class="hub-error">Could not save. Try again. <button type="button" class="btn btn--ghost btn--sm">Try again</button></p>
  </section>
  <div class="hub-toast" role="status">Photo deleted. <button type="button" class="btn btn--ghost btn--sm">Undo</button></div>
</article>`;

const overview = `<article class="hub-overview">
  <header class="hub-header">
    <div>
      <h1>We've got your request</h1>
      <p class="hub-header__sub">We'll start designing Sharp Cuts's website soon. Add anything that helps — it's all optional.</p>
    </div>
    <div class="hub-header__actions"><a class="btn btn--primary" href="#">Add photos or a logo</a></div>
  </header>
  <ol class="hub-stepper">${STEPS.map((label, i) => `<li class="hub-stepper__item ${i === 0 ? 'is-current' : 'is-upcoming'}"><span class="hub-stepper__bar"></span><span class="hub-stepper__label">${label}</span></li>`).join('')}</ol>
  <section class="hub-card ks-glass-card ks-glass-card--accent">
    <h2 class="hub-card__title">Now</h2>
    <div class="hub-now">
      <div><h3>What we're doing</h3><p>We've got your request and we'll start designing soon.</p></div>
      <div><h3>What we need from you</h3><p>Add anything that helps — logo, photos or a photo of your price list. It is all optional.</p></div>
    </div>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Your preview</h2>
    <div class="hub-preview-lock"><p class="ks-eyebrow">Sharp Cuts</p><p>Your preview will appear here</p></div>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Your shop <span class="hub-checklist__progress">2 of 7</span></h2>
    <ul class="hub-checklist">
      <li class="hub-checklist__item is-done"><span class="hub-checklist__mark"></span><span>Logo</span></li>
      <li class="hub-checklist__item is-done"><span class="hub-checklist__mark"></span><span>Shop photos</span></li>
      <li class="hub-checklist__item is-on_preview"><span class="hub-checklist__mark"></span><span>Services &amp; prices<span class="hub-checklist__hint">On your preview</span></span></li>
      <li class="hub-checklist__item is-on_preview"><span class="hub-checklist__mark"></span><span>Team<span class="hub-checklist__hint">On your preview</span></span></li>
      <li class="hub-checklist__item is-on_preview"><span class="hub-checklist__mark"></span><span>Opening hours<span class="hub-checklist__hint">On your preview</span></span></li>
      <li class="hub-checklist__item is-optional"><span class="hub-checklist__mark"></span><span>About your shop<span class="hub-checklist__hint">Optional</span></span></li>
      <li class="hub-checklist__item is-optional"><span class="hub-checklist__mark"></span><span>Price list photo<span class="hub-checklist__hint">Optional</span></span></li>
    </ul>
  </section>
  <section class="hub-card ks-glass-card">
    <h2 class="hub-card__title">Activity</h2>
    <ol class="hub-activity">
      <li><span>You added 6 photos</span><time>2 hours ago</time></li>
      <li><span>You added a logo</span><time>2 hours ago</time></li>
      <li><span>Request received</span><time>2 days ago</time></li>
    </ol>
  </section>
</article>`;

const opsList = `<div class="ops-cr ops-pr">
  <header class="ops-cr__header"><div class="ops-cr__brand"><p class="ops-cr__brand-kicker">KERSIVO Ops</p><h1 class="ops-cr__title">Free preview requests</h1></div></header>
  <div class="ops-cards">
    <article class="ops-card">
      <div class="ops-card__top">
        <div>
          <h2 class="ops-card__name"><a class="ops-table__name" href="#">Sharp Cuts</a></h2>
          <p class="ops-card__meta">Leeds · 2h</p>
        </div>
        <div>
          <span class="ops-pr__status ops-pr__status--requested">Requested</span>
          <span class="ops-pr__status ops-pr__status--new-files">New files</span>
        </div>
      </div>
    </article>
    <article class="ops-card">
      <div class="ops-card__top">
        <div>
          <h2 class="ops-card__name"><a class="ops-table__name" href="#">North Street Barbers</a></h2>
          <p class="ops-card__meta">York · 1d</p>
        </div>
        <div><span class="ops-pr__status ops-pr__status--in_progress">In progress</span></div>
      </div>
    </article>
  </div>
  <div class="ops-table-wrap">
    <table class="ops-table">
      <thead><tr><th>Shop</th><th>Status</th><th>Age</th></tr></thead>
      <tbody>
        <tr>
          <td><a class="ops-table__name" href="#">Sharp Cuts</a><div class="ops-table__muted">Leeds</div></td>
          <td><span class="ops-pr__status ops-pr__status--requested">Requested</span><span class="ops-pr__status ops-pr__status--new-files">New files</span></td>
          <td>2h</td>
        </tr>
        <tr>
          <td><a class="ops-table__name" href="#">North Street Barbers</a><div class="ops-table__muted">York</div></td>
          <td><span class="ops-pr__status ops-pr__status--in_progress">In progress</span></td>
          <td>1d</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>`;

function opsFiles(empty) {
  return `<div class="ops-cr ops-pr">
    <h1 class="ops-cr__title">Sharp Cuts</h1>
    <section class="ops-pr-files" aria-label="Files">
      <h2 class="ops-pr-actions__title">Files</h2>
      <dl class="ops-pr-detail__list">
        <div class="ops-pr-detail__item"><dt>Brand colours</dt><dd>${empty ? '—' : '#D72638 / #1B4D8C'}</dd></div>
        <div class="ops-pr-detail__item"><dt>Style notes</dt><dd>${empty ? '—' : 'Dark shop, gold lettering.'}</dd></div>
        <div class="ops-pr-detail__item"><dt>About</dt><dd>${empty ? '—' : 'Family shop on the high street.'}</dd></div>
      </dl>
      ${
        empty
          ? `<p class="ops-pr__empty">No files yet.</p>`
          : `<ul class="ops-pr-files__grid">
        <li class="ops-pr-files__item">
          <div class="ops-pr-files__thumb"><img src="${LOGO}" alt=""></div>
          <p class="ops-pr-files__name">logo.svg</p>
          <p class="ops-pr-files__meta">LOGO · 12 KB · 31 Oct 2026 · Owner</p>
          <a class="btn btn--ghost btn--sm" href="#">Download original</a>
        </li>
        <li class="ops-pr-files__item">
          <div class="ops-pr-files__thumb"><img src="${PHOTO('#3a2a22')}" alt=""></div>
          <p class="ops-pr-files__name">chair.jpg</p>
          <p class="ops-pr-files__meta">SHOP_PHOTO · 240 KB · 31 Oct 2026 · Owner</p>
          <a class="btn btn--ghost btn--sm" href="#">Download original</a>
        </li>
        <li class="ops-pr-files__item">
          <div class="ops-pr-files__thumb"><span>PRICE_LIST</span></div>
          <p class="ops-pr-files__name">menu.pdf</p>
          <p class="ops-pr-files__meta">PRICE_LIST · 88 KB · 31 Oct 2026 · Owner</p>
          <a class="btn btn--ghost btn--sm" href="#">Download original</a>
        </li>
      </ul>`
      }
    </section>
  </div>`;
}

const privacy = `<main class="legal-page"><article class="container legal-page__inner">
  <h1 class="legal-page__title">Privacy Policy</h1>
  <p class="legal-page__updated">Last updated: 31 October 2026</p>
  <h2>What we collect</h2>
  <ul>
    <li>
      <strong>Free website preview requests</strong> — your name (if given), email address, shop name, town or
      city, the links you send us, details about your shop, your notes and any changes you ask for, plus the details,
      text and images we take from those links to build your preview, and whether and when you opened it.
      Files you add in your private shop hub (logo, photos, price lists) are used only to build your preview and website, and are deleted with your preview if you don't launch.
      <strong>Purpose:</strong> creating your private preview.
    </li>
  </ul>
</article></main>`;

const files = [
  { id: 'details-empty', html: hubPage('Your shop', shell(detailsEmpty, 2)) },
  { id: 'details-filled', html: hubPage('Your shop', shell(detailsFilled, 2)) },
  { id: 'details-uploading', html: hubPage('Your shop', shell(detailsUploading, 2)) },
  { id: 'overview-checklist', html: hubPage('Overview', shell(overview, 0)) },
  { id: 'ops-list-new-files', html: opsPage('Ops list', opsList) },
  { id: 'ops-files-empty', html: opsPage('Ops files', opsFiles(true)) },
  { id: 'ops-files-grid', html: opsPage('Ops files', opsFiles(false)) },
  { id: 'privacy-hub-files', html: legalPage('Privacy', privacy) },
];

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '1280', width: 1280, height: 900 },
];

const tmp = mkdtempSync(join(tmpdir(), 'kersivo-hub-batch-2-'));
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
