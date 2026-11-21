// Page motion: Lenis smooth scroll, GSAP + ScrollTrigger + SplitText, and the three.js layer (gl.js).
// Everything here is progressive: without GSAP, WebGL or with reduced motion the page is complete and static.

import { frameAll } from './brass-frame.js';
import { mountStatus, fitSign, footerMotion, splitLines, fontsReady, samePageHash, landOnHash } from './house.js';

const root = document.documentElement;
// add ?static to the URL to preview the reduced-motion version
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('static');
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const { gsap, ScrollTrigger, SplitText, Lenis } = window;
const motion = !!(gsap && ScrollTrigger && SplitText) && !reduce;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// the brass mirror frame on the review photographs and the stage's mirror
frameAll('.review__photo, .reviews__mirror');
// open now or not (the band, the footer), and the footer's fascia fitted edge to edge
mountStatus();
fitSign($('.footer__sign'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const loader = $('.loader');
const nav = $('[data-nav]');
let lenis = null;

/* ───────────────────────── basics (work without any library) ───────────────────────── */

function scrollToEl(el, { immediate = false } = {}) {
  if (!el) return;
  // "#top" is the page itself, not the hero: the hero can be fixed or sticky, so measuring it would land where we already are
  if (el.id === 'top') el = 0;
  if (lenis) { lenis.resize(); lenis.scrollTo(el, { immediate, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) }); }
  else if (el === 0) window.scrollTo({ top: 0, behavior: reduce || immediate ? 'auto' : 'smooth' });
  else el.scrollIntoView({ behavior: reduce || immediate ? 'auto' : 'smooth', block: 'start' });
}

// in-page links
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

// a row of the price list books that service
$$('.svc[data-service]').forEach((row) => row.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent('booking:select', { detail: { id: row.dataset.service } }));
  scrollToEl($('#book'));
}));
// "Book this haircut" on the visit docket: the same, the in-page link handler does the scrolling
$$('[data-book-service]').forEach((a) => a.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent('booking:select', { detail: { id: a.dataset.bookService } }));
}));

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
  const bar = $('.bookbar'), progress = $('.nav__progress'), book = $('#book');
  let last = 0, bookInView = false;
  // the bar steps aside wherever the page already shows its own booking action (the booking section, the footer)
  const covering = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? covering.add(e.target) : covering.delete(e.target)));
    bookInView = covering.size > 0; update();
  }, { rootMargin: '-10% 0px -10% 0px' });
  io.observe(book); io.observe($('.footer'));
  function update() {
    const y = window.scrollY, vh = window.innerHeight;
    nav.classList.toggle('is-solid', y > vh * .6);
    if (menu.hidden) nav.classList.toggle('is-hidden', y > vh && y > last + 2 ? true : y < last - 2 ? false : nav.classList.contains('is-hidden'));
    const max = document.documentElement.scrollHeight - vh;
    progress.style.transform = `scaleX(${max > 0 ? clamp(y / max) : 0})`;
    bar.classList.toggle('is-on', y > vh * .7 && !bookInView);
    last = y;
  }
  window.addEventListener('scroll', update, { passive: true });
  update();

  const links = $$('.nav__link');
  const spy = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) links.forEach((l) => l.classList.toggle('is-here', l.getAttribute('href') === `#${en.target.id}`));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => spy.observe(s));
}

// contact form: checks the fields, then shows a thank-you (preview mode, nothing is sent)
{
  const form = $('[data-contact]');
  if (form) {
    const fields = $('[data-contact-fields]', form), done = $('[data-contact-done]', form);
    const rules = {
      name: (v) => (v.trim() ? '' : 'Please add your name.'),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Please add an email we can reply to.'),
      message: (v) => (v.trim().length >= 5 ? '' : 'Please write a short message.'),
    };
    const check = (name) => {
      const input = form.elements[name], msg = rules[name](input.value);
      const err = $(`[data-error-for="${name}"]`, form);
      err.textContent = msg;
      input.toggleAttribute('aria-invalid', !!msg);
      if (msg) input.setAttribute('aria-invalid', 'true');
      return !msg;
    };
    Object.keys(rules).forEach((n) => form.elements[n].addEventListener('blur', () => form.elements[n].value && check(n)));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = Object.keys(rules).filter((n) => !check(n));
      if (bad.length) { form.elements[bad[0]].focus(); return; }
      const first = form.elements.name.value.trim().split(/\s+/)[0];
      $('[data-contact-title]', form).textContent = `Thank you, ${first}.`;
      fields.hidden = true; done.hidden = false; done.focus();
      if (motion) gsap.from(done.children, { opacity: 0, y: 16, duration: .7, stagger: .06 });
    });
    $('[data-contact-again]', form).addEventListener('click', () => {
      form.reset(); fields.hidden = false; done.hidden = true; form.elements.name.focus();
    });
  }
}

// reviews: previous / next, the counter and "Book … with …" work in every mode.
// In the rail (phones, tablets, reduced motion) they scroll the row of cards; the compact stage
// (reviews() below) swaps in its own go() that changes the review in place.
const reviewsUI = (() => {
  const section = $('.reviews');
  if (!section) return null;
  const list = $('[data-reviews]', section), cards = $$('.review', section);
  const steps = $$('[data-review-step]', section);
  const num = $('[data-review-no]', section), bar = $('.reviews__count u', section);
  const ui = { section, list, cards, num, active: 0, goStage: null };

  ui.setActive = (i) => {
    ui.active = i;
    num.textContent = String(i + 1).padStart(2, '0');
    bar.style.transform = `scaleX(${(i + 1) / cards.length})`;
    steps[0].disabled = i === 0;
    steps[1].disabled = i === cards.length - 1;
  };
  ui.go = (i) => {
    i = Math.max(0, Math.min(cards.length - 1, i));
    if (i === ui.active) return;
    if (ui.goStage) { ui.goStage(i); return; }
    list.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
    ui.setActive(i);
  };

  steps.forEach((b) => b.addEventListener('click', () => ui.go(ui.active + +b.dataset.reviewStep)));

  // the rail tells the counter which card is in front
  let raf = 0;
  list.addEventListener('scroll', () => {
    if (ui.goStage || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (ui.goStage) return;
      const x = list.scrollLeft, w = cards[1].offsetLeft - cards[0].offsetLeft;
      const atEnd = x + list.clientWidth >= list.scrollWidth - 4;
      const i = atEnd ? cards.length - 1 : Math.round(x / w);
      if (i !== ui.active) ui.setActive(i);
    });
  }, { passive: true });

  // "Book a skin fade with Kit": the barber and the service are chosen and the times open
  // (the in-page link handler above does the scrolling)
  $$('[data-book-service]', section).forEach((a) => a.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('booking:barber', { detail: { id: a.dataset.bookBarber || '' } }));
    document.dispatchEvent(new CustomEvent('booking:select', { detail: { id: a.dataset.bookService } }));
  }));

  ui.setActive(0);
  return ui;
})();

/* ───────────────────────── motion ───────────────────────── */

if (!motion) {
  // complete, static page: just lift the curtain
  loader?.remove();
} else {
  run();
}

async function run() {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: 'expo.out', duration: .9 });
  ScrollTrigger.config({ ignoreMobileResize: true });

  if (Lenis) {
    lenis = new Lenis({ lerp: .1, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();                                                  // held until the intro has played
  }
  if (history.scrollRestoration) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ── loader count runs while fonts, the hero photograph and WebGL get ready ── */
  const seen = sessionStorage.getItem('hg-seen');
  const count = { v: 0 }, countEl = $('.loader__count'), rule = $('.loader__rule i');
  gsap.from('.loader__seal', { opacity: 0, scale: .9, rotate: -14, duration: 1.2 });
  gsap.from('.loader__meta', { opacity: 0, duration: .6, delay: .2, ease: 'power1.out' });
  const counting = gsap.to(count, {
    v: 100, duration: seen ? .7 : 1.8, ease: 'power2.inOut',
    onUpdate: () => { countEl.textContent = Math.round(count.v); rule.style.transform = `scaleX(${count.v / 100})`; },
  });

  const heroImg = $('.hero__img');
  let GL = null, hero = null;
  const glReady = (async () => {
    try {
      GL = await import('./gl.js');
      await heroImg.decode();
      hero = GL.createHero($('.hero__gl'), heroImg);
      hero.render();
      $('.hero').classList.add('is-gl');
    } catch (err) { hero = null; console.info('WebGL layer off, photographs stay as images.', err); }
  })();

  await Promise.all([counting.then(), Promise.race([Promise.all([fontsReady(3500), glReady]), wait(3500)])]);
  sessionStorage.setItem('hg-seen', '1');

  intro(hero);
  heroScroll(hero);
  cursor();
  magnetic();
  manifesto();
  band();
  shop(GL);
  services();
  visit();
  reviews(GL);
  parallax();
  headings();
  footer();

  ScrollTrigger.refresh();
  window.addEventListener('load', () => ScrollTrigger.refresh());
  // arriving with #find, #book… from another page: the intro still plays, the page opens where the link pointed
  landOnHash((el) => (lenis ? (lenis.resize(), lenis.scrollTo(el, { immediate: true, force: true })) : el.scrollIntoView({ block: 'start' })));
}

/* ── intro: the seal steps back, the room develops, the headline rises ── */
function intro(hero) {
  const title = splitLines(SplitText, '.hero__title', { type: 'lines,chars', mask: 'lines' });
  const gilt = title.chars.filter((c) => c.closest('em'));
  const plain = title.chars.filter((c) => !c.closest('em'));
  const facts = $('.hero__facts');
  const tl = gsap.timeline({ onComplete: () => { title.revert(); sheen(); } });

  tl.to('.loader__inner', { opacity: 0, scale: 1.05, duration: .45, ease: 'power2.out' }, 0);
  if (hero) {
    tl.to(loader, { opacity: 0, duration: .5, ease: 'power1.out' }, .3)
      .fromTo(hero.uniforms.uReveal, { value: 0 }, { value: 1, duration: 2.3, ease: 'power2.inOut' }, .3);
  } else {
    tl.to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' }, .3)
      .from('.hero__img', { scale: 1.14, duration: 2.2, ease: 'power3.out' }, .3);
  }
  tl.add(() => { loader.remove(); lenis?.start(); }, 1.3);

  const at = hero ? 1 : .8;
  // the headline is set letter by letter, like type dropped into a composing stick;
  // the gilt words follow a beat later and a little slower, then the sheen passes over them (sheen())
  tl.from(plain, { yPercent: 112, duration: 1.1, stagger: .022 }, at)
    .from(gilt, { yPercent: 112, rotate: 6, transformOrigin: '0% 100%', duration: 1.3, stagger: .04 }, at + .42)
    .from('.hero__lede', { opacity: 0, y: 18, duration: 1 }, at + .7)
    .fromTo('.hero__actions > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .9, stagger: .07 }, at + .8)
    // a gilt inlay line is drawn across the foot of the hero, and the facts settle onto it
    .fromTo(facts, { '--rule': 0 }, { '--rule': 1, duration: 1.6, ease: 'power3.inOut' }, at + .6)
    .from($$('li', facts), { opacity: 0, y: 12, duration: .9, stagger: .12 }, at + 1.05)
    .fromTo(nav, { yPercent: -100 }, { yPercent: 0, duration: 1, clearProps: 'transform' }, at + .2);
}

/* ── gold sheen: one slow pass of light across "takes its time.", like light over gold leaf; then still ── */
function sheen() {
  const em = $('.hero__title em');
  if (!em) return;
  em.classList.add('is-sheen');
  gsap.fromTo(em, { backgroundPosition: '100% 0' }, {
    backgroundPosition: '0% 0', duration: 2.2, ease: 'power2.inOut', delay: .15,
    onComplete: () => em.classList.remove('is-sheen'),
  });
}

/* ── hero: scroll sinks the photograph under the next section ── */
function heroScroll(hero) {
  let visible = true;

  gsap.to('.hero__content', {
    yPercent: -12, opacity: 0, ease: 'none',
    scrollTrigger: {
      trigger: '.manifesto', start: 'top bottom', end: 'top 20%', scrub: true,
      onUpdate: (self) => { if (hero) hero.uniforms.uProgress.value = self.progress; },
    },
  });
  ScrollTrigger.create({ trigger: '.manifesto', start: 'top top', onToggle: (self) => { visible = !self.isActive; } });

  if (!hero) {
    gsap.to('.hero__img', { scale: 1.1, ease: 'none', scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'top top', scrub: true } });
    return;
  }
  gsap.ticker.add(() => { if (visible && !document.hidden) hero.render(); });
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
    const link = !lab && e.target.closest('a, button:not(:disabled), .choice');
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
    let x, y;                                           // made on first hover, so they never cut an entrance short
    el.addEventListener('pointermove', (e) => {
      x ??= gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' });
      y ??= gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * .28);
      y((e.clientY - (r.top + r.height / 2)) * .38);
    });
    el.addEventListener('pointerleave', () => { x = y = undefined; gsap.to(el, { x: 0, y: 0, scale: 1, duration: .9, ease: 'elastic.out(1, .45)', overwrite: true }); });
    // GSAP owns this element's transform, so the press is done here instead of in CSS
    el.addEventListener('pointerdown', () => gsap.to(el, { scale: .97, duration: .14, ease: 'power2.out', overwrite: 'auto' }));
    el.addEventListener('pointerup', () => gsap.to(el, { scale: 1, duration: .3, ease: 'power2.out', overwrite: 'auto' }));
  });
}

/* ── manifesto: the sentence lights up word by word as it is read ── */
function manifesto() {
  const el = $('[data-words]');
  const split = SplitText.create(el, { type: 'words', aria: 'auto' });
  gsap.fromTo(split.words, { opacity: .14 }, {
    opacity: 1, ease: 'none', stagger: .12,
    scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 48%', scrub: .4 },
  });
}

/* ── type band: two rows pulled in opposite directions by the scroll ── */
function band() {
  $$('.band__row').forEach((row) => {
    const dir = +row.dataset.dir;
    gsap.fromTo(row, { xPercent: dir < 0 ? 2 : -24 }, {
      xPercent: dir < 0 ? -24 : 2, ease: 'none',
      scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom top', scrub: .5 },
    });
  });
}

/* ── inside the shop: one pinned frame, three pictures, three texts ── */
function shop(GL) {
  const section = $('.shop');
  const frame = $('.shop__frame', section);
  const pictures = $$('picture', frame), imgs = $$('img', frame);
  const texts = $$('.chapter', section);
  section.classList.add('shop--pinned');
  texts.forEach((t, i) => { t.classList.toggle('is-active', i === 0); if (i) gsap.set(t, { autoAlpha: 0 }); });

  let scene = null, inView = false;
  Promise.all(imgs.map((img) => img.decode())).then(() => {
    if (!GL) return;
    try { scene = GL.createChapters($('.shop__gl', section), imgs); section.classList.add('is-gl'); scene.set(state.p); scene.render(0); }
    catch (err) { scene = null; }
  }).catch(() => {});

  const state = { p: 0 };
  let active = 0;

  function show(to) {
    const dir = to > active ? 1 : -1;
    texts.forEach((t, i) => {
      if (i === to) return;
      t.classList.remove('is-active');
      gsap.to(t, { autoAlpha: 0, duration: .22, ease: 'power1.out', overwrite: true });
    });
    const el = texts[to];
    el.classList.add('is-active');
    gsap.killTweensOf(el);                       // a fade-out still running from a fast scroll must not win
    gsap.set(el, { autoAlpha: 1 });
    gsap.fromTo(el.querySelector('.chapter__title'), { yPercent: 55 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .95, delay: .1, overwrite: true });
    gsap.fromTo(el.querySelector('.chapter__body'), { y: 22 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: .9, delay: .19, overwrite: true });
    active = to;
  }

  function apply() {
    if (scene) scene.set(state.p);
    else pictures.forEach((p, i) => { p.style.opacity = clamp(1 - Math.abs(state.p - i)); });   // plain crossfade without WebGL
    const to = Math.round(state.p);
    if (to !== active) show(to);
  }

  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut', duration: 1 },
    scrollTrigger: {
      // pinned --edge-gap below the top edge (8px), so iOS Safari keeps its bars clear glass
      trigger: section, start: 'top 8px', end: () => `+=${window.innerHeight * 2.8}`,
      pin: '.shop__pin', scrub: .7, anticipatePin: 1, invalidateOnRefresh: true,
    },
    onUpdate: apply,
  });
  tl.to(state, { p: 1 }, .55).to(state, { p: 2 }, 2.1).to({}, { duration: .55 });

  // the frame rises into place as the section arrives
  gsap.from(frame, { yPercent: 14, scale: .93, opacity: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top 90%', end: 'top 12%', scrub: true } });
  gsap.from($('.shop__texts', section), { y: 60, opacity: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top 70%', end: 'top 12%', scrub: true } });

  ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onToggle: (self) => { inView = self.isActive; } });
  frame.addEventListener('pointermove', (e) => {
    const r = frame.getBoundingClientRect();
    scene?.pointer((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  });
  frame.addEventListener('pointerleave', () => scene?.pointer(.5, .5));
  gsap.ticker.add((time, delta) => { if (scene && inView && !document.hidden) scene.render(delta / 1000); });
}

/* ── price list rows arrive in a short wave, once ── */
function services() {
  const rows = $$('.svc-list li');
  gsap.set(rows, { opacity: 0, y: 30 });
  ScrollTrigger.batch(rows, {
    start: 'top 92%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: .9, stagger: .07, overwrite: true, clearProps: 'transform' }),
  });
}

/* ── a visit: the docket is written out once, as it comes up the page. The slip rises, each line is
      printed in turn (it uncovers from the top, as paper leaves a till), the total lands, and last the
      shop's stamp is pressed across the corner. Already-visible default: without this it is simply there. ── */
function visit() {
  const docket = $('.docket');
  if (!docket) return;
  const lines = $$('.docket__line', docket);
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  tl.from(docket.parentElement, { y: 48, opacity: 0, duration: 1.1 })
    .from($('.docket__head', docket), { clipPath: 'inset(0 0 100% 0)', duration: .8, ease: 'power3.out' }, .15)
    .from(lines, { clipPath: 'inset(0 0 100% 0)', y: -6, duration: .7, ease: 'power3.out', stagger: .14 }, .45)
    .from($('.docket__foot', docket), { opacity: 0, y: 8, duration: .7 }, '>-.25')
    .fromTo($('.docket__stamp', docket), { scale: 1.35, opacity: 0, rotate: -4 }, { scale: 1, opacity: .62, rotate: -14, duration: .38, ease: 'back.out(1.6)' }, '>-.1')
    .set([docket.parentElement, $('.docket__head', docket), ...lines], { clearProps: 'clipPath,transform' });
  ScrollTrigger.create({ trigger: docket, start: 'top 78%', once: true, onEnter: () => tl.play() });
}

/* ── photographs drift inside their mirror frames ── */
function parallax() {
  $$('[data-parallax]').forEach((frame) => {
    gsap.fromTo($('img', frame), { yPercent: -6.5 }, { yPercent: 6.5, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from(frame, { opacity: 0, scale: .94, duration: 1.4, scrollTrigger: { trigger: frame, start: 'top 88%', once: true } });
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

/* ── reviews: the score counts in once; on wide screens one compact stage shows a review at a
      time — previous / next change it, and the mirror steams up and is wiped clean between them ── */
function reviews(GL) {
  const ui = reviewsUI;
  if (!ui) return;
  const { section, cards } = ui;
  const N = cards.length;

  // the score: 0.0 → 4.9, the stars fill left to right, the bars draw. Once.
  {
    const num = $('[data-score-num]', section), stars = $$('.score .stars i', section), bars = $$('.score__bars dd i', section);
    const target = parseFloat(num.textContent), c = { v: 0 };
    const fills = stars.map((s) => parseFloat(s.style.getPropertyValue('--fill')) || 1);
    num.textContent = '0.0';
    gsap.set(stars, { '--fill': 0 });
    gsap.set(bars, { '--grow': 0 });
    ScrollTrigger.create({
      trigger: '.score', start: 'top 85%', once: true,
      onEnter: () => {
        gsap.to(c, { v: target, duration: 1.6, ease: 'power3.out', onUpdate: () => { num.textContent = c.v.toFixed(1); } });
        gsap.to(stars, { '--fill': (i) => fills[i], duration: .55, stagger: .11, ease: 'power2.inOut', delay: .15 });
        gsap.to(bars, { '--grow': 1, duration: 1.2, stagger: .07, ease: 'expo.out', delay: .3 });
      },
    });
  }

  // the mirror's pictures: the larger file of each card's photograph
  const mirror = $('.reviews__mirror', section), canvas = $('.reviews__gl', section);
  const imgs = cards.map((c) => {
    const src = $('.review__photo img', c), im = new Image();
    im.alt = ''; im.decoding = 'async'; im.src = src.dataset.hi;
    im.dataset.focus = src.dataset.focus;
    const [fx, fy] = src.dataset.focus.split(' ').map(Number);
    im.style.objectPosition = `${fx * 100}% ${fy * 100}%`;
    mirror.insertBefore(im, canvas);
    return im;
  });
  let scene = null, sceneTried = false;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 1100px)', () => {
    section.classList.add('reviews--stage');
    const quotes = cards.map((c) => $('.review__quote', c));
    const mix = { m: 0 };
    let inView = false, busy = null;

    gsap.set(cards, { autoAlpha: 0 });

    // the mirror between review i and i + 1, m: 0…1
    function mirrorAt(i, m) {
      if (scene) scene.set(i, m);
      else imgs.forEach((im, j) => { im.style.opacity = j === i ? 1 - m : j === i + 1 ? m : 0; });
    }

    function show(k, dir, animate = true) {
      cards.forEach((c, j) => {
        if (j === k || !c.classList.contains('is-active')) return;
        c.classList.remove('is-active');
        gsap.to(c, { autoAlpha: 0, y: -12 * dir, duration: animate ? .28 : 0, ease: 'power1.in', overwrite: true });
      });
      const c = cards[k];
      c.classList.add('is-active');
      gsap.killTweensOf(c);
      gsap.set(c, { autoAlpha: 1, y: 0 });
      if (animate) {
        const cite = $('.review__cite', c);
        gsap.fromTo(quotes[k], { y: 24 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: .8, delay: .12, ease: 'power3.out', overwrite: true });
        gsap.fromTo([$('.review__initial', cite), $('.review__who', cite), $('.stars', cite), $('.review__book', cite)], { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .05, delay: .26, ease: 'power3.out', overwrite: true });
        gsap.fromTo(ui.num, { yPercent: 60 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .5, ease: 'power3.out', overwrite: true });
      }
      ui.setActive(k);
    }

    // previous / next: one step at a time; the mirror runs steam -> wipe in ~1.3s
    ui.goStage = (k) => {
      const from = ui.active, dir = k > from ? 1 : -1;
      if (busy) busy.progress(1);
      show(k, dir);
      const i = Math.min(from, k);                       // the pair the mirror moves between
      mix.m = dir > 0 ? 0 : 1;
      busy = gsap.to(mix, {
        m: dir > 0 ? 1 : 0, duration: 1.3, ease: 'power1.inOut',
        onUpdate: () => mirrorAt(i, mix.m), onComplete: () => { busy = null; },
      });
    };

    show(0, 1, false);
    mirrorAt(0, 0);
    ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onToggle: (self) => { inView = self.isActive; } });

    if (!sceneTried) {
      sceneTried = true;
      Promise.all(imgs.map((im) => im.decode())).then(() => {
        if (!GL) return;
        try {
          scene = GL.createMirror(canvas, imgs);
          section.classList.add('is-gl');
          const a = ui.active;
          mirrorAt(Math.min(a, cards.length - 2), a === cards.length - 1 ? 1 : 0);
        }
        catch (err) { scene = null; }
      }).catch(() => {});
    }
    if (scene) section.classList.add('is-gl');
    const tick = () => { if (scene && inView && !document.hidden) scene.render(); };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      if (busy) busy.kill();
      ui.goStage = null;
      gsap.set([...cards, ...quotes], { clearProps: 'all' });
      cards.forEach((c) => c.classList.remove('is-active'));
      section.classList.remove('reviews--stage', 'is-gl');
      ui.list.scrollLeft = 0;
      ui.setActive(0);
    };
  });
}
