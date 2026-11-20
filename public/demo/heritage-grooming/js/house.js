// The shop's own facts, shared by every page: opening hours, whether the door is open right now (on London time,
// wherever the visitor is), and the fascia sign in the footer.
// ASSUMED: the hours below are stand-ins until the shop sends its own. booking.js reads them too.

export const HOURS = { 0: null, 1: null, 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 17] };   // weekday (0 = Sunday) → [open, close]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TZ = 'Europe/London';

const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

// the shop's clock: weekday and hour (with minutes as a fraction) in London
function londonNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, hour: +get('hour') + +get('minute') / 60 };
}

// "Open now until 19:00", "Opens today at 9:00", "Closed now · open Tuesday from 9:00"
export function openStatus(now) {
  const { day, hour } = londonNow(now);
  const today = HOURS[day];
  if (today && hour >= today[0] && hour < today[1]) return { open: true, text: `Open now until ${hm(today[1])}` };
  if (today && hour < today[0]) return { open: false, text: `Opens today at ${hm(today[0])}` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7, h = HOURS[d];
    if (h) return { open: false, text: `Closed now · open ${i === 1 ? 'tomorrow' : DAYS[d]} from ${hm(h[0])}` };
  }
  return { open: false, text: 'Closed now' };
}

// every [data-open-status] on the page says it; is-open lights the lamp beside it. Refreshed each minute.
export function mountStatus(root = document) {
  const els = [...root.querySelectorAll('[data-open-status]')];
  if (!els.length) return;
  const paint = () => {
    const s = openStatus();
    els.forEach((el) => { el.textContent = s.text; el.classList.toggle('is-open', s.open); el.classList.toggle('is-closed', !s.open); });
  };
  paint();
  setInterval(paint, 60000);
}

// the fascia: the name set to run exactly from one edge of the sign to the other, at any width
export function fitSign(sign) {
  const word = sign?.querySelector('.footer__word');
  if (!word) return;
  const fit = () => {
    const target = sign.clientWidth;
    if (!target) return;
    word.style.fontSize = '100px';
    const r = document.createRange(); r.selectNodeContents(word);
    const w = r.getBoundingClientRect().width;
    if (w) word.style.fontSize = `${(100 * target / w).toFixed(2)}px`;
  };
  fit();
  document.fonts?.ready.then(fit);
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(sign);
}

// the footer's one moment: the sign's mouldings draw out from the middle, the name rises letter by letter inside them,
// the strap line settles last; the seal turns into place with the scroll
export function footerMotion({ gsap, ScrollTrigger, SplitText }) {
  const sign = document.querySelector('.footer__sign');
  if (!sign || !gsap || !ScrollTrigger || !SplitText) return;
  const word = sign.querySelector('.footer__word');
  // no per-letter masks (they would shave the overhang off the last g): the word's own bottom edge hides the letters
  const split = SplitText.create(word, { type: 'chars' });
  word.classList.add('is-split');
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  tl.from(sign.querySelectorAll('.footer__rule'), { scaleX: 0, duration: 1.4, ease: 'power3.inOut' })
    .from(split.chars, { yPercent: 130, duration: 1.3, stagger: { each: .03, from: 'center' } }, .35)
    .from(sign.querySelectorAll('.footer__strap > *'), { opacity: 0, y: 10, duration: .9, stagger: .08 }, .9);
  ScrollTrigger.create({ trigger: sign, start: 'top 92%', once: true, onEnter: () => tl.play() });
  gsap.fromTo('.footer__seal', { rotate: -70 }, { rotate: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: .6 } });
}

// wait for the two faces the headings are set in (not just "whatever has loaded so far"), so no heading is
// measured in the fallback face and then re-set when the real one arrives
export function fontsReady(ms = 3000) {
  const f = document.fonts;
  if (!f) return Promise.resolve();
  const want = Promise.all([
    f.load('400 1em "Libre Caslon Display"'), f.load('400 1em "Libre Caslon Text"'), f.load('400 1em "Hanken Grotesk"'),
  ]).then(() => f.ready).catch(() => {});
  return Promise.race([want, new Promise((r) => setTimeout(r, ms))]);
}

// split a heading into lines WITHOUT moving a single word: the browser's balanced line breaks are read first and
// pinned with <br>s, so the split lines (and the text after revert) break exactly where the reader first saw them.
// Returns the SplitText instance; its revert() also takes the pins out again.
export function splitLines(SplitText, target, opts) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const pins = pinBreaks(el);
  const split = SplitText.create(el, { ...opts, linesClass: 'split-line' });
  const revert = split.revert.bind(split);
  split.revert = () => { revert(); unpin(el); return split; };
  return split;
}

function pinBreaks(el) {
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const cuts = [];
  let top = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const m of node.data.matchAll(/\S+/g)) {
      range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
      const r = range.getClientRects()[0];
      if (!r) continue;
      if (top !== null && r.top > top + r.height * .5) cuts.push([node, m.index]);
      top = r.top;
    }
  }
  for (let i = cuts.length - 1; i >= 0; i--) {
    const [node, at] = cuts[i];
    const rest = at ? node.splitText(at) : node;
    const br = document.createElement('br');
    br.className = 'pin';
    rest.parentNode.insertBefore(br, rest);
  }
  return cuts.length;
}

function unpin(el) {
  el.querySelectorAll('br.pin').forEach((br) => br.remove());
  el.normalize();
}

// a link that points at this same page (written "#book", "services.html#book" or "index.html#find") → its #id, else null
export function samePageHash(a) {
  if (!a || !a.hash) return null;
  const u = new URL(a.href, location.href);
  const page = (p) => p.replace(/\/index\.html$/, '/');
  if (u.origin !== location.origin || page(u.pathname) !== page(location.pathname)) return null;
  return decodeURIComponent(u.hash.slice(1)) || null;
}

// arriving from another page with #id in the URL: land on it once pinned sections have been laid out
// (the browser's own jump happens before ScrollTrigger adds its spacers, so it lands in the wrong place)
export function landOnHash(go) {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (!el || id === 'top') return;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const land = () => { requestAnimationFrame(() => go(el)); setTimeout(() => { window.ScrollTrigger?.refresh(); go(el); }, 350); };
  if (document.readyState === 'complete') land(); else window.addEventListener('load', land, { once: true });
}
