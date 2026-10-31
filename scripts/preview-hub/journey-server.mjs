/**
 * Shop Hub Batch 6 journey harness.
 * Flag-ON owner journey for Playwright: form → ack email (dev-log) → hub → uploads →
 * message → ops ready → reviews/changes → subscribe → checklist → live.
 * Also serves static screens for axe / Lighthouse / screenshots.
 *
 *   node scripts/preview-hub/journey-server.mjs
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { screenHtml, AXE_SCREENS } from './hub-screens.mjs';

const PORT = Number(process.env.PREVIEW_HUB_JOURNEY_PORT || 4396);
const HOST = process.env.PREVIEW_HUB_JOURNEY_HOST || '127.0.0.1';

const REJECTED_TOKEN = 'R'.repeat(43);
const EXPIRED_TOKEN = 'E'.repeat(43);
const OTHER_TOKEN = 'B'.repeat(43);
const OTHER_ASSET_ID = 'asset_other';

/** @typedef {{
 *  token: string;
 *  stage: 'requested'|'review'|'launch'|'live';
 *  emails: Array<{subject: string; html: string; provider: string}>;
 *  assets: Array<{id: string; kind: string; name: string; ownerToken: string}>;
 *  messages: Array<{author: string; body: string}>;
 *  reviews: {SERVICES?: string; HOURS?: string};
 *  changes: Array<{id: string; page: string; body: string; status: string}>;
 *  hoursOpen: string;
 *  subscribed: boolean;
 *  approved: boolean;
 * }} JourneyState */

function mintToken() {
  return randomBytes(32).toString('base64url');
}

/** @type {Map<string, JourneyState>} */
const states = new Map();

function createState(token = mintToken()) {
  const state = {
    token,
    stage: 'requested',
    emails: [],
    assets: [],
    messages: [],
    reviews: {},
    changes: [],
    hoursOpen: '09:00',
    subscribed: false,
    approved: false,
  };
  states.set(token, state);
  return state;
}

function json(res, body, status = 200, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
    ...extra,
  });
  res.end(JSON.stringify(body));
}

function html(res, markup, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(markup);
}

function text(res, body, status, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
    ...extra,
  });
  res.end(body);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).origin === `http://${HOST}:${PORT}`;
  } catch {
    return false;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function withToken(htmlSource, token) {
  return htmlSource.replaceAll('/preview/TOKEN', `/preview/${token}`).replaceAll('TOKEN', token);
}

function journeyScript(token) {
  return `<script>
    const token = ${JSON.stringify(token)};
    const origin = location.origin;
    async function post(path, body, extra = {}) {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin, ...extra.headers },
        body: JSON.stringify(body ?? {}),
      });
      return { res, data: await res.json().catch(() => ({})) };
    }
    const logoForm = document.getElementById('logo-form');
    if (logoForm) {
      logoForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const file = document.getElementById('logo-file').files[0];
        if (!file) return;
        const { data } = await post('/api/preview-hub/' + token + '/assets', { kind: 'LOGO', name: file.name });
        document.getElementById('logo-status').textContent = data.ok ? 'Saved' : (data.error || 'Upload failed. Try again.');
      });
    }
    const photosForm = document.getElementById('photos-form');
    if (photosForm) {
      photosForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const files = [...document.getElementById('photos-file').files];
        const grid = document.getElementById('photos-grid');
        let done = 0;
        for (const file of files) {
          const { data } = await post('/api/preview-hub/' + token + '/assets', { kind: 'SHOP_PHOTO', name: file.name });
          if (data.ok) {
            done += 1;
            const thumb = document.createElement('div');
            thumb.className = 'hub-qa-thumb';
            thumb.textContent = file.name;
            grid.appendChild(thumb);
          }
        }
        document.getElementById('photos-status').textContent = done ? 'Saved' : 'Upload failed. Try again.';
      });
    }
    const confirmServices = document.querySelector('[data-testid="confirm-services"]');
    if (confirmServices) {
      confirmServices.addEventListener('click', async () => {
        const { data } = await post('/api/preview-hub/' + token + '/reviews', { section: 'SERVICES', state: 'CONFIRMED' });
        document.getElementById('services-result').textContent = data.ok ? 'Confirmed' : 'Could not save. Try again.';
        const state = document.getElementById('services-state');
        if (state && data.ok) state.textContent = 'Confirmed';
      });
    }
    const correctHours = document.querySelector('[data-testid="correct-hours"]');
    if (correctHours) {
      correctHours.addEventListener('click', async () => {
        const open = document.getElementById('monday-open').value;
        const { data } = await post('/api/preview-hub/' + token + '/reviews', { section: 'HOURS', state: 'CORRECTIONS_SENT', open });
        document.getElementById('hours-result').textContent = data.ok ? 'Corrections sent' : 'Could not save. Try again.';
        const state = document.getElementById('hours-state');
        if (state && data.ok) state.textContent = 'Corrections sent';
      });
    }
    const changeForm = document.getElementById('change-form');
    if (changeForm) {
      changeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const page = document.getElementById('change-page').value;
        const body = document.getElementById('change-body').value;
        const { data } = await post('/api/preview-hub/' + token + '/changes', { page, body });
        if (data.ok) {
          const empty = document.getElementById('changes-empty');
          if (empty) empty.hidden = true;
          const li = document.createElement('li');
          li.textContent = page + ' · ' + body + ' · Draft';
          document.getElementById('change-list').appendChild(li);
          document.getElementById('change-body').value = '';
          document.getElementById('changes-status').textContent = 'Saved';
        }
      });
    }
    const sendChanges = document.querySelector('[data-testid="send-changes"]');
    if (sendChanges) {
      sendChanges.addEventListener('click', async () => {
        const { data } = await post('/api/preview-hub/' + token + '/changes/send', {});
        document.getElementById('changes-status').textContent = data.ok ? 'Changes sent' : (data.error || 'Could not send. Try again.');
      });
    }
    const messageForm = document.getElementById('message-form');
    if (messageForm) {
      messageForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = document.getElementById('message-body').value;
        const { data } = await post('/api/preview-hub/' + token + '/messages', { body });
        if (data.ok) {
          const empty = document.getElementById('messages-empty');
          if (empty) empty.remove();
          const bubble = document.createElement('div');
          bubble.className = 'hub-qa-bubble hub-qa-bubble--you';
          bubble.innerHTML = '<p><strong>You</strong></p><p></p>';
          bubble.querySelectorAll('p')[1].textContent = body;
          document.getElementById('message-thread').appendChild(bubble);
          document.getElementById('message-body').value = '';
          document.getElementById('message-status').textContent = 'Sent';
        } else {
          document.getElementById('message-status').textContent = data.error || 'Could not send. Try again.';
        }
      });
    }
    const checklist = document.getElementById('checklist-form');
    if (checklist) {
      checklist.addEventListener('submit', async (event) => {
        event.preventDefault();
        const ltd = document.querySelector('input[name="ltd"]:checked')?.value;
        const { data } = await post('/api/admin/preview-launch/approve', { ltd });
        document.getElementById('checklist-status').textContent = data.ok
          ? "Thanks — we'll put Sharp Cuts live and email you."
          : (data.error || 'Could not save. Try again.');
      });
    }
    const skipPay = document.querySelector('[data-testid="skip-payments"]');
    if (skipPay) skipPay.addEventListener('click', () => { skipPay.textContent = 'Skipped — you can connect Stripe later in your dashboard.'; });
    const skipMig = document.querySelector('[data-testid="skip-migration"]');
    if (skipMig) skipMig.addEventListener('click', () => { skipMig.textContent = 'Skipped — you can send a client list later.'; });
    const subscribe = document.querySelector('[data-testid="subscribe"]');
    if (subscribe) {
      subscribe.addEventListener('click', async () => {
        const { data } = await post('/api/preview-hub/' + token + '/checkout', {});
        if (data.ok) location.href = '/admin/preview-launch?token=' + token;
      });
    }
  </script>`;
}

function freePreviewHtml() {
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Free website preview</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; background:#030303; color:#fff8ee; margin:0; padding:24px; }
    label { display:block; margin:12px 0 4px; }
    input { width:min(28rem,100%); min-height:44px; }
    .btn { min-height:44px; padding:10px 16px; }
  </style>
</head>
<body>
  <h1>Request a free website preview</h1>
  <p>After you send this, you'll get a private link where you can add photos and your logo.</p>
  <form id="fp">
    <label for="firstName">First name</label>
    <input id="firstName" name="firstName" required>
    <label for="shopName">Shop name</label>
    <input id="shopName" name="shopName" required>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required>
    <label for="townCity">Town or city</label>
    <input id="townCity" name="townCity" required>
    <button class="btn" type="submit">Send my request</button>
  </form>
  <p id="fp-status" role="status" aria-live="polite"></p>
  <script>
    document.getElementById('fp').addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = {
        firstName: document.getElementById('firstName').value,
        shopName: document.getElementById('shopName').value,
        email: document.getElementById('email').value,
        townCity: document.getElementById('townCity').value,
      };
      const res = await fetch('/api/free-preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: location.origin },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      document.getElementById('fp-status').textContent = data.ok ? 'Request sent. Check your email.' : (data.error || 'Could not save.');
    });
  </script>
</body>
</html>`;
}

function emailLogHtml(state) {
  const latest = state.emails[state.emails.length - 1];
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>Dev-log email</title></head>
<body>
  <h1>Dev-log provider</h1>
  <p data-testid="email-provider">dev-log</p>
  <p data-testid="email-subject">${latest?.subject ?? ''}</p>
  <div data-testid="email-html">${latest?.html ?? ''}</div>
</body></html>`;
}

export function handleRequest(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (path.startsWith('/screens/')) {
    const name = path.slice('/screens/'.length);
    if (!AXE_SCREENS.includes(name) && name !== 'detailsReview') {
      return text(res, 'Not found', 404);
    }
    return html(res, screenHtml(name));
  }

  if (path === '/free-preview' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(freePreviewHtml());
    return;
  }

  if (path === '/api/free-preview' && method === 'POST') {
    if (!sameOrigin(req)) return json(res, { ok: false, error: 'Forbidden.' }, 403);
    return readBody(req).then((raw) => {
      const body = JSON.parse(raw.toString('utf8') || '{}');
      const state = createState();
      const hubUrl = `http://${HOST}:${PORT}/preview/${state.token}`;
      state.emails.push({
        provider: 'dev-log',
        subject: `We're designing your ${body.shopName || 'shop'} website`,
        html: `<p>Thanks for requesting a free website preview for ${body.shopName}.</p>
          <p>Your private shop hub is ready now:</p>
          <p><a data-testid="hub-link" href="${hubUrl}">Open your shop hub</a></p>
          <p>There's nothing to pay and no card needed. You only pay if you decide to launch.</p>`,
      });
      json(res, { ok: true, token: state.token, leadToken: 'lead' });
    });
  }

  if (path === '/__qa/emails' && method === 'GET') {
    const token = url.searchParams.get('token');
    const state = token ? states.get(token) : [...states.values()].at(-1);
    if (!state) return json(res, { emails: [] });
    return json(res, { emails: state.emails, token: state.token });
  }

  if (path === '/__qa/state' && method === 'GET') {
    const token = url.searchParams.get('token');
    const state = token ? states.get(token) : null;
    if (!state) return json(res, { ok: false }, 404);
    return json(res, state);
  }

  const previewMatch = path.match(/^\/preview\/([^/]+)(?:\/(website|details|changes|messages))?$/);
  if (previewMatch && method === 'GET') {
    const token = previewMatch[1];
    const tab = previewMatch[2] || 'overview';
    if (token === REJECTED_TOKEN) return text(res, 'Not found', 404);
    if (token === EXPIRED_TOKEN) return html(res, withToken(screenHtml('expired'), token), 410);
    const state = states.get(token);
    if (!state) return text(res, 'Not found', 404);
    const screen =
      tab === 'overview' && state.stage === 'live'
        ? 'live'
        : tab === 'overview' && state.stage !== 'requested'
          ? 'overviewReview'
          : tab === 'overview'
            ? 'overview'
            : tab === 'details' && state.stage !== 'requested'
              ? 'detailsReview'
              : tab;
    let markup = withToken(screenHtml(screen, {
      stage: state.stage === 'requested' ? 'requested' : state.stage,
      stageLabel: state.stage === 'requested' ? 'Requested' : state.stage[0].toUpperCase() + state.stage.slice(1),
      locked: state.stage === 'requested' ? ['website', 'changes'] : [],
    }), token);
    markup = markup.replace('</body>', `${journeyScript(token)}</body>`);
    return html(res, markup);
  }

  if (path.startsWith('/admin/preview-launch') && method === 'GET') {
    const token = url.searchParams.get('token');
    const state = token ? states.get(token) : null;
    if (!state || !state.subscribed) return text(res, 'Not found', 404);
    let markup = withToken(screenHtml('checklist'), token);
    markup = markup.replace('</body>', `${journeyScript(token)}</body>`);
    return html(res, markup);
  }

  const apiMatch = path.match(/^\/api\/preview-hub\/([^/]+)\/(assets|messages|reviews|changes|checkout)(?:\/([^/]+))?$/);
  if (apiMatch && method !== 'GET') {
    if (!sameOrigin(req)) return json(res, { ok: false, error: 'Forbidden.' }, 403);
    const token = apiMatch[1];
    const action = apiMatch[2];
    const extra = apiMatch[3];
    const state = states.get(token);
    if (!state) return json(res, { ok: false, error: 'Not found.' }, 404);
    return readBody(req).then((raw) => {
      const body = raw.length ? JSON.parse(raw.toString('utf8')) : {};
      if (action === 'assets') {
        const id = `asset_${state.assets.length + 1}`;
        state.assets.push({ id, kind: body.kind, name: body.name, ownerToken: token });
        return json(res, { ok: true, id });
      }
      if (action === 'messages') {
        if (!body.body || String(body.body).length > 2000) return json(res, { ok: false, error: 'Write a message before sending.' }, 400);
        state.messages.push({ author: 'OWNER', body: body.body });
        return json(res, { ok: true });
      }
      if (action === 'reviews') {
        state.reviews[body.section] = body.state;
        if (body.open) state.hoursOpen = body.open;
        return json(res, { ok: true });
      }
      if (action === 'changes' && extra === 'send') {
        if (!state.changes.length) return json(res, { ok: false, error: 'Add a draft change before sending.' }, 400);
        for (const change of state.changes) change.status = 'SENT';
        return json(res, { ok: true });
      }
      if (action === 'changes') {
        const id = `chg_${state.changes.length + 1}`;
        state.changes.push({ id, page: body.page, body: body.body, status: 'DRAFT' });
        return json(res, { ok: true, id });
      }
      if (action === 'checkout') {
        state.subscribed = true;
        state.stage = 'launch';
        state.emails.push({
          provider: 'dev-log',
          subject: "Let's put Sharp Cuts live",
          html: '<p>Open your launch checklist</p>',
        });
        return json(res, { ok: true });
      }
      return json(res, { ok: false, error: 'Not found.' }, 404);
    });
  }

  if (path.match(/^\/api\/preview-hub\/([^/]+)\/assets\/([^/]+)$/) && method === 'GET') {
    const [, token, assetId] = path.match(/^\/api\/preview-hub\/([^/]+)\/assets\/([^/]+)$/);
    if (token === REJECTED_TOKEN) return text(res, 'Not found', 404);
    if (assetId === OTHER_ASSET_ID || token === OTHER_TOKEN) return text(res, 'Not found', 404);
    const state = states.get(token);
    const asset = state?.assets.find((row) => row.id === assetId);
    if (!asset || asset.ownerToken !== token) return text(res, 'Not found', 404);
    return text(res, 'ok', 200, { 'Cache-Control': 'private, max-age=300' });
  }

  if (path === '/api/admin/preview-launch/approve' && method === 'POST') {
    if (!sameOrigin(req)) return json(res, { ok: false, error: 'Forbidden.' }, 403);
    return readBody(req).then((raw) => {
      const body = JSON.parse(raw.toString('utf8') || '{}');
      const state = [...states.values()].find((row) => row.subscribed && !row.approved) || [...states.values()].at(-1);
      if (!state) return json(res, { ok: false, error: 'Not found.' }, 404);
      if (body.ltd === 'yes') return json(res, { ok: false, error: 'Limited companies need a registered name, number and office address.' }, 400);
      state.approved = true;
      return json(res, { ok: true });
    });
  }

  if (path.match(/^\/__qa\/ops\/([^/]+)\/(mark-ready|apply|changes-done|mark-live)$/) && method === 'POST') {
    const [, token, action] = path.match(/^\/__qa\/ops\/([^/]+)\/(mark-ready|apply|changes-done|mark-live)$/);
    const state = states.get(token);
    if (!state) return json(res, { ok: false }, 404);
    if (action === 'mark-ready') state.stage = 'review';
    if (action === 'apply') state.reviews.HOURS = 'APPLIED';
    if (action === 'changes-done') {
      for (const change of state.changes) change.status = 'DONE';
      state.stage = 'review';
    }
    if (action === 'mark-live') {
      state.stage = 'live';
      state.emails.push({
        provider: 'dev-log',
        subject: 'Sharp Cuts is live',
        html: '<p>Your website and booking page are open to clients.</p>',
      });
    }
    return json(res, { ok: true, stage: state.stage });
  }

  if (path === '/__qa/tokens' && method === 'GET') {
    return json(res, {
      rejected: REJECTED_TOKEN,
      expired: EXPIRED_TOKEN,
      other: OTHER_TOKEN,
      otherAsset: OTHER_ASSET_ID,
    });
  }

  return text(res, 'Not found', 404);
}

export const JOURNEY_TOKENS = {
  rejected: REJECTED_TOKEN,
  expired: EXPIRED_TOKEN,
  other: OTHER_TOKEN,
  otherAsset: OTHER_ASSET_ID,
};

if (import.meta.url === `file://${process.argv[1].replaceAll('\\', '/')}` || process.argv[1]?.endsWith('journey-server.mjs')) {
  const server = createServer(handleRequest);
  server.listen(PORT, HOST, () => {
    console.log(`preview-hub journey server http://${HOST}:${PORT}`);
  });
}
