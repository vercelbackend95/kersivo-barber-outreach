// The barbers page (team.html): Lenis + GSAP (ScrollTrigger, SplitText, Flip) and the three.js portrait stage.
// Progressive like the home page: without GSAP, WebGL or with reduced motion every barber is listed in
// full and every "Book with …" button still works.

import { frameAll } from './brass-frame.js';
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

// the brass mirror frame on the four on the wall, the stage and the sorting grid
frameAll('.thero__wall .arch__frame, .roster__stage, .mgrid .mcard__frame');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const nav = $('[data-nav]');
let lenis = null;
let roster = null;                 // set when the pinned stage runs: { goTo(i) }

/* ───────────────────────── basics (work without any library) ───────────────────────── */

function scrollToEl(el, { offset = 0, immediate = false } = {}) {
  if (!el) return;
  // "#top" is the page itself, not the hero: the hero can be fixed or sticky, so measuring it would land where we already are
  if (el.id === 'top') el = 0;
  if (lenis) { lenis.resize(); lenis.scrollTo(el, { offset, immediate, force: immediate, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) }); }
  else if (el === 0) window.scrollTo({ top: 0, behavior: reduce || immediate ? 'instant' : 'smooth' });
  else el.scrollIntoView({ behavior: reduce || immediate ? 'instant' : 'smooth', block: 'start' });
}

// in-page links
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href*="#"]');
  const id = samePageHash(a);
  const target = id && document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  closeMenu();
  // a portrait in the hero lands straight on that barber, without passing the ones before
  if (a.dataset.gotoBarber && roster) roster.jump(+a.dataset.gotoBarber);
  else scrollToEl(target, { immediate: !!a.dataset.gotoBarber });
  history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`);
});

// index buttons inside the stage
$$('.idx[data-goto-barber]').forEach((b) => b.addEventListener('click', () => {
  const i = +b.dataset.gotoBarber;
  if (roster) roster.wipeTo(i); else scrollToEl($$('.bcard')[i]);
}));

// "Book with …": preselect the barber in the booking form, then go there
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-book-barber]');
  if (!b) return;
  document.dispatchEvent(new CustomEvent('booking:barber', { detail: { id: b.dataset.bookBarber } }));
  scrollToEl($('#book'));
  // after the scroll lands, focus the chosen barber so keyboard users continue from there
  setTimeout(() => $(`[data-barbers] input[value="${b.dataset.bookBarber}"]`)?.focus({ preventScroll: true }), lenis ? 1450 : 600);
});

// the chosen barber tile answers once, so the hand-off is visible
document.addEventListener('booking:barber-changed', (e) => {
  const tile = $(`[data-barbers] input[value="${e.detail.id}"]`)?.closest('.pick');
  if (!tile || reduce) return;
  tile.classList.remove('is-flash'); void tile.offsetWidth; tile.classList.add('is-flash');
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

/* ── specialty sort: works without GSAP too (Flip only animates the reorder) ── */
{
  const grid = $('[data-mgrid]'), status = $('[data-match-status]');
  const chips = $$('.chip');
  const cards = $$('.mcard', grid);
  const label = Object.fromEntries(chips.map((c) => [c.dataset.tag, c.textContent.trim()]));
  const list = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]);

  function sort(tag) {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.tag === tag)));
    const state = motion && Flip ? Flip.getState(cards) : null;
    const yes = cards.filter((c) => !tag || c.dataset.tags.split(' ').includes(tag));
    const no = cards.filter((c) => !yes.includes(c));
    [...yes, ...no].forEach((c) => grid.appendChild(c));
    cards.forEach((c) => c.classList.toggle('is-out', !yes.includes(c)));
    status.textContent = !tag
      ? 'All four barbers do every service on the price list.'
      : `${list(yes.map((c) => $('.mcard__name', c).textContent.split(' ')[0]))} ${yes.length === 1 ? 'is the one' : 'are the ones'} to ask for ${label[tag].toLowerCase()}.`;
    if (state) Flip.from(state, { duration: .7, ease: 'power3.inOut', stagger: .03 });
  }
  chips.forEach((c) => c.addEventListener('click', () => sort(c.dataset.tag)));
}

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
  stage();
  headings();
  footer();

  ScrollTrigger.refresh();
  window.addEventListener('load', () => ScrollTrigger.refresh());

  // arriving with #barber-kit (or any barber) in the URL lands on that barber
  const hash = location.hash.slice(1);
  const at = $$('.bcard').findIndex((c) => c.id === hash);
  // (after the load event: the browser's own jump to the #anchor, and the refresh above, come first)
  if (at > -1) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const go = () => (roster ? roster.jump(at) : scrollToEl($(`#${hash}`), { immediate: true }));
    // land once the page settles, and once more after late layout (lazy images, the load refresh)
    const land = () => { requestAnimationFrame(go); setTimeout(() => { ScrollTrigger.refresh(); go(); }, 350); };
    if (document.readyState === 'complete') land(); else window.addEventListener('load', land, { once: true });
  } else landOnHash((el) => scrollToEl(el, { immediate: true }));
}

/* ── hero: the headline sets letter by letter, the four mirrors uncover from the floor up, once ── */
function intro() {
  const title = splitLines(SplitText, '.thero__title', { type: 'lines,chars', mask: 'lines' });
  const gilt = title.chars.filter((c) => c.closest('em'));
  const plain = title.chars.filter((c) => !c.closest('em'));
  const frames = $$('.arch__frame'), imgs = $$('.arch__frame img'), names = $$('.arch__name');
  const r = getComputedStyle(frames[0]).borderTopLeftRadius;          // the mirror's own corner
  const facts = $('.thero__facts');

  const tl = gsap.timeline({ onComplete: () => title.revert() });
  tl.fromTo(nav, { yPercent: -100 }, { yPercent: 0, duration: 1, clearProps: 'transform' }, 0)
    .from(plain, { yPercent: 112, duration: 1.1, stagger: .02 }, .1)
    .from(gilt, { yPercent: 112, rotate: 6, transformOrigin: '0% 100%', duration: 1.3, stagger: .035 }, .45)
    .from('.thero__lede', { opacity: 0, y: 18, duration: 1 }, .55)
    .fromTo('.thero__actions > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .9, stagger: .07 }, .65)
    // each mirror opens from the bottom, the portrait settling inside it, left to right
    .fromTo(frames, { clipPath: `inset(100% 0% 0% 0% round ${r})` }, { clipPath: `inset(0% 0% 0% 0% round ${r})`, duration: 1.5, ease: 'expo.inOut', stagger: .11, clearProps: 'clipPath' }, .35)
    .fromTo(imgs, { scale: 1.18, yPercent: 6 }, { scale: 1, yPercent: 0, duration: 1.9, ease: 'expo.out', stagger: .11, clearProps: 'transform,scale' }, .55)
    .from(names, { opacity: 0, y: 10, duration: .8, stagger: .11 }, 1.2)
    .fromTo(facts, { '--rule': 0 }, { '--rule': 1, duration: 1.6, ease: 'power3.inOut' }, 1)
    .from($$('li', facts), { opacity: 0, y: 12, duration: .9, stagger: .12 }, 1.35);
}

/* ── the four barbers: one pinned mirror, four portraits, four texts ── */
function stage() {
  const section = $('.roster');
  const cards = $$('.bcard', section);
  const idx = $$('.idx', section);
  const num = $('.roster__count b', section), bar = $('.roster__count u', section);
  const stageEl = $('.roster__stage', section), canvas = $('.roster__gl', section);
  const imgs = cards.map((c) => $('.bcard__photo img', c));
  const N = cards.length;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (min-height: 640px)', () => {
    section.classList.add('roster--pinned');

    // still pictures in the stage until (or unless) WebGL takes over
    const stills = imgs.map((img) => { const c = img.cloneNode(); c.loading = 'eager'; c.alt = ''; stageEl.appendChild(c); return c; });

    const state = { p: 0 };
    let active = -1, scene = null, inView = false, busy = null;   // busy: a direct wipe from the name list is running

    // the stage gets its own copies at one fixed size: a DOM <img> with srcset can swap its file
    // after upload, which would leave the texture the wrong size
    const sources = imgs.map((img) => { const i = new Image(); i.src = img.getAttribute('src'); i.dataset.focus = img.dataset.focus; return i; });
    Promise.all(sources.map((i) => i.decode()))
      .then(() => import('./gl.js'))
      .then((GL) => {
        scene = GL.createPortraits(canvas, sources);
        section.classList.add('is-gl');
        scene.set(state.p); scene.render();
      })
      .catch((err) => { scene = null; console.info('WebGL layer off, portraits stay as images.', err); });

    function show(to) {
      if (to === active) return;
      const dir = to > active ? 1 : -1;
      cards.forEach((c, i) => {
        if (i === to) return;
        c.classList.remove('is-active');
        gsap.to(c, { autoAlpha: 0, duration: .22, ease: 'power1.out', overwrite: true });
      });
      const el = cards[to];
      el.classList.add('is-active');
      gsap.killTweensOf(el);
      gsap.set(el, { autoAlpha: 1 });
      const parts = [$('.bcard__role', el), $('.bcard__bio', el), $('.tags', el), $('.bcard__facts', el), $('.bcard__actions', el)];
      gsap.fromTo($('.bcard__name', el), { yPercent: 50 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .95, delay: .08, overwrite: true });
      gsap.fromTo(parts, { y: 18 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: .8, delay: .14, stagger: .045, overwrite: true });
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

    // each barber holds for a beat, then the next one wipes in
    const hold = .7, move = 1;
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut', duration: move },
      scrollTrigger: {
        trigger: section, start: 'top top', end: () => `+=${window.innerHeight * (N - .2)}`,
        pin: '.roster__pin', scrub: .7, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; },
      },
      onUpdate: apply,
    });
    tl.to({}, { duration: hold * .5 });
    for (let i = 1; i < N; i++) tl.to(state, { p: i }).to({}, { duration: hold });
    const total = tl.duration();
    // where in the scroll each barber rests (the middle of its hold)
    const restAt = (i) => (i === 0 ? hold * .25 : hold * .5 + i * move + (i - 1) * hold + hold * .5) / total;

    const restY = (i) => { const st = tl.scrollTrigger; return st.start + (st.end - st.start) * restAt(i); };

    // put the page on barber i at once: no smooth scroll, and the scrub catches up in the same frame
    function settle(i) {
      const y = restY(i);
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
      ScrollTrigger.update();
      tl.scrollTrigger.getTween()?.progress(1);
      tl.progress(restAt(i));
      apply();
    }

    roster = {
      // from outside the section (the hero, a link with #barber-...): land on barber i, nothing in between
      jump(i) {
        busy?.progress(1);
        settle(i);
        gsap.fromTo(stageEl, { opacity: 0, scale: .985 }, { opacity: 1, scale: 1, duration: .7, ease: 'power2.out', overwrite: true, clearProps: 'transform,opacity' });
      },
      // from the name list inside the stage: one wipe straight from the current barber to barber i
      wipeTo(i) {
        busy?.progress(1);
        const from = Math.round(state.p);
        if (from === i) return;
        const o = { t: 0 };
        show(i);
        busy = gsap.to(o, {
          t: 1, duration: .95, ease: 'power2.inOut',
          onUpdate: () => {
            if (scene) scene.pair(from, i, o.t);
            else stills.forEach((s, k) => { s.style.opacity = k === i ? o.t : k === from ? 1 - o.t : 0; });
          },
          onComplete: () => { busy = null; settle(i); },
        });
      },
    };

    // the stage and the first text arrive with the section, once
    gsap.from(stageEl, { yPercent: 8, scale: .95, opacity: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 15%', scrub: true } });

    ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onToggle: (self) => { inView = self.isActive; } });
    const tick = () => { if (scene && inView && !document.hidden) scene.render(); };
    gsap.ticker.add(tick);
    show(0);

    return () => {
      gsap.ticker.remove(tick);
      section.classList.remove('roster--pinned', 'is-gl');
      stills.forEach((s) => s.remove());
      cards.forEach((c) => { c.classList.remove('is-active'); gsap.set(c, { clearProps: 'all' }); $$('*', c).forEach((n) => gsap.set(n, { clearProps: 'transform,opacity' })); });
      roster = null;
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
