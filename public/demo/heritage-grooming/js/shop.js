// Products (shop.html): Lenis + GSAP (ScrollTrigger, SplitText, Flip), the hero bento of shelves (with its search) and the counter's row of mirrors (plain photos throughout, no WebGL).
// Progressive like the other pages: without GSAP, WebGL or with reduced motion every product is listed with its still,
// the filter, the picker and the bag all still work. Calm motion: entrances run once; the one loop is the counter, which
// turns to the next product every 6 s (pausable, and it waits off screen, under a finger, the pointer or the keyboard).

import { saveOrder } from './kersivo.js';
import { PRODUCTS, SHOP, CATS, HAIR_TYPES, FEATURED, byId, imgOf, typeOf, money } from './shop-data.js';
import { detailOf } from './shop-details.js';
import { frame } from './brass-frame.js';
import { mountStatus, fitSign, footerMotion, splitLines, fontsReady, samePageHash, landOnHash } from './house.js';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('static');
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const { gsap, ScrollTrigger, SplitText, Flip, Lenis } = window;
const motion = !!(gsap && ScrollTrigger && SplitText) && !reduce;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// open now or not, and the footer's fascia fitted edge to edge (house.js)
mountStatus();
fitSign(document.querySelector('.footer__sign'));

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const nav = $('[data-nav]');
let lenis = null;
let counterApi = null;            // set while the counter's rotation runs: { jump(i) }
let bag = [];                     // [{ id, qty }], kept in localStorage between visits

/* ───────────────────────── basics (work without any library) ───────────────────────── */

function scrollToEl(el, { offset = 0, immediate = false } = {}) {
  if (!el) return;
  // "#top" is the page itself, not the hero: the hero can be fixed or sticky, so measuring it would land where we already are
  if (el.id === 'top') el = 0;
  if (lenis) { lenis.resize(); lenis.scrollTo(el, { offset, immediate, force: immediate, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) }); }
  else if (el === 0) window.scrollTo({ top: 0, behavior: reduce || immediate ? 'instant' : 'smooth' });
  else el.scrollIntoView({ behavior: reduce || immediate ? 'instant' : 'smooth', block: 'start' });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href*="#"]');
  const id = samePageHash(a);
  const target = id && document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  closeMenu();
  const go = () => { if (a.dataset.filterGo) filterTo(a.dataset.filterGo); scrollToEl(target); };
  // from inside the bag: the drawer closes first (the page cannot scroll while it is open), then the page moves
  if (a.closest('.bag')) closeBag(() => requestAnimationFrame(go)); else go();
  history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`);
});

// phone menu
const menu = $('#menu'), toggle = $('.nav__toggle');
function openMenu() {
  menu.hidden = false; toggle.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-label', 'Close menu');
  nav.classList.remove('is-hidden'); lenis?.stop();
  if (motion) gsap.fromTo($$('.menu__links > *'), { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: .7, ease: 'expo.out', stagger: .05, overwrite: true });
}
function closeMenu() {
  if (!menu || menu.hidden) return;
  toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu');
  menu.hidden = true; lenis?.start();
}
toggle?.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); toggle.focus(); } });
matchMedia('(min-width: 1280px)').addEventListener('change', closeMenu);

// nav state, progress line and the phone bag bar
const bagbar = $('.bagbar');
let footerSeen = false;
{
  const progress = $('.nav__progress');
  let last = 0;
  new IntersectionObserver((entries) => { footerSeen = entries[0].isIntersecting; update(); }).observe($('.footer'));
  function update() {
    const y = window.scrollY, vh = window.innerHeight;
    nav.classList.toggle('is-solid', y > vh * .5);
    if (menu.hidden) nav.classList.toggle('is-hidden', y > vh && y > last + 2 ? true : y < last - 2 ? false : nav.classList.contains('is-hidden'));
    const max = document.documentElement.scrollHeight - vh;
    progress.style.transform = `scaleX(${max > 0 ? clamp(y / max) : 0})`;
    bagbar.classList.toggle('is-on', count() > 0 && y > vh * .5 && !footerSeen);
    last = y;
  }
  window.addEventListener('scroll', update, { passive: true });
  document.addEventListener('bag:change', update);
  update();
}

const announcer = $('[data-announce]');
const announce = (text) => { announcer.textContent = ''; setTimeout(() => { announcer.textContent = text; }, 60); };

/* ───────────────────────── the bag ───────────────────────── */

// BAG.submit resolves { ok: true } (or { ok: false, message }). KERSIVO demo: the reservation shows in the
// owner dashboard's Orders (js/kersivo.js); nothing reaches the shop and no payment is taken.
export const BAG = {
  key: 'hg-bag',
  async submit(order) { return saveOrder(order); },
};

try { bag = JSON.parse(localStorage.getItem(BAG.key) || '[]').filter((l) => byId(l.id) && l.qty > 0); } catch { bag = []; }
const save = () => { try { localStorage.setItem(BAG.key, JSON.stringify(bag)); } catch { /* private window: the bag lives for this visit */ } };
function count() { return bag.reduce((n, l) => n + l.qty, 0); }
function total() { return bag.reduce((n, l) => n + l.qty * byId(l.id).price, 0); }
const items = (n) => `${n} ${n === 1 ? 'item' : 'items'}`;

const dlg = $('.bag');
const bagBtn = $('.bagbtn');
const list = $('[data-bag-list]');

const ICON_MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';

function renderBag() {
  const n = count(), sum = total();
  $('[data-bag-count]').textContent = n;
  bagBtn.classList.toggle('has-items', n > 0);
  bagBtn.setAttribute('aria-label', n ? `Open your bag, ${items(n)}, ${money(sum)}` : 'Open your bag, empty');
  $('[data-bagbar-label]').textContent = n ? `Your bag · ${items(n)} · ${money(sum)}` : 'Your bag';
  $$('[data-bag-total]').forEach((b) => { b.textContent = money(sum); });
  $('[data-bag-count-line]').textContent = `${items(n)} to collect`;
  $('[data-bag-empty]').hidden = n > 0;
  $('[data-bag-foot]').hidden = n === 0;

  list.innerHTML = bag.map(({ id, qty }) => {
    const p = byId(id);
    return `<li class="line" data-line="${id}">
      <img class="line__img" src="${imgOf(p)}" width="717" height="960" alt="">
      <div><p class="line__name">${p.name}</p><p class="line__meta">${p.brand ? `${p.brand} · ` : ''}${p.size} · ${money(p.price)} each</p></div>
      <p class="line__price">${money(p.price * qty)}</p>
      <div class="qty">
        <span class="qty__ctl">
          <button type="button" data-qty="-1" aria-label="One fewer ${p.name}">${ICON_MINUS}</button>
          <output aria-live="polite" aria-label="${p.name}, quantity">${qty}</output>
          <button type="button" data-qty="1" aria-label="One more ${p.name}" ${qty >= 9 ? 'disabled' : ''}>${ICON_PLUS}</button>
        </span>
        <button type="button" class="qty__remove" data-remove>Remove</button>
      </div>
    </li>`;
  }).join('');
  save();
  document.dispatchEvent(new CustomEvent('bag:change'));
}

function setQty(id, qty) {
  const line = bag.find((l) => l.id === id);
  if (qty <= 0) bag = bag.filter((l) => l.id !== id);
  else if (line) line.qty = Math.min(9, qty);
  else bag.push({ id, qty: Math.min(9, qty) });
  renderBag();
}

list.addEventListener('click', (e) => {
  const li = e.target.closest('[data-line]');
  if (!li) return;
  const id = li.dataset.line, line = bag.find((l) => l.id === id);
  const step = e.target.closest('[data-qty]');
  if (step) {
    const next = line.qty + Number(step.dataset.qty);
    setQty(id, next);
    announce(next > 0 ? `${byId(id).name}: ${next}. Total ${money(total())}.` : `${byId(id).name} removed.`);
    $(`[data-line="${id}"] [data-qty="${step.dataset.qty}"]`)?.focus() ?? $('[data-bag-close]').focus();
  } else if (e.target.closest('[data-remove]')) {
    const rest = $$('[data-line]', list);
    const nextFocus = rest[rest.indexOf(li) + 1] || rest[rest.indexOf(li) - 1];
    const drop = () => { setQty(id, 0); announce(`${byId(id).name} removed.`); (nextFocus ? $(`[data-line="${nextFocus.dataset.line}"] [data-remove]`) : $('.bag__close')).focus(); };
    if (motion) gsap.to(li, { opacity: 0, x: 40, duration: .3, ease: 'power2.in', onComplete: drop });
    else drop();
  }
});

function addToBag(id, btn, n = 1) {
  const p = byId(id);
  const line = bag.find((l) => l.id === id);
  setQty(id, (line?.qty || 0) + n);
  announce(`${p.name} added to your bag. ${items(count())}, ${money(total())}.`);
  fly(id, btn);
  if (btn) {
    const label = $('span', btn);
    btn.classList.add('is-added');
    if (label) { label.dataset.text ??= label.textContent; label.textContent = 'Added'; }
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.classList.remove('is-added'); if (label) label.textContent = label.dataset.text; }, 1600);
  }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-add]');
  if (b) addToBag(b.dataset.add, b);
});

// the packshot lifts off the page and drops into the bag in the nav
function fly(id, btn) {
  const bump = () => { bagBtn.classList.remove('is-bump'); void bagBtn.offsetWidth; bagBtn.classList.add('is-bump'); };
  if (!motion) return bump();
  const holder = btn?.closest('.card, .item, .pick-result, .pdp');
  const srcImg = holder && $('img', holder);
  let r = srcImg?.getBoundingClientRect();
  if (!r || !r.width) r = $('.mirrors__m.is-on img')?.getBoundingClientRect() || btn.getBoundingClientRect();   // the pinned counter shows its mirror, not the still
  nav.classList.remove('is-hidden');
  const toEl = getComputedStyle(bagBtn).display !== 'none' ? bagBtn : bagbar;
  const t = toEl.getBoundingClientRect();
  const w = Math.min(r.width, 220), h = w * 11 / 9;
  const x0 = r.left + r.width / 2 - w / 2, y0 = r.top + r.height / 2 - h / 2;
  const x2 = t.left + t.width / 2 - w / 2, y2 = t.top + t.height / 2 - h / 2;
  const x1 = (x0 + x2) / 2, y1 = Math.min(y0, y2) - 140;
  const img = new Image();
  img.src = imgOf(byId(id)); img.alt = ''; img.className = 'flyer';
  Object.assign(img.style, { width: `${w}px`, height: `${h}px` });
  (btn?.closest('dialog[open]') || document.body).append(img);   // inside an open dialog the flyer must share its top layer
  const o = { t: 0 };
  gsap.to(o, {
    t: 1, duration: .95, ease: 'power2.inOut',
    onUpdate: () => {
      const k = o.t, a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
      const x = a * x0 + b * x1 + c * x2, y = a * y0 + b * y1 + c * y2;
      img.style.transform = `translate(${x}px, ${y}px) scale(${1 - .82 * k}) rotate(${k * -14}deg)`;
      img.style.opacity = k > .85 ? (1 - k) / .15 : 1;
    },
    onComplete: () => { img.remove(); bump(); },
  });
}

/* the drawer */
const views = Object.fromEntries($$('[data-view]', dlg).map((v) => [v.dataset.view, v]));
function view(name) {
  Object.entries(views).forEach(([k, v]) => { v.hidden = k !== name; });
  if (motion) gsap.fromTo(views[name], { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: .5, ease: 'power3.out', clearProps: 'all' });
}
let opener = null;
function openBag() {
  if (dlg.open) return;
  opener = document.activeElement;
  closeMenu();
  renderBag();
  view('list');
  dlg.showModal();
  lenis?.stop();
  if (motion) gsap.fromTo(dlg, { xPercent: 100 }, { xPercent: 0, duration: .7, ease: 'expo.out', clearProps: 'transform' });
}
function closeBag(then) {
  if (!dlg.open) { then?.(); return; }
  const done = () => {
    dlg.close(); lenis?.start();
    opener?.focus?.({ preventScroll: !!then });   // going somewhere: focus must not pull the page back to the opener
    then?.();
  };
  if (motion) gsap.to(dlg, { xPercent: 100, duration: .45, ease: 'power3.in', onComplete: () => { gsap.set(dlg, { clearProps: 'transform' }); done(); } });
  else done();
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-bag-open]')) openBag();
  else if (e.target.closest('[data-bag-close]')) {
    if (e.target.closest('[data-bag-reset]')) { bag = []; renderBag(); }
    if (!e.target.closest('a')) closeBag();
  }
});
dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeBag(); });
dlg.addEventListener('click', (e) => { if (e.target === dlg) closeBag(); });   // a click on the backdrop

/* reserve: who collects, and which day */
const form = views.form;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
let day = null;
function buildDays() {
  const box = $('[data-bag-days]');
  const out = [];
  const d = new Date(); d.setHours(12, 0, 0, 0);
  while (out.length < 6) {                       // the shop is open Tuesday to Saturday (js/data.js)
    d.setDate(d.getDate() + 1);
    if (d.getDay() >= 2) out.push(new Date(d));
  }
  box.innerHTML = out.map((x, i) => `<button type="button" class="day" role="radio" aria-checked="false" tabindex="${i ? -1 : 0}" data-day="${x.toISOString()}">
    <span class="day__dow">${DOW[x.getDay()]}</span><span class="day__num">${x.getDate()}</span><span class="day__mon">${MON[x.getMonth()]}</span></button>`).join('');
  day = null;
}
function pickDay(btn) {
  $$('.day', form).forEach((b) => { const on = b === btn; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  day = new Date(btn.dataset.day);
  $('[data-error-for="day"]', form).textContent = '';
}
form.addEventListener('click', (e) => { const b = e.target.closest('.day'); if (b) pickDay(b); });
form.addEventListener('keydown', (e) => {
  const b = e.target.closest('.day');
  if (!b || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
  e.preventDefault();
  const all = $$('.day', form), i = all.indexOf(b);
  const next = all[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length];
  pickDay(next); next.focus();
});
$('[data-bag-next]').addEventListener('click', () => { buildDays(); renderBag(); view('form'); $('input[name="name"]', form).focus(); });
$('[data-bag-back]').addEventListener('click', () => { view('list'); $('[data-bag-next]').focus(); });

function error(name, msg) {
  const out = $(`[data-error-for="${name}"]`, form);
  out.textContent = msg;
  const input = $(`[name="${name}"]`, form);
  if (input) { input.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (msg) input.setAttribute('aria-describedby', out.id ||= `err-${name}`); }
  return !msg;
}
form.addEventListener('input', (e) => { if (e.target.name && e.target.getAttribute('aria-invalid') === 'true') error(e.target.name, ''); });
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = form.elements.name.value.trim(), phone = form.elements.phone.value.trim();
  const ok = [
    error('name', name.length < 2 ? 'Please give the name we should write on the bag.' : ''),
    error('phone', phone.replace(/\D/g, '').length < 7 ? 'Please give a mobile number we can text when it is ready.' : ''),
    error('day', day ? '' : 'Please choose the day you will come in.'),
  ];
  if (ok.includes(false)) { $('[aria-invalid="true"], [data-error-for="day"]:not(:empty)', form)?.closest('label, .bag__days, span')?.querySelector?.('input')?.focus(); return; }
  const n = count(), sum = total();
  const res = await BAG.submit({ name, phone, day: day.toISOString(), lines: bag.map((l) => ({ ...l })), total: sum });
  if (!res.ok) { error('day', res.message || 'That did not go through. Please try again, or call in at the shop.'); return; }
  $('[data-done-title]').textContent = `Held for ${DAY[day.getDay()]} ${day.getDate()} ${MONTH[day.getMonth()]}`;
  $('[data-done-body]').textContent = `We will put your ${items(n)} (${money(sum)}) behind the counter with ${name.split(' ')[0]} on the bag. Pay when you collect, by card or cash.`;
  view('done');
  views.done.focus();
  form.reset();
});

renderBag();

/* ───────────────────────── the whole shelf: filter ───────────────────────── */

const grid = $('.cards');
const cards = $$('.card', grid);
const chips = $$('.chip[data-filter]');
let current = 'all', running = null;
const rangeEmpty = $('[data-range-empty]');
function applyFilter(cat) {
  cards.forEach((c) => { c.hidden = cat !== 'all' && c.dataset.cat !== cat; });
  if (rangeEmpty) rangeEmpty.hidden = cards.some((c) => !c.hidden);
}
function filterTo(cat, instant = false) {
  if (cat === current) return;
  current = cat;
  markFound([]);
  chips.forEach((c) => { const on = c.dataset.filter === cat; c.setAttribute('aria-pressed', String(on)); c.classList.toggle('is-on', on); });
  const n = cards.filter((c) => cat === 'all' || c.dataset.cat === cat).length;
  announce(cat === 'all' ? `Showing all ${n} products.` : n ? `Showing ${n} ${cat} products.` : `The ${cat} shelf is on its way.`);
  if (!(motion && Flip) || instant) { running?.progress(1); return applyFilter(cat); }

  running?.progress(1);
  const leaving = cards.filter((c) => !c.hidden && cat !== 'all' && c.dataset.cat !== cat);
  running = gsap.timeline();
  if (leaving.length) running.to(leaving, { opacity: 0, scale: .94, duration: .26, ease: 'power1.in', stagger: .02 });
  running.add(() => {
      const h0 = grid.offsetHeight;
      const state = Flip.getState(cards);
      applyFilter(cat);
      gsap.set(leaving, { clearProps: 'opacity,scale,transform' });
      const h1 = grid.offsetHeight;
      gsap.fromTo(grid, { height: h0 }, { height: h1, duration: .8, ease: 'power3.inOut', clearProps: 'height' });
      Flip.from(state, {
        duration: .8, ease: 'power3.inOut', stagger: .03, scale: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: .94 }, { opacity: 1, scale: 1, duration: .7, ease: 'power2.out', delay: .2, stagger: .04 }),
      });
    });
}
chips.forEach((c) => c.addEventListener('click', () => filterTo(c.dataset.filter)));

/* ───────────────────────── the product sheet ───────────────────────── */
// A card's name (the whole card through its stretched link) or a counter product's "Full details" opens the product
// in a dialog: photo, maker, price, words, specs, how to use, four from the same shelf. Previous / next walk the shelf
// as it is filtered; the address keeps ?product=<id>, so a sheet can be shared and opens on load. Without JavaScript
// the link only reloads the page; without GSAP or with reduced motion the sheet simply appears.
const pdp = $('.pdp');
const pdpScroll = $('[data-pdp-scroll]', pdp);
let pdpId = null, pdpQty = 1, pdpOpener = null, pdpList = [];
const pdpSet = (sel, text) => { $(sel, pdp).textContent = text; };
const kindName = (p) => HAIR_TYPES.find((t) => t.id === typeOf(p.id))?.name;
const catOf = (p) => CATS.find((c) => c.id === p.cat)?.name || '';
const pipRow = (v) => `<span class="pips" role="img" aria-label="${Math.round(v)} out of 5">${Array.from({ length: 5 }, (_, i) => `<i${i < Math.round(v) ? ' class="on"' : ''}></i>`).join('')}</span>`;
const material = (p) => !/\d/.test(p.size);   // "Brass", "Beech": a tool, its size field is what it is made of

// the shelf the arrows walk: the grid as it is filtered, or the whole shop when the grid shows none of it
function shelfFor(id) {
  const shown = cards.filter((c) => !c.hidden).map((c) => c.dataset.flipId);
  return shown.includes(id) ? shown : SHOP.map((p) => p.id);
}

function related(p) {
  const kind = typeOf(p.id);
  const same = SHOP.filter((q) => q.id !== p.id && q.cat === p.cat);
  const near = same.filter((q) => kind && typeOf(q.id) === kind);
  const rest = same.filter((q) => !near.includes(q)).sort((a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price));
  return [...near, ...rest].slice(0, 4);
}

function pdpQtyTo(n) {
  pdpQty = clamp(n, 1, 9);
  const p = byId(pdpId);
  pdpSet('[data-pdp-count]', pdpQty);
  pdpSet('[data-pdp-sum]', money(p.price * pdpQty));
  $('[data-pdp-qty="-1"]', pdp).disabled = pdpQty <= 1;
  $('[data-pdp-qty="1"]', pdp).disabled = pdpQty >= 9;
  $('[data-pdp-add]', pdp).setAttribute('aria-label', `Add ${pdpQty} ${p.brand} ${p.name} to the bag, ${money(p.price * pdpQty)}`);
}

function pdpInBag() {
  if (!pdpId) return;
  const n = bag.find((l) => l.id === pdpId)?.qty || 0;
  $('[data-pdp-inbag]', pdp).hidden = !n;
  pdpSet('[data-pdp-inbag-text]', `${n} in your bag`);
}
document.addEventListener('bag:change', pdpInBag);

function pdpWrite(p) {
  const d = detailOf(p);
  const kind = kindName(p);
  pdpSet('[data-pdp-crumb]', kind ? `${catOf(p)} · ${kind}` : catOf(p));
  const i = pdpList.indexOf(p.id);
  pdpSet('[data-pdp-pos]', `${i + 1} / ${pdpList.length}`);
  pdpSet('[data-pdp-maker]', p.brand);
  pdpSet('[data-pdp-name]', p.name);
  pdpSet('[data-pdp-line]', p.line);
  pdpSet('[data-pdp-price]', money(p.price));
  pdpSet('[data-pdp-size]', p.size);
  pdpSet('[data-pdp-desc]', d.desc || `${p.line}.`);
  pdpSet('[data-pdp-use]', d.use || '');
  $('.pdp__use', pdp).hidden = !d.use;
  const img = $('[data-pdp-img]', pdp);
  img.src = imgOf(p); img.alt = `${p.brand} ${p.name}, ${p.size}`;

  const rows = [
    p.hold != null && ['Hold', pipRow(p.hold)],
    p.shine != null && ['Shine', pipRow(p.shine)],
    ['Type', esc(kind || catOf(p))],
    [material(p) ? 'Made of' : 'Size', esc(p.size), true],
    d.scent && ['Scent', esc(d.scent), true],
    d.suits && ['Suits', esc(d.suits), true],
    d.chair && ['In the chair', `<a class="link" href="${d.chair[1]}">${esc(d.chair[0])}</a>`],
  ].filter(Boolean);
  $('[data-pdp-specs]', pdp).innerHTML = rows.map(([k, v, assumed]) => `<div class="spec"><dt>${k}</dt><dd${assumed ? ' data-assumed' : ''}>${v}</dd></div>`).join('');

  const rel = related(p);
  $('.pdp__more', pdp).hidden = !rel.length;
  $('[data-pdp-related]', pdp).innerHTML = rel.map((q) => `<li><button type="button" class="rel" data-pdp-go="${q.id}" aria-label="${esc(q.brand)} ${esc(q.name)}, ${money(q.price)}">
    <span class="rel__media"><img src="${imgOf(q)}" width="717" height="960" alt="" loading="lazy" decoding="async"></span>
    <span class="rel__name">${esc(q.name)}</span>
    <span class="rel__meta"><span>${esc(q.brand)}</span><span data-assumed>${money(q.price)}</span></span>
  </button></li>`).join('');

  const one = pdpList.length < 2;
  $$('[data-pdp-step]', pdp).forEach((b) => { b.disabled = one; });
  pdpQtyTo(1);
  pdpInBag();
  const add = $('[data-pdp-add]', pdp);
  clearTimeout(add._t); add.classList.remove('is-added');
  const label = $('span', add); if (label.dataset.text) label.textContent = label.dataset.text;
}

const pdpUrl = (id) => {
  const u = new URL(location.href);
  if (id) u.searchParams.set('product', id); else u.searchParams.delete('product');
  history.replaceState(null, '', u.pathname + u.search + u.hash);
};

// the parts that change when the sheet moves to another product
const pdpParts = () => [$('.pdp__photo img', pdp), ...$$('[data-pdp-part]', pdp).filter((el) => !el.hidden), $('.pdp__more', pdp)];

function showProduct(id, { dir = 0 } = {}) {
  const p = byId(id);
  if (!p) return;
  const same = id === pdpId;
  pdpId = id;
  pdpUrl(id);
  if (same) return;
  if (!pdp.open || !motion) { pdpWrite(p); pdpScroll.scrollTop = 0; return; }
  // moving inside the sheet: the old product leaves the way the arrow points, the new one settles in
  gsap.timeline()
    .to(pdpParts(), { opacity: 0, x: dir * -14, duration: .18, ease: 'power1.in', overwrite: true })
    .add(() => {
      pdpWrite(p);
      pdpScroll.scrollTo({ top: 0 });
      gsap.fromTo(pdpParts(), { opacity: 0, x: dir * 18 }, { opacity: 1, x: 0, duration: .55, ease: 'power3.out', stagger: .035, clearProps: 'opacity,transform' });
    });
  announce(`${p.brand} ${p.name}, ${money(p.price)}.`);
}

function openProduct(id, from) {
  if (!byId(id)) return;
  pdpList = shelfFor(id);
  if (!pdp.open) {
    pdpOpener = from || document.activeElement;
    pdpId = null;
    showProduct(id);
    closeMenu();
    pdp.showModal();
    lenis?.stop();
    $('[data-pdp-close]', pdp).focus({ preventScroll: true });
    if (motion) {
      const phone = innerWidth < 900;
      gsap.timeline()
        .fromTo(pdp, phone ? { yPercent: 100 } : { opacity: 0, y: 28, scale: .985 }, { ...(phone ? { yPercent: 0 } : { opacity: 1, y: 0, scale: 1 }), duration: phone ? .6 : .7, ease: 'expo.out', clearProps: 'transform,opacity' })
        .fromTo($('.pdp__photo img', pdp), { scale: 1.06 }, { scale: 1, duration: 1.1, ease: 'expo.out', clearProps: 'scale,transform' }, 0)
        .fromTo($$('[data-pdp-part]', pdp), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .6, ease: 'power3.out', stagger: .045, clearProps: 'opacity,transform' }, .12);
    }
  } else showProduct(id);
}

function closeProduct(then) {
  if (!pdp.open) { then?.(); return; }
  const id = pdpId;
  const done = () => {
    pdp.classList.remove('is-closing');
    pdp.close(); lenis?.start();
    pdpUrl(null); pdpId = null;
    // back to where the reader was: the card of the product they ended on, if it is on the shelf, else the opener
    const card = $(`.card[data-flip-id="${id}"]:not([hidden]) .card__link`);
    const to = card && (!pdpOpener || pdpOpener === document.body || pdpOpener.closest?.('.card')) ? card : pdpOpener;
    to?.focus?.({ preventScroll: !card || !!then });
    if (card && to === card) {
      const r = card.closest('.card').getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) scrollToEl(card.closest('.card'), { offset: -innerHeight * .3, immediate: true });
    }
    then?.();
  };
  pdp.classList.add('is-closing');
  if (motion) {
    const phone = innerWidth < 900;
    gsap.to(pdp, { ...(phone ? { yPercent: 100 } : { opacity: 0, y: 16, scale: .99 }), duration: .3, ease: 'power2.in', onComplete: () => { gsap.set(pdp, { clearProps: 'all' }); done(); } });
  } else done();
}

function stepProduct(dir) {
  if (pdpList.length < 2) return;
  const i = pdpList.indexOf(pdpId);
  showProduct(pdpList[(i + dir + pdpList.length) % pdpList.length], { dir });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-pdp]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;   // a new tab still gets the address
  e.preventDefault();
  openProduct(a.dataset.pdp, a);
});
pdp.addEventListener('click', (e) => {
  if (e.target === pdp) return closeProduct();   // a click on the backdrop
  const t = e.target;
  if (t.closest('[data-pdp-close]')) closeProduct();
  else if (t.closest('[data-pdp-step]')) stepProduct(Number(t.closest('[data-pdp-step]').dataset.pdpStep));
  else if (t.closest('[data-pdp-qty]')) pdpQtyTo(pdpQty + Number(t.closest('[data-pdp-qty]').dataset.pdpQty));
  else if (t.closest('[data-pdp-go]')) {
    const id = t.closest('[data-pdp-go]').dataset.pdpGo;
    if (!pdpList.includes(id)) pdpList = SHOP.map((p) => p.id);
    showProduct(id, { dir: 1 });
    $('[data-pdp-close]', pdp).focus({ preventScroll: true });
  } else if (t.closest('[data-pdp-add]')) {
    const room = 9 - (bag.find((l) => l.id === pdpId)?.qty || 0);
    if (room <= 0) { announce(`You have the most we can hold of ${byId(pdpId).name}: 9.`); return; }
    addToBag(pdpId, t.closest('[data-pdp-add]'), Math.min(pdpQty, room));
    pdpQtyTo(1);
  } else if (t.closest('[data-pdp-bag]')) closeProduct(() => requestAnimationFrame(openBag));
  else if (t.closest('a[href]') && !t.closest('a[href^="?"]')) closeProduct();   // "In the chair" leaves for services.html
});
pdp.addEventListener('cancel', (e) => { e.preventDefault(); closeProduct(); });
pdp.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (e.target.closest('input, textarea, select')) return;
  e.preventDefault();
  stepProduct(e.key === 'ArrowRight' ? 1 : -1);
});
// a shared address opens its product once the page has drawn
{
  const id = new URLSearchParams(location.search).get('product');
  if (id && byId(id)) setTimeout(() => openProduct(id, null), 0);
  else if (id) pdpUrl(null);
}

/* ───────────────────────── which pomade ───────────────────────── */

const WANT = { length: { short: 4.6, medium: 3, long: 1.4 }, finish: { matte: .4, natural: 2.3, shine: 4.7 } };
const WHY = {
  'kestrel-matte-clay': 'The most hold on the shelf with no shine at all: it keeps a short crop textured and looks like nothing is in it.',
  'oakmoss-firm-pomade': 'Firm enough for a parting or a slick-back, with a soft shine. Water-based, so it rinses out in one wash.',
  'corvid-fibre-paste': 'A pliable hold that leaves longer hair moving, with a natural finish you can restyle with your fingers.',
  'hollowmere-texture-powder': 'A light dusting at the root for lift and grip on fine hair, with no shine and nothing to see.',
  'halden-sea-salt-spray': 'A light, loose texture for longer hair: sprayed in damp and dried, it looks like a day at the sea.',
  'blackthorn-styling-cream': 'A light, soft hold for medium and longer hair: it tames frizz and leaves a gentle sheen, never stiff.',
  'harrow-oil-pomade': 'The glossiest finish on the shelf with a medium hold, for a classic side parting or a slick-back that stays combed.',
};
// the stylers on the chart: the hair products with a hold and a shine
const HAIR = PRODUCTS.filter((p) => p.cat === 'hair' && p.hold != null);
const X = (v) => 40 + v * 68, Y = (v) => 360 - v * 68;
const you = $('[data-you]');
const youAt = { x: 0, y: 0 };
const fit = (p, h, s) => Math.hypot(p.hold - h, (p.shine - s) * .85);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let shownPick = 'kestrel-matte-clay';
let match = null;                    // what the two questions point at: { p, h, s, length, finish }
function placeYou(x, y) { youAt.x = x; youAt.y = y; you.setAttribute('transform', `translate(${x} ${y})`); }

/* the chart: any number of stylers as plain dots, never a name per dot (they would sit on top of each other).
   One name at a time: the match, or the dot under the pointer or the keyboard. Products that share a spot are
   spread on a small ring round it. A dot is a button: it shows that product in the card beside the chart. */
const SVGNS = 'http://www.w3.org/2000/svg';
const dotsG = $('[data-dots]');
const tag = $('[data-tag]'), tagText = $('text', tag), tagBox = $('rect', tag), tagLine = $('line', tag);
const spots = [];
dotsG.replaceChildren(...HAIR.map((p) => {
  const bx = X(p.shine), by = Y(p.hold);
  let x = bx, y = by;
  const twins = spots.filter((q) => Math.hypot(q.bx - bx, q.by - by) < 1).length;
  if (twins) { const a = -Math.PI / 2 + twins * (Math.PI / 3); x += Math.cos(a) * 15; y += Math.sin(a) * 15; }
  spots.push({ p, bx, by, x, y });
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'chart__dot');
  g.dataset.dot = p.id;
  g.setAttribute('transform', `translate(${x} ${y})`);
  g.setAttribute('tabindex', '0');
  g.setAttribute('role', 'button');
  g.setAttribute('aria-label', `${p.brand} ${p.name}: hold ${p.hold} of 5, shine ${p.shine} of 5`);
  const hit = document.createElementNS(SVGNS, 'circle'); hit.setAttribute('r', '16'); hit.setAttribute('class', 'chart__hit');
  const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('r', '7');
  g.append(hit, c);
  return g;
}));
const spotOf = (id) => spots.find((q) => q.p.id === id);

function nameOn(id, peek = false) {
  const q = spotOf(id);
  if (!q) { tag.classList.remove('is-on'); return; }
  tagText.textContent = q.p.name;
  const w = tagText.getComputedTextLength() + 20, h = 26;
  const right = q.x + 16 + w <= 396;                          // the name goes where there is room
  const bx = right ? q.x + 16 : q.x - 16 - w;
  const by = Math.min(Math.max(q.y - h / 2, 2), 398 - h);
  tagBox.setAttribute('x', bx); tagBox.setAttribute('y', by); tagBox.setAttribute('width', w); tagBox.setAttribute('height', h);
  tagText.setAttribute('x', bx + 10); tagText.setAttribute('y', by + 17.5);
  tagLine.setAttribute('x1', q.x + (right ? 9 : -9)); tagLine.setAttribute('y1', q.y);
  tagLine.setAttribute('x2', right ? bx : bx + w); tagLine.setAttribute('y2', by + h / 2);
  tag.classList.toggle('is-peek', peek);
  tag.classList.add('is-on');
}

const forLine = (p) => (match && p.id === match.p.id ? `For ${match.length} hair, ${match.finish}` : `Hold ${p.hold} of 5 · shine ${p.shine} of 5`);

function show(p) {
  const write = () => {
    $('[data-result-for]').textContent = forLine(p);
    $('[data-result-name]').textContent = `${p.brand} ${p.name}`;
    $('[data-result-why]').textContent = WHY[p.id] || `${p.line}.`;
    $('[data-result-price]').textContent = money(p.price);
    const add = $('[data-result-add]'); add.dataset.add = p.id; add.setAttribute('aria-label', `Add ${p.brand} ${p.name} to the bag`);
    const img = $('.pick-result__photo img'); img.src = imgOf(p); img.alt = `${p.brand} ${p.name}, ${p.size}`;
    // one press away: back to the match, or the next nearest to what was asked
    const alt = $('[data-result-alt]');
    const back = match && p.id !== match.p.id ? match.p : null;
    const near = match ? HAIR.filter((q) => q.id !== p.id && q.id !== match.p.id).sort((a, b) => fit(a, match.h, match.s) - fit(b, match.h, match.s)) : [];
    const opts = back ? [back] : near.slice(0, 2);
    alt.hidden = !opts.length;
    alt.innerHTML = opts.length
      ? `<span>${back ? 'Your match' : 'Also close'}</span> ${opts.map((q) => `<button type="button" class="link link--btn" data-alt="${q.id}">${esc(q.name)}</button>`).join('<i aria-hidden="true">·</i>')}`
      : '';
  };
  $$('.chart__dot').forEach((d) => d.classList.toggle('is-on', d.dataset.dot === p.id));
  nameOn(p.id);
  const same = p.id === shownPick;
  shownPick = p.id;
  if (same || !motion) { write(); return; }
  const parts = () => [$('.pick-result__photo img'), ...$$('.pick-result__text > *:not([hidden])')];
  gsap.timeline()
    .to(parts(), { opacity: 0, y: -8, duration: .2, ease: 'power1.in', stagger: .02, overwrite: true })
    .add(() => { write(); gsap.fromTo(parts(), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .6, ease: 'power3.out', stagger: .04, clearProps: 'opacity,transform' }); });
}

function pick(animate = true) {
  const length = $('input[name="length"]:checked').value, finish = $('input[name="finish"]:checked').value;
  const h = WANT.length[length], s = WANT.finish[finish];
  const best = HAIR.reduce((a, p) => (fit(p, h, s) < fit(a, h, s) ? p : a));
  match = { p: best, h, s, length, finish };
  const to = { x: X(s), y: Y(h) };
  if (animate && motion) gsap.to(youAt, { ...to, duration: .9, ease: 'expo.out', overwrite: true, onUpdate: () => placeYou(youAt.x, youAt.y) });
  else placeYou(to.x, to.y);
  if (!animate) shownPick = best.id;
  show(best);
}

// the dots: pointer or keyboard names one; a click or Enter shows it; leaving names the shown one again
const dotOf = (e) => e.target.closest?.('.chart__dot');
const peekAt = (d) => nameOn(d.dataset.dot, d.dataset.dot !== shownPick);
dotsG.addEventListener('pointerover', (e) => { const d = dotOf(e); if (d) peekAt(d); });
dotsG.addEventListener('pointerleave', () => nameOn(shownPick));
dotsG.addEventListener('focusin', (e) => { const d = dotOf(e); if (d) peekAt(d); });
dotsG.addEventListener('focusout', (e) => { if (!dotsG.contains(e.relatedTarget)) nameOn(shownPick); });
dotsG.addEventListener('click', (e) => { const d = dotOf(e); if (d) show(spotOf(d.dataset.dot).p); });
dotsG.addEventListener('keydown', (e) => {
  const d = dotOf(e);
  if (d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(spotOf(d.dataset.dot).p); }
});
$('[data-result-alt]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-alt]');
  if (b) show(HAIR.find((q) => q.id === b.dataset.alt));
});
$$('.ask input').forEach((i) => i.addEventListener('change', () => pick(true)));
pick(false);

/* ───────────────────────── the hero bento ───────────────────────── */

// a product found from the hero (search or a hair chip) is marked in the grid until the next pick
function markFound(ids) {
  const set = new Set(ids);
  cards.forEach((c) => c.classList.toggle('is-found', set.has(c.dataset.flipId)));
}

// a number that rolls to its new value (the tile's lowest price)
function roll(el, to) {
  const from = parseFloat(el.textContent.replace(/[^\d.]/g, '')) || to;
  if (from === to) return;
  if (!motion) { el.textContent = money(to); return; }
  const o = { v: from };
  gsap.to(o, { v: to, duration: .45, ease: 'power2.out', overwrite: true, onUpdate: () => { el.textContent = money(Math.round(o.v)); } });
}

// swap a window to the image `next`: it wipes up from the shelf edge over the one before (CSS does the wipe)
function showImg(win, next) {
  const cur = $('.tile__img.is-on', win);
  if (!next || cur === next) return;
  $$('.tile__img.was-on', win).forEach((i) => i.classList.remove('was-on'));
  cur?.classList.replace('is-on', 'was-on');
  next.classList.add('is-on');
  clearTimeout(win._t);
  win._t = setTimeout(() => cur?.classList.remove('was-on'), 850);
}

// the hair tile: a chip under the pointer (or the keyboard) shows its kind in the window and its lowest price;
// leaving the tile puts the shelf back. A click filters the grid to hair and marks that kind's products.
{
  const tile = $('.tile--hair');
  if (tile) {
    const win = $('.tile__window', tile);
    const price = $('.tile__from i', tile);
    const kinds = $$('.kind', tile);
    const base = +price.dataset.from;
    const preview = (k) => {
      kinds.forEach((c) => c.classList.toggle('is-on', c === k));
      showImg(win, $(`[data-kind-img="${k ? k.dataset.kind : HAIR_TYPES[0].id}"]`, win));
      roll(price, k ? +k.dataset.from : base);
    };
    // keyboard only: hovering a chip leaves the photograph and the price as they are
    kinds.forEach((k) => k.addEventListener('focus', () => { if (k.matches(':focus-visible')) preview(k); }));
    tile.addEventListener('focusout', (e) => { if (!tile.contains(e.relatedTarget)) preview(null); });
  }
}
document.addEventListener('click', (e) => {
  const k = e.target.closest('.kind[data-kind]');
  if (k) setTimeout(() => markFound(HAIR_TYPES.find((t) => t.id === k.dataset.kind).ids), 0);
  // the brass tile answers the picker's first question and takes you to the second
  const o = e.target.closest('.opt-go[data-length]');
  if (o) {
    const r = $(`input[name="length"][value="${o.dataset.length}"]`);
    if (r) { r.checked = true; pick(false); }
    setTimeout(() => $('input[name="finish"]:checked')?.focus({ preventScroll: true }), reduce ? 0 : 900);
  }
});

/* ───────────────────────── motion ───────────────────────── */

if (motion) run();

async function run() {
  gsap.registerPlugin(ScrollTrigger, SplitText, ...(Flip ? [Flip] : []));
  gsap.defaults({ ease: 'expo.out', duration: .9 });
  ScrollTrigger.config({ ignoreMobileResize: true });

  if (Lenis) {
    lenis = new Lenis({ lerp: .1, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  await fontsReady();

  intro();
  cursor();
  magnetic();
  counter();
  headings();
  footer();

  ScrollTrigger.refresh();
  window.addEventListener('load', () => ScrollTrigger.refresh());

  // arriving with #p-beard-oil (or any counter product) lands on it
  const at = FEATURED.findIndex((id) => location.hash === `#p-${id}`);
  if (at > -1) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const go = () => (counterApi ? counterApi.jump(at) : scrollToEl($(location.hash), { immediate: true }));
    const land = () => { requestAnimationFrame(go); setTimeout(() => { ScrollTrigger.refresh(); go(); }, 350); };
    if (document.readyState === 'complete') land(); else window.addEventListener('load', land, { once: true });
  } else landOnHash((el) => scrollToEl(el, { immediate: true }));
}

/* ── hero: the headline sets, the search comes up beside it, then the bento opens in reading order: each window
   lifts from its shelf edge (hair, beard, shave, skin), the words on each tile settle, the prices count up; once.
   Everything after that is answered by the pointer or the keyboard (CSS and the bento block above). ── */
function intro() {
  const title = splitLines(SplitText, '.phero__title', { type: 'lines,chars', mask: 'lines' });
  const gilt = title.chars.filter((c) => c.closest('em'));
  const plain = title.chars.filter((c) => !c.closest('em'));
  const wins = $$('.bento .tile__window');
  const words = $$('.tile__plate > *, .tile__text > *');
  const ask = $$('.tile--ask > *');
  const counts = $$('.bento .tile__from i[data-count]');

  gsap.set(wins, { clipPath: 'inset(100% 0% 0% 0%)' });
  const tl = gsap.timeline({ onComplete: () => title.revert() });
  tl.fromTo(nav, { yPercent: -100 }, { yPercent: 0, duration: 1, clearProps: 'transform' }, 0)
    .from(plain, { yPercent: 112, duration: 1.1, stagger: .016 }, .1)
    .from(gilt, { yPercent: 112, rotate: 6, transformOrigin: '0% 100%', duration: 1.3, stagger: .028 }, .5)
    .from('.phero__lede', { opacity: 0, y: 18, duration: 1 }, .6)
    .to(wins, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', stagger: .09, clearProps: 'clipPath' }, .8)
    .from(words, { opacity: 0, y: 14, duration: .9, stagger: .018, clearProps: 'opacity,transform' }, 1.1)
    .from(ask, { opacity: 0, y: 14, duration: .9, stagger: .05, clearProps: 'opacity,transform' }, 1.3);
  counts.forEach((el, i) => {
    const o = { v: 0 }, to = +el.dataset.count;
    tl.to(o, { v: to, duration: 1.3, ease: 'power3.out', onUpdate: () => { el.textContent = `£${Math.round(o.v)}`; } }, 1.3 + i * .09);
  });
}

/* ── on the counter: six products, one at a time, turning by themselves every 6 s.
   Wide screens: the stage, one brass mirror with a row of the product photos that slides one along (the row has no end:
   after the sixth comes the first again), the card beside it. Below that: the deck, one product card at a time on a
   native snap track that follows the finger. Both share one rotator: the line between the numbers is its timer; the
   pause button stops it, and it waits while the section is off screen, the tab is hidden, a finger is on the deck, the
   pointer is on the card (so "Add to bag" never changes under it) or the keyboard is inside. Photos as uploaded. ── */
const HOLD = 6;                     // seconds each product stays

function rotator(section, onNext) {
  const bar = $('.counter__count u', section);
  const holds = new Set(['view']);  // every reason it is waiting right now
  const tween = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: HOLD, ease: 'none', paused: true, onComplete: () => onNext() });
  const sync = () => (holds.size ? tween.pause() : tween.resume());
  const hold = (why, on) => { if (on) holds.add(why); else holds.delete(why); sync(); };

  const io = new IntersectionObserver(([e]) => hold('view', !e.isIntersecting), { threshold: .3 });
  io.observe(section);
  const onVis = () => hold('tab', document.hidden);
  document.addEventListener('visibilitychange', onVis);
  // only keyboard focus holds it (a mouse click on a name or on play must not)
  const onFocus = (e) => hold('focus', e.type === 'focusin' && !e.target.closest('.counter__ctl') && e.target.matches(':focus-visible'));
  section.addEventListener('focusin', onFocus);
  section.addEventListener('focusout', onFocus);

  return {
    hold,
    restart() { tween.progress(0); sync(); },   // a new product is up: its 6 s start again
    destroy() {
      tween.kill(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      section.removeEventListener('focusin', onFocus);
      section.removeEventListener('focusout', onFocus);
      gsap.set(bar, { clearProps: 'transform' });
    },
  };
}

function counter() {
  const section = $('.counter');
  const its = $$('.item', section);
  const idx = $$('.pidx', section);
  const ctl = $('.counter__ctl', section);
  const num = $('.counter__count b', section);
  const N = its.length;
  const wrap = (i) => ((i % N) + N) % N;
  const label = (i) => `0${i + 1}`;
  its.forEach((it, i) => { it.setAttribute('aria-roledescription', 'slide'); it.setAttribute('aria-label', `${i + 1} of ${N}`); });

  // shared by both layouts: the arrow keys
  function wire(step) {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select') || !/^Arrow(Left|Right)$/.test(e.key)) return;
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
    };
    section.addEventListener('keydown', onKey);
    ctl.hidden = false;
    return () => { section.removeEventListener('keydown', onKey); ctl.hidden = true; };
  }

  const mm = gsap.matchMedia();

  /* ── the stage (wide screens) ── */
  mm.add('(min-width: 1024px) and (min-height: 700px)', () => {
    section.classList.add('counter--stage');
    const stageEl = $('.counter__stage', section);
    const list = $('.counter__items', section);

    // the row of photos: one per product (a side one is clickable, the centre one is decoration: the names above and the
    // card beside carry the product for keyboards and screen readers)
    const row = document.createElement('div');
    row.className = 'mirrors';
    const mirrors = its.map((it, i) => {
      const m = document.createElement('span');
      m.className = 'mirrors__m';
      m.dataset.goto = i;
      const img = $('.item__photo img', it).cloneNode();
      img.loading = 'eager'; img.alt = ''; img.draggable = false;   // a native image drag would cancel the swipe
      m.append(img);
      row.append(m);
      return m;
    });
    stageEl.prepend(row);
    frame(stageEl);

    let p = 0, active = -1, w = 0, slide = null;

    function measure() {
      w = stageEl.offsetWidth;      // layout size: the entrance's scale must not shrink it
      row.style.setProperty('--mw', `${w}px`);
      row.style.setProperty('--mh', `${stageEl.offsetHeight}px`);
      place(p);
    }

    // where each photo stands for a position along the row: the current one fills the mirror, its neighbours wait just
    // past the edges and dim as they slide away; distances wrap, so the row runs on from the sixth to the first
    function place(at) {
      mirrors.forEach((m, k) => {
        let d = k - at;
        d -= N * Math.round(d / N);
        const a = Math.min(Math.abs(d), 1.6);
        m.style.transform = `translate(-50%, -50%) translateX(${(d * w).toFixed(1)}px)`;
        m.style.visibility = Math.abs(d) < 1.5 ? '' : 'hidden';
        m.style.setProperty('--dim', (Math.min(a, 1) * .62).toFixed(3));
        m.style.zIndex = String(10 - Math.round(a * 4));
      });
    }

    // the card beside: the name rises in the direction of travel, then the words, the specs and the price
    function show(to, dir) {
      its.forEach((c, i) => {
        if (i === to) return;
        c.classList.remove('is-active');
        gsap.to(c, { autoAlpha: 0, duration: .22, ease: 'power1.out', overwrite: true });
      });
      const el = its[to];
      el.classList.add('is-active');
      gsap.killTweensOf(el);
      gsap.set(el, { autoAlpha: 1 });
      gsap.fromTo($('.item__name', el), { yPercent: 50 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .95, delay: .06, overwrite: true });
      gsap.fromTo([$('.item__cat', el), $('.item__desc', el)], { y: 14 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: .8, delay: .1, stagger: .05, overwrite: true });
      gsap.fromTo([...$$('.spec', el), $('.item__buy', el)], { y: 16 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: .8, delay: .16, stagger: .045, overwrite: true });
      const pips = $$('.pips i.on', el);
      if (pips.length) gsap.fromTo(pips, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: .5, ease: 'power3.out', delay: .4, stagger: .06, overwrite: true });
      idx.forEach((b, i) => { b.classList.toggle('is-on', i === to); if (i === to) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      mirrors.forEach((m, i) => m.classList.toggle('is-on', i === to));
      num.textContent = label(to);
      active = to;
    }

    // slide to product i; delta is the way round (+1 for "next", even from the sixth to the first), otherwise the short way
    function go(i, delta) {
      i = wrap(i);
      if (i === active) return;
      if (delta == null) { delta = i - active; delta -= N * Math.round(delta / N); }
      const from = p, to = Math.round(p) + delta;
      slide?.kill();
      show(i, Math.sign(delta));
      rot.restart();
      const o = { p: from };
      slide = gsap.to(o, {
        p: to, duration: Math.min(.75 + .14 * Math.abs(to - from), 1.3), ease: 'power3.inOut',
        onUpdate: () => { p = o.p; place(p); },
        onComplete: () => { slide = null; p = wrap(to); place(p); },
      });
    }

    const rot = rotator(section, () => go(active + 1, 1));
    const unwire = wire((s) => go(active + s, s));
    const onIn = () => rot.hold('hover', true), onOut = () => rot.hold('hover', false);
    list.addEventListener('pointerenter', onIn);
    list.addEventListener('pointerleave', onOut);

    counterApi = {
      jump(i) {
        scrollToEl(section, { immediate: true });
        slide?.kill(); slide = null;
        p = wrap(i); place(p); show(p, 1); rot.restart();
      },
    };

    // a swipe across the mirror moves one along; a click on a name or on a side photo brings that one to the centre
    let drag = null, swiped = false;
    const down = (e) => { if (e.button > 0) return; drag = { x: e.clientX, id: e.pointerId }; swiped = false; };
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      drag = null;
      if (Math.abs(dx) > 48) { swiped = true; const s = -Math.sign(dx); go(active + s, s); }
    };
    const cancel = () => { drag = null; };
    const onPick = (e) => {
      const b = e.target.closest('.pidx, .mirrors__m');
      if (b && !swiped) go(+b.dataset.goto);
    };
    section.addEventListener('click', onPick);
    stageEl.addEventListener('pointerdown', down);
    stageEl.addEventListener('pointerup', up);
    stageEl.addEventListener('pointercancel', cancel);

    // the stage arrives with the section, once
    gsap.from(stageEl, { yPercent: 6, scale: .96, opacity: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 20%', scrub: true } });

    measure();
    show(0, 1);
    rot.restart();
    window.addEventListener('resize', measure);

    return () => {
      rot.destroy(); unwire(); slide?.kill();
      window.removeEventListener('resize', measure);
      list.removeEventListener('pointerenter', onIn);
      list.removeEventListener('pointerleave', onOut);
      section.removeEventListener('click', onPick);
      stageEl.removeEventListener('pointerdown', down);
      stageEl.removeEventListener('pointerup', up);
      stageEl.removeEventListener('pointercancel', cancel);
      section.classList.remove('counter--stage');
      row.replaceWith();
      idx.forEach((b) => { b.classList.remove('is-on'); b.removeAttribute('aria-current'); });
      its.forEach((c) => {
        c.classList.remove('is-active'); gsap.set(c, { clearProps: 'all' });
        $$('*', c).forEach((n) => gsap.set(n, { clearProps: 'transform,opacity' }));
      });
      num.textContent = label(0);
      counterApi = null;
    };
  });

  /* ── the deck (phones and tablets): one card at a time, swiped natively, turning every 6 s ── */
  mm.add('(max-width: 1023px), (max-height: 699px)', () => {
    section.classList.add('counter--deck');
    const track = $('.counter__items', section);
    let active = -1, fading = null;
    const at = () => clamp(Math.round(track.scrollLeft / (track.clientWidth || 1)), 0, N - 1);

    function mark(i) {
      if (i === active) return;
      active = i;
      num.textContent = label(i);
      rot.restart();
    }

    function go(i) {
      const ends = i < 0 || i >= N, dir = i >= N ? 1 : -1;
      i = wrap(i);
      if (i === active && !ends) return;
      const left = i * track.clientWidth;
      if (!ends) { track.scrollTo({ left, behavior: 'smooth' }); return; }
      // past either end: a short dip to the next card instead of rewinding past all the others
      fading?.kill();
      fading = gsap.timeline({ onComplete: () => { fading = null; } })
        .to(track, { opacity: 0, x: -14 * dir, duration: .2, ease: 'power1.in' })
        .add(() => { track.scrollTo({ left, behavior: 'instant' }); mark(i); })
        .fromTo(track, { x: 14 * dir }, { opacity: 1, x: 0, duration: .42, ease: 'power3.out', clearProps: 'opacity,transform' });
    }

    const rot = rotator(section, () => go(active + 1));
    const unwire = wire((s) => go(active + s));

    const onScroll = () => mark(at());
    const touch = (e) => rot.hold('drag', e.type === 'touchstart');
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('touchstart', touch, { passive: true });
    track.addEventListener('touchend', touch, { passive: true });
    track.addEventListener('touchcancel', touch, { passive: true });
    const onResize = () => { track.scrollTo({ left: active * track.clientWidth, behavior: 'instant' }); };
    window.addEventListener('resize', onResize);

    counterApi = {
      jump(i) {
        scrollToEl(section, { immediate: true });
        track.scrollTo({ left: wrap(i) * track.clientWidth, behavior: 'instant' });
        mark(wrap(i));
      },
    };

    track.scrollLeft = 0;
    mark(0);

    return () => {
      rot.destroy(); unwire(); fading?.kill();
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('touchstart', touch);
      track.removeEventListener('touchend', touch);
      track.removeEventListener('touchcancel', touch);
      window.removeEventListener('resize', onResize);
      gsap.set(track, { clearProps: 'opacity,transform' });
      section.classList.remove('counter--deck');
      num.textContent = label(0);
      counterApi = null;
    };
  });
}

/* ── brass cursor follower ── */
function cursor() {
  if (!fine) return;
  const el = $('.cursor'), label = $('.cursor__label');
  root.classList.add('has-cursor');
  const x = gsap.quickTo(el, 'x', { duration: .45, ease: 'power3' });
  const y = gsap.quickTo(el, 'y', { duration: .45, ease: 'power3' });
  let shown = false;
  window.addEventListener('pointermove', (e) => {
    x(e.clientX); y(e.clientY);
    if (!shown) { shown = true; gsap.set(el, { x: e.clientX, y: e.clientY }); gsap.to(el, { opacity: 1, duration: .3, ease: 'power1.out' }); }
  }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const lab = e.target.closest('[data-cursor]');
    const link = !lab && e.target.closest('a, button:not(:disabled), .opt, .mirrors__m:not(.is-on)');
    el.classList.toggle('is-label', !!lab);
    el.classList.toggle('is-link', !!link);
    if (lab) label.textContent = lab.dataset.cursor;
  });
  document.addEventListener('pointerleave', () => gsap.to(el, { opacity: 0, duration: .2 }));
  document.addEventListener('pointerenter', () => shown && gsap.to(el, { opacity: 1, duration: .2 }));
}

/* ── magnetic buttons ── */
function magnetic() {
  if (!fine) return;
  $$('[data-magnetic]').forEach((el) => {
    let x, y;
    el.addEventListener('pointermove', (e) => {
      x ??= gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' });
      y ??= gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * .28);
      y((e.clientY - (r.top + r.height / 2)) * .38);
    });
    el.addEventListener('pointerleave', () => { x = y = undefined; gsap.to(el, { x: 0, y: 0, scale: 1, duration: .9, ease: 'elastic.out(1, .45)', overwrite: true }); });
    el.addEventListener('pointerdown', () => gsap.to(el, { scale: .97, duration: .14, ease: 'power2.out', overwrite: 'auto' }));
    el.addEventListener('pointerup', () => gsap.to(el, { scale: 1, duration: .3, ease: 'power2.out', overwrite: 'auto' }));
  });
}

/* ── section headings rise line by line, once ── */
function headings() {
  $$('[data-lines]').forEach((el) => {
    gsap.set(el, { autoAlpha: 0 });
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => {
        const split = splitLines(SplitText, el, { type: 'lines', mask: 'lines' });
        gsap.set(el, { autoAlpha: 1 });
        gsap.from(split.lines, { yPercent: 108, duration: 1.2, stagger: .1, onComplete: () => split.revert() });
      },
    });
  });
}

/* ── footer: the fascia's mouldings draw out, the name rises inside them (house.js) ── */
function footer() { footerMotion({ gsap, ScrollTrigger, SplitText }); }
