/**
 * Shared Shop Hub screen HTML for Batch 6 QA (axe, Lighthouse, screenshots, journey).
 * Uses production hub CSS + British English copy from HUB_SPEC §9.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const HUB_CSS = [
  'src/styles/tokens.css',
  'src/styles/global.css',
  'src/styles/components/buttons.css',
  'src/styles/components/inputs.css',
  'src/styles/components/ks-glass-card.css',
  'src/styles/components/preview-hub.css',
]
  .map((rel) => readFileSync(join(root, rel), 'utf8'))
  .join('\n');

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'website', label: 'Website' },
  { id: 'details', label: 'Your shop' },
  { id: 'changes', label: 'Changes' },
  { id: 'messages', label: 'Messages' },
];

export function wrapHubPage(title, body, { current = 'overview', stage = 'requested', stageLabel = 'Requested', locked = [] } = {}) {
  const nav = TABS.map((tab) => {
    const isLocked = locked.includes(tab.id);
    const currentAttr = tab.id === current ? ' aria-current="page"' : '';
    const lockedClass = isLocked ? ' is-locked' : '';
    const titleAttr = isLocked ? ' title="Available when your preview is ready"' : '';
    return `<a class="hub-nav__item${lockedClass}"${currentAttr}${titleAttr} href="/preview/TOKEN/${tab.id === 'overview' ? '' : tab.id}">${tab.label}</a>`;
  }).join('');
  const tabs = TABS.map((tab) => {
    const isLocked = locked.includes(tab.id);
    const currentAttr = tab.id === current ? ' aria-current="page"' : '';
    const lockedClass = isLocked ? ' is-locked' : '';
    const titleAttr = isLocked ? ' title="Available when your preview is ready"' : '';
    return `<a class="hub-tabs__item${lockedClass}"${currentAttr}${titleAttr} href="/preview/TOKEN/${tab.id === 'overview' ? '' : tab.id}">${tab.label}</a>`;
  }).join('');
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${title}</title>
  <style>
    ${HUB_CSS}
    body.admin-theme-premium-black { --bg:#030303; --fg:#fff8ee; background:#030303; color:#fff8ee; margin:0; font-family: Inter, system-ui, sans-serif; }
    .btn { min-height: 44px; }
    .hub-qa-note { font-size: 0.875rem; color: #c8c2b8; }
    .hub-qa-list { margin: 0; padding-left: 1.2rem; }
    .hub-qa-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
    .hub-qa-thumb { aspect-ratio: 4/3; border-radius: 8px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); display: grid; place-items: center; font-size: 0.75rem; }
    .hub-qa-thread { display: flex; flex-direction: column; gap: 12px; }
    .hub-qa-bubble { padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); max-width: 36rem; }
    .hub-qa-bubble--you { align-self: flex-end; background: #141414; }
    .hub-qa-composer { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
    .hub-qa-ops { margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
    .hub-launch-item { border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 0 0 12px; }
    .hub-launch-item h3 { margin: 0 0 8px; font-size: 1rem; }
    label { display: block; margin: 10px 0 4px; }
    input, textarea, select { width: 100%; max-width: 28rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .visually-hidden { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
  </style>
</head>
<body class="admin-theme-premium-black hub-page-body">
  <div class="hub-shell">
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
        <a class="btn btn--secondary btn--sm" href="/preview/TOKEN/messages">Message us</a>
      </div>
    </aside>
    <div class="hub-content">
      <header class="hub-topbar">
        <p class="hub-topbar__shop">Sharp Cuts</p>
        <p class="hub-stage-pill hub-stage-pill--${stage}">${stageLabel}</p>
        <a class="hub-topbar__msg" href="/preview/TOKEN/messages" aria-label="Messages"></a>
      </header>
      <p class="hub-private hub-private--mobile">Private · hidden from search engines</p>
      <div class="hub-main" id="hub-main">
        <div class="hub-main__inner">${body}</div>
      </div>
    </div>
    <nav class="hub-tabs" aria-label="Hub pages">${tabs}</nav>
  </div>
</body>
</html>`;
}

function stepper(current) {
  const labels = ['Requested', 'Designing', 'Review', 'Launch', 'Live'];
  return `<ol class="hub-stepper" aria-label="Preview progress">${labels
    .map((label, i) => {
      const cls = i < current ? 'is-complete' : i === current ? 'is-current' : 'is-upcoming';
      return `<li class="hub-stepper__item ${cls}"><span class="hub-stepper__bar"></span><span class="hub-stepper__label">${label}</span></li>`;
    })
    .join('')}</ol>`;
}

export const SCREEN_BODIES = {
  overview: `
    <article class="hub-overview">
      <header class="hub-header">
        <div>
          <h1>We've got your request</h1>
          <p class="hub-header__sub">We'll start designing Sharp Cuts's website soon. Add anything that helps — it's all optional.</p>
        </div>
        <div class="hub-header__actions">
          <a class="btn btn--primary" href="/preview/TOKEN/details">Add photos or a logo</a>
        </div>
      </header>
      ${stepper(0)}
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
      <section class="hub-card ks-glass-card" aria-labelledby="hub-check-title">
        <h2 id="hub-check-title" class="hub-card__title">Your shop</h2>
        <p class="hub-qa-note">0 of 7</p>
        <ul class="hub-qa-list">
          <li>Logo</li>
          <li>Shop photos</li>
          <li>Services &amp; prices — We'll fill these from your links — you'll confirm them on your preview</li>
          <li>Team — We'll fill these from your links — you'll confirm them on your preview</li>
          <li>Opening hours — We'll fill these from your links — you'll confirm them on your preview</li>
          <li>About your shop <span>Optional</span></li>
          <li>Price list photo <span>Optional</span></li>
        </ul>
      </section>
      <section class="hub-card ks-glass-card" aria-labelledby="hub-activity-title">
        <h2 id="hub-activity-title" class="hub-card__title">Activity</h2>
        <ol class="hub-activity"><li><span>Request received</span><time datetime="2026-10-31T12:00:00.000Z">just now</time></li></ol>
      </section>
      <section class="hub-card ks-glass-card" aria-labelledby="hub-help-title">
        <h2 id="hub-help-title" class="hub-card__title">Need a hand?</h2>
        <p>Questions about your preview? Message us here or by email.</p>
        <div class="hub-help__row">
          <a class="btn btn--secondary btn--sm" href="/preview/TOKEN/messages">Message KERSIVO</a>
          <a class="btn btn--ghost btn--sm" href="mailto:hello@kersivo.co.uk">hello@kersivo.co.uk</a>
        </div>
      </section>
    </article>`,

  overviewReview: `
    <article class="hub-overview">
      <header class="hub-header">
        <div>
          <h1>Your preview is ready</h1>
          <p class="hub-header__sub">Have a look, check your details and tell us what to change.</p>
        </div>
        <div class="hub-header__actions">
          <button class="btn btn--primary" type="button" data-testid="subscribe">Launch this website — £39/month</button>
        </div>
      </header>
      ${stepper(2)}
      <section class="hub-card ks-glass-card" aria-labelledby="hub-now-title">
        <h2 id="hub-now-title" class="hub-card__title">Now</h2>
        <div class="hub-now">
          <div><h3>What we're doing</h3><p>Your preview is ready for you to review.</p></div>
          <div><h3>What we need from you</h3><p>Have a look, check your details and tell us what to change.</p></div>
        </div>
      </section>
    </article>`,

  details: `
    <article>
      <header class="hub-header"><div><h1>Your shop</h1><p class="hub-header__sub">Add anything that helps — it's all optional.</p></div></header>
      <section class="hub-card ks-glass-card" aria-labelledby="brand-title">
        <h2 id="brand-title" class="hub-card__title">Brand</h2>
        <p>Phone photos are perfect. JPG, PNG, WEBP or PDF.</p>
        <p>Your files are private. If you don't launch, we delete them with your preview.</p>
        <form id="logo-form">
          <label for="logo-file">Logo</label>
          <input id="logo-file" name="logo" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml,application/pdf" data-testid="logo-input">
          <button class="btn btn--secondary" type="submit">Upload logo</button>
        </form>
        <p id="logo-status" role="status" aria-live="polite"></p>
        <label for="style-notes">Anything about your style?</label>
        <textarea id="style-notes" maxlength="500" rows="3"></textarea>
        <p class="hub-qa-note">Optional. Up to 500 characters.</p>
      </section>
      <section class="hub-card ks-glass-card" aria-labelledby="photos-title">
        <h2 id="photos-title" class="hub-card__title">Shop photos</h2>
        <p>Phone photos are perfect. Landscape works best for the top of your website.</p>
        <form id="photos-form">
          <label for="photos-file">Shop photos</label>
          <input id="photos-file" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple data-testid="photos-input">
          <button class="btn btn--secondary" type="submit">Upload photos</button>
        </form>
        <p id="photos-status" role="status" aria-live="polite"></p>
        <div class="hub-qa-grid" id="photos-grid" aria-live="polite"></div>
      </section>
      <section class="hub-card ks-glass-card" aria-labelledby="services-title">
        <h2 id="services-title" class="hub-card__title">Services &amp; prices</h2>
        <p>We'll fill these from your links — you'll confirm them on your preview</p>
      </section>
    </article>`,

  detailsReview: `
    <article>
      <header class="hub-header"><div><h1>Your shop</h1><p class="hub-header__sub">Have a look, check your details and tell us what to change.</p></div></header>
      <section class="hub-card ks-glass-card" aria-labelledby="services-title">
        <h2 id="services-title" class="hub-card__title">Services &amp; prices</h2>
        <p class="hub-qa-note" id="services-state">Not checked</p>
        <table>
          <caption class="visually-hidden">Draft services</caption>
          <thead><tr><th scope="col">Name</th><th scope="col">Duration (minutes)</th><th scope="col">Price</th></tr></thead>
          <tbody>
            <tr><td>Skin fade</td><td>45</td><td>£28</td></tr>
            <tr><td>Beard trim</td><td>20</td><td>£12</td></tr>
          </tbody>
        </table>
        <p>Corrections to your details don't use your round of design changes.</p>
        <button class="btn btn--primary" type="button" data-testid="confirm-services">Looks right</button>
        <p id="services-result" role="status" aria-live="polite"></p>
      </section>
      <section class="hub-card ks-glass-card" aria-labelledby="hours-title">
        <h2 id="hours-title" class="hub-card__title">Opening hours</h2>
        <p class="hub-qa-note" id="hours-state">Not checked</p>
        <label for="monday-open">Monday open</label>
        <input id="monday-open" type="time" value="09:00" data-testid="monday-open">
        <label for="monday-close">Monday close</label>
        <input id="monday-close" type="time" value="17:00" data-testid="monday-close">
        <p>Corrections to your details don't use your round of design changes.</p>
        <button class="btn btn--secondary" type="button" data-testid="correct-hours">Send corrections</button>
        <p id="hours-result" role="status" aria-live="polite"></p>
      </section>
    </article>`,

  website: `
    <article>
      <header class="hub-header"><div><h1>Your preview is ready</h1><p class="hub-header__sub">Have a look, check your details and tell us what to change.</p></div></header>
      <div class="hub-toolbar" role="toolbar" aria-label="Preview controls">
        <div role="group" aria-label="View">
          <button type="button" class="btn btn--secondary" aria-pressed="true">Website</button>
          <button type="button" class="btn btn--ghost">Booking</button>
        </div>
        <div role="group" aria-label="Device">
          <button type="button" class="btn btn--ghost">Phone</button>
          <button type="button" class="btn btn--secondary" aria-pressed="true">Desktop</button>
        </div>
        <a class="btn btn--ghost btn--sm" href="https://example.invalid/preview" rel="noopener noreferrer" target="_blank">Open in new tab</a>
        <button type="button" class="btn btn--primary" data-testid="suggest-change">Suggest a change</button>
      </div>
      <p>Test bookings only — no payments are taken.</p>
      <iframe title="Website preview for Sharp Cuts" src="about:blank" width="800" height="400" style="width:100%;max-width:800px;height:400px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:#111"></iframe>
    </article>`,

  changes: `
    <article>
      <header class="hub-header">
        <div>
          <h1>Changes</h1>
          <p class="hub-header__sub">Round 1 of 1 included</p>
        </div>
      </header>
      <p id="changes-empty">No changes yet. Suggest something from your website preview or add one here.</p>
      <form id="change-form">
        <label for="change-page">Page</label>
        <select id="change-page" name="page" data-testid="change-page">
          <option value="HOME">Home</option>
          <option value="SERVICES">Services</option>
          <option value="BARBERS">Barbers</option>
          <option value="GALLERY">Gallery</option>
          <option value="CONTACT">Contact</option>
          <option value="BOOKING">Booking</option>
          <option value="OTHER">Other</option>
        </select>
        <label for="change-body">What would you like us to change?</label>
        <textarea id="change-body" name="body" maxlength="2000" rows="4" required data-testid="change-body"></textarea>
        <button class="btn btn--secondary" type="submit" data-testid="save-draft">Save draft</button>
      </form>
      <ul id="change-list" class="hub-qa-list"></ul>
      <button class="btn btn--primary" type="button" data-testid="send-changes">Send changes to KERSIVO</button>
      <p id="changes-status" role="status" aria-live="polite"></p>
    </article>`,

  messages: `
    <article>
      <header class="hub-header"><div><h1>Messages</h1></div></header>
      <div class="hub-qa-thread" id="message-thread">
        <p id="messages-empty">Got a question or something we should know? Send us a message — we reply by email and here.</p>
      </div>
      <form class="hub-qa-composer" id="message-form">
        <label for="message-body">Write a message</label>
        <textarea id="message-body" name="body" maxlength="2000" rows="4" required data-testid="message-body"></textarea>
        <p class="hub-qa-note">Ctrl or Cmd + Enter to send. Enter starts a new line.</p>
        <button class="btn btn--primary" type="submit" data-testid="send-message">Send</button>
      </form>
      <p id="message-status" role="status" aria-live="polite"></p>
    </article>`,

  checklist: `
    <article>
      <header class="hub-header">
        <div>
          <h1>Launch checklist</h1>
          <p class="hub-header__sub">1 of 5 done</p>
        </div>
      </header>
      <div class="hub-progress" role="progressbar" aria-valuemin="0" aria-valuemax="5" aria-valuenow="1" aria-label="Launch checklist progress"></div>
      <form id="checklist-form">
        <section class="hub-launch-item" aria-labelledby="biz-title">
          <h2 id="biz-title">Business details</h2>
          <label for="site-name">Name shown on your website</label>
          <input id="site-name" name="siteName" value="Sharp Cuts" required>
          <label for="public-phone">Public phone</label>
          <input id="public-phone" name="publicPhone" type="tel" value="0113 000 0000">
          <label for="public-email">Public email</label>
          <input id="public-email" name="publicEmail" type="email" value="hello@sharpcuts.test" required>
          <label for="address">Shop address</label>
          <input id="address" name="address" value="12 Cut Street" required>
          <label for="town">Town or city</label>
          <input id="town" name="town" value="Leeds" required>
          <label for="postcode">Postcode</label>
          <input id="postcode" name="postcode" value="LS1 1AA" required>
          <label for="contact-name">Your name (private)</label>
          <input id="contact-name" name="contactName" value="Sam" required>
          <label for="contact-email">Your email (private)</label>
          <input id="contact-email" name="contactEmail" type="email" value="sam@sharpcuts.test" required>
          <fieldset>
            <legend>Is your shop a limited company?</legend>
            <p>Limited companies must show their registered name, number and office address on their website. We'll add them to your footer.</p>
            <label><input type="radio" name="ltd" value="no" checked data-testid="ltd-no"> No</label>
            <label><input type="radio" name="ltd" value="yes" data-testid="ltd-yes"> Yes</label>
          </fieldset>
        </section>
        <section class="hub-launch-item" aria-labelledby="domain-title">
          <h2 id="domain-title">Domain</h2>
          <p>We're registering sharpcuts.test.</p>
        </section>
        <section class="hub-launch-item" aria-labelledby="pay-title">
          <h2 id="pay-title">Payments (optional)</h2>
          <p>Clients pay at the shop by default. Connect Stripe if you'd like deposits or online payment — you can also do this later in your dashboard.</p>
          <button class="btn btn--secondary" type="button" data-testid="skip-payments">Skip for now</button>
        </section>
        <section class="hub-launch-item" aria-labelledby="mig-title">
          <h2 id="mig-title">Moving your clients (optional)</h2>
          <button class="btn btn--secondary" type="button" data-testid="skip-migration">Not now</button>
        </section>
        <section class="hub-launch-item" aria-labelledby="approve-title">
          <h2 id="approve-title">Approve your website</h2>
          <p>Check your website and booking page, then approve when you are happy.</p>
          <label><input type="checkbox" name="rights" required data-testid="rights"> I have the right to use the photos, logo and text on my website.</label>
          <label><input type="checkbox" name="accuracy" required data-testid="accuracy"> The details on my preview and on this page are correct.</label>
          <button class="btn btn--primary" type="submit" data-testid="approve-launch">Approve for launch</button>
        </section>
      </form>
      <p id="checklist-status" role="status" aria-live="polite"></p>
    </article>`,

  live: `
    <article class="hub-overview">
      <header class="hub-header">
        <div>
          <h1>Sharp Cuts is live</h1>
          <p class="hub-header__sub">Your website and booking page are open to clients.</p>
        </div>
        <div class="hub-header__actions">
          <a class="btn btn--primary" href="/admin">Go to your dashboard</a>
        </div>
      </header>
      ${stepper(4)}
      <section class="hub-card ks-glass-card" aria-labelledby="live-title">
        <h2 id="live-title" class="hub-card__title">Next in your dashboard</h2>
        <ul class="hub-qa-list">
          <li><a href="/insights/google-business-profile-booking-link-barbershop">Add your booking link to Google</a></li>
          <li><a href="/admin?section=barbershop_settings#qr-kit">Order your QR Kit</a></li>
          <li><a href="/admin?section=barbershop_settings">Set deposits (optional)</a></li>
          <li><a href="/admin/retail-onboarding">Start selling products</a></li>
          <li><a href="/admin?section=team">Add your team's working hours</a></li>
        </ul>
      </section>
    </article>`,

  expired: `
    <article>
      <header class="hub-header">
        <div>
          <h1>This preview has expired</h1>
          <p class="hub-header__sub">Ask us to reopen it and we'll get back to you.</p>
        </div>
        <div class="hub-header__actions">
          <a class="btn btn--primary" href="/preview/TOKEN/messages">Ask us to reopen it</a>
        </div>
      </header>
    </article>`,
};

const LOCKED_BEFORE_REVIEW = ['website', 'changes'];

export function screenHtml(name, extras = {}) {
  const defaults = {
    overview: { current: 'overview', stage: 'requested', stageLabel: 'Requested', locked: LOCKED_BEFORE_REVIEW },
    overviewReview: { current: 'overview', stage: 'review', stageLabel: 'Review', locked: [] },
    details: { current: 'details', stage: 'requested', stageLabel: 'Requested', locked: LOCKED_BEFORE_REVIEW },
    detailsReview: { current: 'details', stage: 'review', stageLabel: 'Review', locked: [] },
    website: { current: 'website', stage: 'review', stageLabel: 'Review', locked: [] },
    changes: { current: 'changes', stage: 'review', stageLabel: 'Review', locked: [] },
    messages: { current: 'messages', stage: 'requested', stageLabel: 'Requested', locked: LOCKED_BEFORE_REVIEW },
    checklist: { current: 'overview', stage: 'launch', stageLabel: 'Launch', locked: [] },
    live: { current: 'overview', stage: 'live', stageLabel: 'Live', locked: [] },
    expired: { current: 'overview', stage: 'expired', stageLabel: 'Expired', locked: [] },
  };
  const titles = {
    overview: "We've got your request",
    overviewReview: 'Your preview is ready',
    details: 'Your shop',
    detailsReview: 'Your shop',
    website: 'Your preview is ready',
    changes: 'Changes',
    messages: 'Messages',
    checklist: 'Launch checklist',
    live: 'Sharp Cuts is live',
    expired: 'This preview has expired',
  };
  const body = SCREEN_BODIES[name];
  if (!body) throw new Error(`Unknown hub screen: ${name}`);
  return wrapHubPage(titles[name], body, { ...defaults[name], ...extras });
}

export const AXE_SCREENS = [
  'overview',
  'details',
  'detailsReview',
  'website',
  'changes',
  'messages',
  'checklist',
  'live',
  'expired',
];

export const LIGHTHOUSE_SCREENS = ['overview', 'details', 'website', 'messages'];
export const CAPTURE_SCREENS = ['overview', 'details', 'website', 'messages', 'changes', 'checklist', 'live'];
