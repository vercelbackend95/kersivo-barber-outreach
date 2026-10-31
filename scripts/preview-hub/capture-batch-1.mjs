/**
 * Shop Hub Batch 1 screenshots (360px and 1280px) for each owner-facing stage.
 * Uses the real hub CSS with fixture markup so we don't need a seeded database.
 *
 *   node scripts/preview-hub/capture-batch-1.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

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

const STAGES = [
  {
    id: 'requested',
    pill: 'Requested',
    h1: "We've got your request",
    sub: "We'll start designing Sharp Cuts's website soon. Add anything that helps — it's all optional.",
    doing: "We've got your request and we'll start designing soon.",
    need: 'Add anything that helps — logo, photos or a photo of your price list. It is all optional.',
    cta: 'Add photos or a logo',
    previewLocked: true,
    current: 0,
  },
  {
    id: 'designing',
    pill: 'Designing',
    h1: "We're designing your website",
    sub: "Your preview is being built individually for Sharp Cuts. We'll email you when it's ready.",
    doing: "We're designing your website from the links you sent.",
    need: "Nothing — we'll email you",
    cta: 'Add photos or a logo',
    previewLocked: true,
    current: 1,
  },
  {
    id: 'review',
    pill: 'Review',
    h1: 'Your preview is ready',
    sub: 'Have a look, check your details and tell us what to change.',
    doing: 'Your preview is ready for you to review.',
    need: 'Have a look, check your details and tell us what to change.',
    cta: 'Open your preview',
    subscribe: true,
    previewLocked: false,
    current: 2,
  },
  {
    id: 'review-changes-sent',
    pill: 'Review',
    h1: "We're updating your preview",
    sub: "We've got your changes and we'll email you when they're done.",
    doing: "We've got your changes and we're updating your preview.",
    need: "Nothing — we'll email you",
    cta: 'Open your preview',
    previewLocked: false,
    current: 2,
  },
  {
    id: 'launch',
    pill: 'Launch',
    h1: "Let's put Sharp Cuts live",
    sub: 'A few details from you, then we connect your domain and publish.',
    doing: "We'll connect your domain and publish when the launch checklist is done.",
    need: 'A few details from you in your dashboard.',
    cta: 'Finish in your dashboard',
    previewLocked: false,
    current: 3,
  },
  {
    id: 'live',
    pill: 'Live',
    h1: 'Sharp Cuts is live',
    sub: 'Your website and booking page are open to clients.',
    doing: 'Your website and booking page are open to clients.',
    need: "Nothing — we'll email you",
    cta: 'Go to your dashboard',
    previewLocked: false,
    current: 4,
  },
  {
    id: 'declined',
    pill: 'Closed',
    h1: "You've closed this preview",
    sub: 'Changed your mind? Send us a message.',
    doing: 'This preview is closed.',
    need: 'Changed your mind? Send us a message.',
    cta: 'Send us a message',
    previewLocked: true,
    current: -1,
  },
  {
    id: 'expired',
    pill: 'Expired',
    h1: 'This preview has expired',
    sub: "Ask us to reopen it and we'll get back to you.",
    doing: 'This preview has expired.',
    need: 'Ask us to reopen it and we will get back to you.',
    cta: 'Ask us to reopen it',
    ctaDisabled: true,
    previewLocked: true,
    current: -1,
  },
];

const TABS = ['Overview', 'Website', 'Your shop', 'Changes', 'Messages'];
const STEPS = ['Requested', 'Designing', 'Review', 'Launch', 'Live'];

function shell(stage, inner, currentTab = 0) {
  const nav = TABS.map((label, i) => {
    const current = i === currentTab ? ' aria-current="page"' : '';
    const locked = (label === 'Website' || label === 'Changes') && stage.previewLocked && stage.current < 2;
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
        <p class="hub-stage-pill hub-stage-pill--${stage.id.split('-')[0]}">${stage.pill}</p>
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
        <p class="hub-stage-pill">${stage.pill}</p>
      </header>
      <p class="hub-private hub-private--mobile">Private · hidden from search engines</p>
      <div class="hub-main" id="hub-main"><div class="hub-main__inner">${inner}</div></div>
    </div>
    <nav class="hub-tabs" aria-label="Hub pages">${tabs}</nav>
  </div>`;
}

function overview(stage) {
  const stepper = STEPS.map((label, i) => {
    let status = 'upcoming';
    if (stage.current < 0) status = i === 0 ? 'complete' : 'upcoming';
    else if (i < stage.current) status = 'complete';
    else if (i === stage.current) status = 'current';
    return `<li class="hub-stepper__item is-${status}"><span class="hub-stepper__bar"></span><span class="hub-stepper__label">${label}</span></li>`;
  }).join('');
  const preview = stage.previewLocked
    ? `<div class="hub-preview-lock"><p class="ks-eyebrow">Sharp Cuts</p><p>Your preview will appear here</p></div>`
    : `<p class="hub-card__body">Sharp Cuts</p><div class="hub-preview-actions"><a class="btn btn--primary btn--sm" href="#">Open website</a><a class="btn btn--secondary btn--sm" href="#">Try booking</a></div>`;
  const cta = stage.ctaDisabled
    ? `<button type="button" class="btn btn--primary" disabled>${stage.cta}</button><p class="hub-expired-note">Available soon</p>`
    : `<a class="btn btn--primary" href="#">${stage.cta}</a>`;
  const subscribe = stage.subscribe
    ? `<button type="button" class="btn btn--primary btn--sm">Launch this website — £39/month</button>`
    : '';
  return `<article class="hub-overview">
    <header class="hub-header">
      <div>
        <h1>${stage.h1}</h1>
        <p class="hub-header__sub">${stage.sub}</p>
      </div>
      <div class="hub-header__actions">${cta}${subscribe}</div>
    </header>
    <ol class="hub-stepper">${stepper}</ol>
    <section class="hub-card ks-glass-card ks-glass-card--accent">
      <h2 class="hub-card__title">Now</h2>
      <div class="hub-now">
        <div><h3>What we're doing</h3><p>${stage.doing}</p></div>
        <div><h3>What we need from you</h3><p>${stage.need}</p></div>
      </div>
    </section>
    <section class="hub-card ks-glass-card">
      <h2 class="hub-card__title">Your preview</h2>
      ${preview}
    </section>
    <section class="hub-card ks-glass-card">
      <h2 class="hub-card__title">Activity</h2>
      <ol class="hub-activity"><li><span>Request received</span><time>2 days ago</time></li></ol>
    </section>
    <section class="hub-card ks-glass-card">
      <h2 class="hub-card__title">Need a hand?</h2>
      <p class="hub-card__body">Questions about your preview? Message us here or by email.</p>
      <div class="hub-help__row">
        <a class="btn btn--secondary btn--sm" href="#">Message KERSIVO</a>
        <a class="btn btn--ghost btn--sm" href="#">hello@kersivo.co.uk</a>
      </div>
    </section>
  </article>`;
}

function comingSoon(title) {
  return `<section class="hub-card ks-glass-card ks-glass-card--accent hub-placeholder">
    <p class="ks-eyebrow">Coming soon</p>
    <h1>${title}</h1>
    <p class="hub-card__body">You'll be able to use this page from here soon. For now, everything else in your shop hub still works.</p>
  </section>`;
}

function page(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title}</title>
<style>${css}
body.admin-theme-premium-black { --bg:#030303; --fg:#fff8ee; background:#030303; color:#fff8ee; margin:0; font-family: Inter, system-ui, sans-serif; }
.btn { min-height: 44px; }
</style></head>
<body class="admin-theme-premium-black hub-page-body">${body}</body></html>`;
}

const extras = [
  { id: 'details-coming-soon', html: page('Your shop', shell(STAGES[0], comingSoon('Your shop'), 2)) },
  { id: 'changes-coming-soon', html: page('Changes', shell(STAGES[2], comingSoon('Changes'), 3)) },
  { id: 'messages-coming-soon', html: page('Messages', shell(STAGES[0], comingSoon('Messages'), 4)) },
  { id: 'website-locked', html: page('Website locked', shell(STAGES[0], `<section class="hub-card ks-glass-card ks-glass-card--accent hub-placeholder"><h1>Available when your preview is ready</h1><p class="hub-card__body">We'll email you when it's ready.</p></section>`, 1)) },
];

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '1280', width: 1280, height: 900 },
];

const tmp = mkdtempSync(join(tmpdir(), 'kersivo-hub-batch-1-'));

const files = [
  ...STAGES.map((stage) => ({ id: `overview-${stage.id}`, html: page(stage.h1, shell(stage, overview(stage))) })),
  ...extras,
];

for (const file of files) writeFileSync(join(tmp, `${file.id}.html`), file.html);

const browser = await chromium.launch();
for (const file of files) {
  for (const vp of VIEWPORTS) {
    const pageHandle = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await pageHandle.goto(`file://${join(tmp, `${file.id}.html`).replaceAll('\\', '/')}`, { waitUntil: 'load' });
    const dest = join(outDir, `${file.id}-${vp.name}.png`);
    await pageHandle.screenshot({ path: dest, fullPage: vp.width >= 1024 });
    await pageHandle.close();
    console.log(dest);
  }
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote ${files.length * VIEWPORTS.length} screenshots to ${outDir}`);
