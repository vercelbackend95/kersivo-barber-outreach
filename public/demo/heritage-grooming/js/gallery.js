// The work (gallery.html): Lenis + GSAP (ScrollTrigger, SplitText, Flip).
// Progressive like the other pages: without GSAP, WebGL or with reduced motion every photograph is on
// the page, every tile still opens its full-size file or the viewer, and every link still works.

import { SERVICES } from './data.js';
import { frame, frameAll } from './brass-frame.js';
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

// every photograph on the page hangs in the brass mirror frame
frameAll('.gframe__glass');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const pad = (n) => String(n).padStart(2, '0');

const nav = $('[data-nav]');
let lenis = null;

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
  scrollToEl(target);
  history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`);
});

// phone menu
const menu = $('#menu'), toggle = $('.nav__toggle');
function openMenu() {
  menu.hidden = false; toggle.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-label', 'Close menu');
  nav.classList.remove('is-hidden'); lenis?.stop();
  if (motion) gsap.fromTo($$('.menu__links > *'), { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: .7, ease: 'expo.out', stagger: .06, overwrite: true });
}
function closeMenu() {
  if (!menu || menu.hidden) return;
  toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu');
  menu.hidden = true; lenis?.start();
}
toggle?.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); toggle.focus(); } });
matchMedia('(min-width: 1280px)').addEventListener('change', closeMenu);

// nav state, progress line and the phone booking bar
{
  const bar = $('.bookbar'), progress = $('.nav__progress');
  let last = 0, covered = false;
  const covering = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? covering.add(e.target) : covering.delete(e.target)));
    covered = covering.size > 0; update();
  }, { rootMargin: '-10% 0px -10% 0px' });
  io.observe($('#ask')); io.observe($('.footer'));
  function update() {
    const y = window.scrollY, vh = window.innerHeight;
    nav.classList.toggle('is-solid', y > vh * .5);
    if (menu.hidden) nav.classList.toggle('is-hidden', y > vh && y > last + 2 ? true : y < last - 2 ? false : nav.classList.contains('is-hidden'));
    const max = document.documentElement.scrollHeight - vh;
    progress.style.transform = `scaleX(${max > 0 ? clamp(y / max) : 0})`;
    bar.classList.toggle('is-on', y > vh * .7 && !covered);
    last = y;
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ── the lookbook filter: works without GSAP too (Flip only animates the reflow) ── */
const grid = $('[data-work]');
const tiles = $$('.tile', grid);
{
  const chips = $$('.chip[data-filter]');
  const status = $('[data-work-status]');
  const has = (t, tag) => !tag || t.dataset.tags.split(' ').includes(tag);
  chips.forEach((c) => { $('[data-count]', c).textContent = tiles.filter((t) => has(t, c.dataset.filter)).length; });

  let current = '', running = null;
  function apply(tag) {
    const shown = tiles.filter((t) => has(t, tag));
    tiles.forEach((t) => t.classList.toggle('is-hidden', !shown.includes(t)));
    const label = chips.find((c) => c.dataset.filter === tag).firstChild.textContent.trim().toLowerCase();
    status.textContent = tag ? `Showing ${shown.length} pieces: ${label}.` : `Showing all ${shown.length} pieces.`;
  }

  // the pieces that go fold away first, the rest slide into their new places, the newcomers settle in;
  // the grid's height follows, so the section below never jumps
  function filter(tag) {
    if (tag === current) return;
    current = tag;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === tag)));
    if (!(motion && Flip)) return apply(tag);

    running?.progress(1);
    const leaving = tiles.filter((t) => !t.classList.contains('is-hidden') && !has(t, tag));
    running = gsap.timeline();
    running.to(leaving, { opacity: 0, scale: .94, duration: leaving.length ? .28 : 0, ease: 'power1.in', stagger: .02 })
      .add(() => {
        const h0 = grid.offsetHeight;
        const state = Flip.getState(tiles);
        apply(tag);
        gsap.set(leaving, { clearProps: 'opacity,scale,transform' });
        const h1 = grid.offsetHeight;
        gsap.fromTo(grid, { height: h0 }, { height: h1, duration: .8, ease: 'power3.inOut', clearProps: 'height' });
        Flip.from(state, {
          duration: .8, ease: 'power3.inOut', stagger: .03, scale: true,
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: .94 }, { opacity: 1, scale: 1, duration: .7, ease: 'power2.out', delay: .25, stagger: .04 }),
        });
      });
  }
  chips.forEach((c) => c.addEventListener('click', () => filter(c.dataset.filter)));
}

/* ── the viewer: a tile opens into it, and flies back when it closes ── */
const viewer = (() => {
  const dlg = $('[data-viewer]');
  if (!dlg || typeof dlg.showModal !== 'function') return null;
  const stage = $('[data-viewer-stage]', dlg), glass = $('[data-viewer-glass]', dlg);
  const text = $('[data-viewer-text]', dlg);
  const out = Object.fromEntries(['index', 'total', 'name', 'ask', 'service', 'mins', 'price', 'barber', 'book'].map((k) => [k, $(`[data-viewer-${k}]`, dlg)]));
  let list = [], at = 0, opener = null, busy = false;

  const visible = () => tiles.filter((t) => !t.classList.contains('is-hidden'));
  const big = (tile) => { const img = $('img', tile); return { src: tile.querySelector('a').getAttribute('href'), alt: img.alt, pos: img.style.objectPosition, ratio: img.width / img.height }; };

  // the glass is sized to the photograph, as large as the stage allows
  function fitGlass(ratio) {
    const r = stage.getBoundingClientRect();
    let w = r.width, h = w / ratio;
    if (h > r.height) { h = r.height; w = h * ratio; }
    return { w: Math.round(w), h: Math.round(h) };
  }
  function sizeGlass(ratio) { const { w, h } = fitGlass(ratio); glass.style.width = `${w}px`; glass.style.height = `${h}px`; }

  function makeImg(tile) {
    const b = big(tile), img = new Image();
    img.src = b.src; img.alt = b.alt; img.style.objectPosition = b.pos; img.decoding = 'async';
    if ($('img', tile).classList.contains('is-stand')) img.classList.add('is-stand');
    return img;
  }

  function fill(tile) {
    const svc = SERVICES.find((s) => s.id === tile.dataset.service);
    out.index.textContent = pad(at + 1);
    out.total.textContent = pad(list.length);
    out.name.textContent = tile.dataset.name;
    out.ask.textContent = tile.dataset.ask;
    out.service.textContent = svc?.name ?? '';
    out.mins.textContent = svc ? `${svc.mins} minutes` : '';
    out.price.textContent = svc ? `£${svc.price}` : '';
    out.barber.textContent = tile.dataset.barber;
    const q = new URLSearchParams({ service: tile.dataset.service, barber: tile.dataset.barber.toLowerCase() });
    out.book.href = `services.html?${q}#book`;
    $('span', out.book).textContent = /beard|razor/i.test(tile.dataset.name) ? 'Book this beard' : 'Book this cut';
  }

  function open(tile) {
    if (busy) return;
    list = visible(); at = Math.max(0, list.indexOf(tile)); opener = $('a', tile);
    fill(tile);
    glass.replaceChildren(makeImg(tile));
    frame(glass);
    dlg.showModal();
    root.classList.add('viewer-open'); lenis?.stop();
    sizeGlass(big(tile).ratio);
    if (!motion) return;

    busy = true;
    const from = $('.gframe__glass', tile).getBoundingClientRect(), to = glass.getBoundingClientRect();
    const flyer = glass.cloneNode(true);
    flyer.classList.add('flyer');
    Object.assign(flyer.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    dlg.appendChild(flyer);
    gsap.set(glass, { opacity: 0 });
    gsap.set($('.gframe__glass', tile), { opacity: 0 });
    const tl = gsap.timeline({
      onComplete: () => { gsap.set(glass, { opacity: 1 }); flyer.remove(); gsap.set($('.gframe__glass', tile), { opacity: 1 }); busy = false; },
    });
    tl.fromTo(dlg, { backgroundColor: 'rgba(10,16,15,0)' }, { backgroundColor: 'rgba(10,16,15,.97)', duration: .5, ease: 'power1.out' }, 0)
      .to(flyer, { left: to.left, top: to.top, width: to.width, height: to.height, duration: .9, ease: 'expo.inOut' }, 0)
      .from($$('.viewer__count, .viewer__name, .viewer__ask, .viewer__facts, .viewer__book, .viewer__nav, .viewer__close', dlg), { opacity: 0, y: 22, duration: .8, ease: 'expo.out', stagger: .05 }, .45);
  }

  function close() {
    if (!dlg.open || busy) return;
    const tile = list[at];
    const back = () => { dlg.close(); root.classList.remove('viewer-open'); lenis?.start(); ($('a', tile) ?? opener)?.focus({ preventScroll: true }); };
    if (!motion) return back();

    const target = $('.gframe__glass', tile).getBoundingClientRect();
    const onScreen = target.bottom > 0 && target.top < innerHeight;
    busy = true;
    const from = glass.getBoundingClientRect();
    const flyer = glass.cloneNode(true);
    flyer.classList.add('flyer');
    Object.assign(flyer.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    dlg.appendChild(flyer);
    gsap.set(glass, { opacity: 0 });
    if (onScreen) gsap.set($('.gframe__glass', tile), { opacity: 0 });
    const done = () => { flyer.remove(); gsap.set([glass, $('.gframe__glass', tile)], { opacity: 1 }); gsap.set($$('.viewer__panel *, .viewer__close', dlg), { clearProps: 'opacity,transform' }); busy = false; back(); };
    gsap.timeline({ onComplete: done })
      .to($$('.viewer__panel > *, .viewer__close', dlg), { opacity: 0, y: 12, duration: .3, ease: 'power1.in' }, 0)
      .to(dlg, { backgroundColor: 'rgba(10,16,15,0)', duration: .6, ease: 'power1.inOut' }, .1)
      .to(flyer, onScreen
        ? { left: target.left, top: target.top, width: target.width, height: target.height, duration: .8, ease: 'expo.inOut' }
        : { opacity: 0, scale: .96, duration: .5, ease: 'power2.in' }, 0);
  }

  // next and previous: the new photograph is drawn across the glass from the side it comes from
  function step(dir) {
    if (busy || list.length < 2) return;
    at = (at + dir + list.length) % list.length;
    const tile = list[at];
    fill(tile);
    const img = makeImg(tile);
    const ratio = big(tile).ratio;
    if (!motion) { glass.replaceChildren(img); frame(glass); sizeGlass(ratio); return; }

    busy = true;
    const { w, h } = fitGlass(ratio);
    const old = glass.querySelector(':scope > img');
    glass.appendChild(img);
    const tl = gsap.timeline({ onComplete: () => { old?.remove(); gsap.set(img, { clearProps: 'clipPath,scale' }); busy = false; } });
    tl.to(glass, { width: w, height: h, duration: .9, ease: 'expo.inOut' }, 0)
      .fromTo(img, { clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)', scale: 1.08 },
        { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: .95, ease: 'expo.inOut' }, 0)
      .to(old, { scale: .96, xPercent: -6 * dir, duration: .95, ease: 'expo.inOut' }, 0)
      .fromTo($$('.viewer__name, .viewer__ask, .viewer__facts', dlg), { opacity: 0, y: 16 * dir }, { opacity: 1, y: 0, duration: .7, ease: 'expo.out', stagger: .05 }, .25);
  }

  // open from a tile (the link stays a real link to the file without JavaScript)
  grid.addEventListener('click', (e) => {
    const a = e.target.closest('.tile__link');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    open(a.closest('.tile'));
  });
  $('[data-viewer-close]', dlg).addEventListener('click', close);
  $('[data-viewer-prev]', dlg).addEventListener('click', () => step(-1));
  $('[data-viewer-next]', dlg).addEventListener('click', () => step(1));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  // a swipe across the photograph on touch screens
  let sx = null;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
  stage.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1); });
  window.addEventListener('resize', () => { if (dlg.open && !busy) sizeGlass(big(list[at]).ratio); });
  return { open, close };
})();

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
  headings();
  footer();

  ScrollTrigger.refresh();
  window.addEventListener('load', () => ScrollTrigger.refresh());
  landOnHash((el) => scrollToEl(el, { immediate: true }));
}

/* ── hero: the headline sets letter by letter, the two mirrors uncover, once ── */
function intro() {
  const title = splitLines(SplitText, '.ghero__title', { type: 'lines,chars', mask: 'lines' });
  const gilt = title.chars.filter((c) => c.closest('em'));
  const plain = title.chars.filter((c) => !c.closest('em'));
  const frames = $$('.ghero__wall .gframe__glass'), imgs = $$('.ghero__wall img');
  const r = getComputedStyle(frames[0]).borderTopLeftRadius;
  const facts = $('.ghero__facts');

  const tl = gsap.timeline({ onComplete: () => title.revert() });
  tl.fromTo(nav, { yPercent: -100 }, { yPercent: 0, duration: 1, clearProps: 'transform' }, 0)
    .from(plain, { yPercent: 112, duration: 1.1, stagger: .018 }, .1)
    .from(gilt, { yPercent: 112, rotate: 6, transformOrigin: '0% 100%', duration: 1.3, stagger: .03 }, .4)
    .from('.ghero__lede', { opacity: 0, y: 18, duration: 1 }, .55)
    .fromTo('.ghero__actions > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .9, stagger: .07 }, .65)
    // the wide mirror opens from the middle like a door pulled back, the tall one from the floor
    .fromTo(frames[0], { clipPath: `inset(0% 50% 0% 50% round ${r})` }, { clipPath: `inset(0% 0% 0% 0% round ${r})`, duration: 1.6, ease: 'expo.inOut', clearProps: 'clipPath' }, .3)
    .fromTo(frames[1], { clipPath: `inset(100% 0% 0% 0% round ${r})` }, { clipPath: `inset(0% 0% 0% 0% round ${r})`, duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, .5)
    .fromTo(imgs, { scale: 1.2 }, { scale: 1, duration: 2, ease: 'expo.out', stagger: .15, clearProps: 'transform,scale' }, .5)
    .fromTo(facts, { '--rule': 0 }, { '--rule': 1, duration: 1.6, ease: 'power3.inOut' }, 1)
    .from($$('li', facts), { opacity: 0, y: 12, duration: .9, stagger: .12 }, 1.35);
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
    const link = !lab && e.target.closest('a, button:not(:disabled)');
    el.classList.toggle('is-label', !!lab);
    el.classList.toggle('is-link', !!link);
    if (lab) label.textContent = lab.dataset.cursor;
  });
  document.addEventListener('pointerleave', () => gsap.to(el, { opacity: 0, duration: .2 }));
  document.addEventListener('pointerenter', () => shown && gsap.to(el, { opacity: 1, duration: .2 }));
  // the viewer sits in the top layer, above the follower: hide the follower while it is open
  new MutationObserver(() => el.style.visibility = root.classList.contains('viewer-open') ? 'hidden' : '').observe(root, { attributes: true, attributeFilter: ['class'] });
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
