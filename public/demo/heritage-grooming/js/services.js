// Services and prices (services.html): Lenis + GSAP (ScrollTrigger, SplitText) and the three.js razor mirror.
// Progressive like the other pages: without GSAP, WebGL or with reduced motion every chapter is listed in
// full with its photograph, and every "Book" still works.


import { frameAll } from './brass-frame.js';
import { mountStatus, fitSign, footerMotion, splitLines, fontsReady, samePageHash, landOnHash } from './house.js';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('static');
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const { gsap, ScrollTrigger, SplitText, Lenis } = window;
const motion = !!(gsap && ScrollTrigger && SplitText) && !reduce;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// open now or not, and the footer's fascia fitted edge to edge (house.js)
mountStatus();
fitSign(document.querySelector('.footer__sign'));

// the brass mirror frame on the price list's stage
frameAll('.prices__stage');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const nav = $('[data-nav]');
let lenis = null;
let stageApi = null;               // set when the pinned price list runs: { jump(i), wipeTo(i) }

/* ───────────────────────── basics (work without any library) ───────────────────────── */

function scrollToEl(el, { offset = 0, immediate = false } = {}) {
  if (!el) return;
  // "#top" is the page itself, not the hero: the hero can be fixed or sticky, so measuring it would land where we already are
  if (el.id === 'top') el = 0;
  if (lenis) { lenis.resize(); lenis.scrollTo(el, { offset, immediate, force: immediate, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) }); }
  else if (el === 0) window.scrollTo({ top: 0, behavior: reduce || immediate ? 'instant' : 'smooth' });
  else el.scrollIntoView({ behavior: reduce || immediate ? 'instant' : 'smooth', block: 'start' });
}

// in-page links; a chapter on the hero board lands straight on that chapter of the price list
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href*="#"]');
  const id = samePageHash(a);
  const target = id && document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  closeMenu();
  if (a.dataset.gotoChap && stageApi) stageApi.jump(+a.dataset.gotoChap);
  else scrollToEl(target);
  history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`);
});

// the chapter names above the mirror
$$('.pidx[data-goto-chap]').forEach((b) => b.addEventListener('click', () => {
  const i = +b.dataset.gotoChap;
  if (stageApi) stageApi.wipeTo(i); else scrollToEl($$('.chap')[i]);
}));

// a row of the price list: that service, straight to the times
function bookService(id) {
  document.dispatchEvent(new CustomEvent('booking:select', { detail: { id } }));
  scrollToEl($('#book'));
  flashChoice(id);
}
function flashChoice(id) {
  if (reduce) return;
  const tile = $(`[data-services] input[value="${id}"]`)?.closest('.choice');
  if (!tile) return;
  tile.classList.remove('is-flash'); void tile.offsetWidth; tile.classList.add('is-flash');
}
document.addEventListener('click', (e) => {
  const row = e.target.closest('[data-book]');
  if (row) bookService(row.dataset.book);
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
  io.observe($('#book')); io.observe($('.footer'));
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

/* ───────────────────────── motion ───────────────────────── */

if (motion) run();

async function run() {
  gsap.registerPlugin(ScrollTrigger, SplitText);
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
  stage();
  headings();
  footer();

  ScrollTrigger.refresh();
  window.addEventListener('load', () => ScrollTrigger.refresh());

  // arriving with #ch-shaves (or any chapter) lands on that chapter
  const hash = location.hash.slice(1);
  const at = $$('.chap').findIndex((c) => c.id === hash);
  if (at > -1) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const go = () => (stageApi ? stageApi.jump(at) : scrollToEl($(`#${hash}`), { immediate: true }));
    const land = () => { requestAnimationFrame(go); setTimeout(() => { ScrollTrigger.refresh(); go(); }, 350); };
    if (document.readyState === 'complete') land(); else window.addEventListener('load', land, { once: true });
  } else landOnHash((el) => scrollToEl(el, { immediate: true }));
}

/* ── hero: the headline sets letter by letter, the board's brass inlays draw and its prices count up, once ── */
function intro() {
  const title = splitLines(SplitText, '.shero__title', { type: 'lines,chars', mask: 'lines' });
  const gilt = title.chars.filter((c) => c.closest('em'));
  const plain = title.chars.filter((c) => !c.closest('em'));
  const items = $$('.board__item');
  const counts = $$('.board__from i[data-count]');

  const tl = gsap.timeline({ onComplete: () => title.revert() });
  tl.fromTo(nav, { yPercent: -100 }, { yPercent: 0, duration: 1, clearProps: 'transform' }, 0)
    .from(plain, { yPercent: 112, duration: 1.1, stagger: .018 }, .1)
    .from(gilt, { yPercent: 112, rotate: 6, transformOrigin: '0% 100%', duration: 1.3, stagger: .03 }, .5)
    .from('.shero__lede', { opacity: 0, y: 18, duration: 1 }, .6)
    .fromTo('.shero__actions > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .9, stagger: .07 }, .7)
    .fromTo(items, { '--rule': 0 }, { '--rule': 1, duration: 1.4, ease: 'power3.inOut', stagger: .09 }, .55)
    .from(items.map((i) => [...i.children]), { opacity: 0, y: 16, duration: 1, stagger: .03 }, .8);
  counts.forEach((el, i) => {
    const o = { v: 0 }, to = +el.dataset.count;
    tl.to(o, { v: to, duration: 1.3, ease: 'power3.out', onUpdate: () => { el.textContent = `£${Math.round(o.v)}`; } }, .95 + i * .09);
  });
}

/* ── the price list: one pinned mirror, five chapters, each taken in with one razor stroke ── */
function stage() {
  const section = $('.prices');
  const chaps = $$('.chap', section);
  const idx = $$('.pidx', section);
  const num = $('.prices__count b', section), bar = $('.prices__count u', section);
  const stageEl = $('.prices__stage', section), canvas = $('.prices__gl', section);
  const imgs = chaps.map((c) => $('.chap__photo img', c));
  const N = chaps.length;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (min-height: 700px)', () => {
    section.classList.add('prices--pinned');

    // still pictures in the stage until (or unless) WebGL takes over
    const stills = imgs.map((img) => { const c = img.cloneNode(); c.loading = 'eager'; c.alt = ''; c.removeAttribute('srcset'); stageEl.prepend(c); return c; });
    stills.forEach((s, i) => { s.style.opacity = i === 0 ? 1 : 0; s.style.objectPosition = focusPos(imgs[i]); });

    const state = { p: 0 };
    let active = -1, scene = null, inView = false, busy = null;

    // the stage gets its own copies at one fixed size (a srcset could swap the file after upload)
    const sources = imgs.map((img) => { const i = new Image(); i.src = img.getAttribute('src'); i.dataset.focus = img.dataset.focus; return i; });
    Promise.all(sources.map((i) => i.decode()))
      .then(() => import('./gl.js'))
      .then((GL) => {
        scene = GL.createRazor(canvas, sources);
        section.classList.add('is-gl');
        scene.set(state.p); scene.render();
      })
      .catch((err) => { scene = null; console.info('WebGL layer off, the photographs stay as images.', err); });

    function show(to) {
      if (to === active) return;
      const dir = to > active ? 1 : -1;
      chaps.forEach((c, i) => {
        if (i === to) return;
        c.classList.remove('is-active');
        gsap.to(c, { autoAlpha: 0, duration: .22, ease: 'power1.out', overwrite: true });
      });
      const el = chaps[to];
      el.classList.add('is-active');
      gsap.killTweensOf(el);
      gsap.set(el, { autoAlpha: 1 });
      const rows = $$('.row', el), times = $$('.row__time', el);
      gsap.fromTo($('.chap__name', el), { yPercent: 50 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .95, delay: .06, overwrite: true });
      gsap.fromTo([$('.chap__no', el), $('.chap__intro', el)], { y: 14 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: .8, delay: .1, stagger: .05, overwrite: true });
      gsap.fromTo(rows, { y: 18 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: .8, delay: .16, stagger: .05, overwrite: true });
      // each time bar draws to its length, after its row has landed
      times.forEach((t, i) => {
        const m = parseFloat($('i', t).style.getPropertyValue('--m')) || 0;
        t.classList.add('is-drawing');
        gsap.fromTo(t, { '--draw': 0 }, { '--draw': m, duration: 1.1, ease: 'power3.inOut', delay: .3 + i * .06, overwrite: true });
      });
      idx.forEach((b, i) => { b.classList.toggle('is-on', i === to); if (i === to) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      num.textContent = `0${to + 1}`;
      active = to;
    }

    function apply() {
      if (busy) return;
      if (scene) scene.set(state.p);
      else stills.forEach((s, i) => { s.style.opacity = clamp(1 - Math.abs(state.p - i)); });
      show(Math.round(state.p));
    }

    // each chapter holds for a beat (time to read the prices), then the next stroke comes
    const hold = 1, move = .9;
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut', duration: move },
      scrollTrigger: {
        trigger: section, start: 'top top', end: () => `+=${window.innerHeight * (N - .2)}`,
        pin: '.prices__pin', scrub: .7, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; },
      },
      onUpdate: apply,
    });
    tl.to({}, { duration: hold * .5 });
    for (let i = 1; i < N; i++) tl.to(state, { p: i }).to({}, { duration: hold });
    const total = tl.duration();
    const restAt = (i) => (i === 0 ? hold * .25 : hold * .5 + i * move + (i - 1) * hold + hold * .5) / total;
    const restY = (i) => { const st = tl.scrollTrigger; return st.start + (st.end - st.start) * restAt(i); };

    function settle(i) {
      const y = restY(i);
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
      ScrollTrigger.update();
      tl.scrollTrigger.getTween()?.progress(1);
      tl.progress(restAt(i));
      apply();
    }

    stageApi = {
      // from outside the section (the hero board, a #ch- link): land on chapter i, nothing in between
      jump(i) {
        busy?.progress(1);
        settle(i);
        gsap.fromTo(stageEl, { opacity: 0, scale: .985 }, { opacity: 1, scale: 1, duration: .7, ease: 'power2.out', overwrite: true, clearProps: 'transform,opacity' });
      },
      // from the chapter names: one stroke straight from the current chapter to chapter i
      wipeTo(i) {
        busy?.progress(1);
        const from = Math.round(state.p);
        if (from === i) return;
        const o = { t: 0 };
        show(i);
        busy = gsap.to(o, {
          t: 1, duration: 1, ease: 'power2.inOut',
          onUpdate: () => {
            if (scene) scene.pair(from, i, o.t);
            else stills.forEach((s, k) => { s.style.opacity = k === i ? o.t : k === from ? 1 - o.t : 0; });
          },
          onComplete: () => { busy = null; settle(i); },
        });
      },
    };

    // the mirror arrives with the section, once
    gsap.from(stageEl, { yPercent: 6, scale: .96, opacity: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 20%', scrub: true } });

    ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onToggle: (self) => { inView = self.isActive; } });
    const tick = () => { if (scene && inView && !document.hidden) scene.render(); };
    gsap.ticker.add(tick);
    show(0);

    return () => {
      gsap.ticker.remove(tick);
      section.classList.remove('prices--pinned', 'is-gl');
      stills.forEach((s) => s.remove());
      chaps.forEach((c) => {
        c.classList.remove('is-active'); gsap.set(c, { clearProps: 'all' });
        $$('*', c).forEach((n) => gsap.set(n, { clearProps: 'transform,opacity' }));
        $$('.row__time', c).forEach((t) => { t.classList.remove('is-drawing'); t.style.removeProperty('--draw'); });
      });
      stageApi = null;
    };
  });
}
const focusPos = (img) => { const [x = .5, y = .5] = (img.dataset.focus || '').split(' ').map(Number); return `${x * 100}% ${y * 100}%`; };

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
    const link = !lab && e.target.closest('a, button:not(:disabled), .choice, .pick');
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
