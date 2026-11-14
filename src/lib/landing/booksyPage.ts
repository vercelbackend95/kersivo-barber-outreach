/**
 * Client behaviour for /booksy-alternative: the hero address-bar swap, scroll reveals, the
 * team-size bill, the Boost estimator and the switching timeline. Pure maths lives in booksyMath.
 * Everything rests under prefers-reduced-motion and the page reads fully without JS.
 */
import { gsap } from 'gsap';
import { BK_TEAM_MAX, BK_TEAM_MIN, estimateBill, estimateBoost, formatGbp } from './booksyMath';

const BAR_SCALE_GBP = 120;
const BASE_EX_VAT = estimateBill(BK_TEAM_MIN).booksyExVatGbp;
const activeTweens = new WeakMap<HTMLElement, gsap.core.Tween>();
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const money = (n: number) => formatGbp(Math.round(n * 100) / 100);

/** Tween a number inside an element; jumps straight there under reduced motion. */
function tweenNumber(el: HTMLElement | null, to: number, format: (n: number) => string = money) {
  if (!el) return;
  const from = Number(el.dataset.value ?? to);
  el.dataset.value = String(to);
  if (reducedMotion() || from === to) {
    el.textContent = format(to);
    return;
  }
  const state = { n: from };
  activeTweens.get(el)?.kill();
  const tween = gsap.to(state, {
    n: to,
    duration: 0.5,
    ease: 'power2.out',
    onUpdate: () => { el.textContent = format(state.n); },
    onComplete: () => { el.textContent = format(to); },
  });
  activeTweens.set(el, tween);
}

/* ---------- Hero: profile link → your own domain ---------- */

function initHero(doc: Document): () => void {
  const browser = doc.querySelector<HTMLElement>('[data-bk-browser]');
  if (!browser) return () => {};
  const buttons = Array.from(doc.querySelectorAll<HTMLButtonElement>('[data-bk-view]'));
  const url = browser.querySelector<HTMLElement>('[data-bk-url]');
  const toast = doc.querySelector<HTMLElement>('[data-bk-toast]');
  const items = (view: string) => browser.querySelectorAll<HTMLElement>(`[data-bk-layer="${view}"] [data-bk-item]`);
  const switcher = doc.querySelector<HTMLElement>('.bk-switch');
  let timeline: gsap.core.Timeline | null = null;
  let autoTimer = 0;

  const show = (view: 'booksy' | 'own', animate: boolean) => {
    if (browser.dataset.view === view) return;
    browser.dataset.view = view;
    switcher?.setAttribute('data-view', view);
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.bkView === view)));
    timeline?.kill();
    const target = (view === 'own' ? url?.dataset.own : url?.dataset.booksy) ?? '';
    const incoming = items(view);
    const outgoing = items(view === 'own' ? 'booksy' : 'own');
    toast?.classList.toggle('is-in', false);

    if (!animate || reducedMotion() || !url) {
      if (url) url.textContent = target;
      gsap.set([...incoming, ...outgoing], { clearProps: 'all' });
      if (view === 'own') toast?.classList.add('is-in');
      return;
    }

    const typing = { chars: url.textContent?.length ?? 0 };
    const current = url.textContent ?? '';
    timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
      // delete the old address, then type the new one
      .to(typing, {
        chars: 0,
        duration: Math.min(0.5, current.length * 0.018),
        ease: 'none',
        onUpdate: () => { url.textContent = current.slice(0, Math.round(typing.chars)); },
      })
      .fromTo(outgoing, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -8, duration: 0.24, stagger: 0.03, ease: 'power2.in' }, 0)
      .to(typing, {
        chars: target.length,
        duration: Math.min(0.7, target.length * 0.045),
        ease: 'none',
        onUpdate: () => { url.textContent = target.slice(0, Math.round(typing.chars)); },
      })
      .fromTo(incoming, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.06 }, '<0.15')
      .set(outgoing, { clearProps: 'all' })
      .call(() => { if (view === 'own') toast?.classList.add('is-in'); }, [], '>0.2');
  };

  const onClick = (event: Event) => {
    window.clearTimeout(autoTimer);
    show(((event.currentTarget as HTMLButtonElement).dataset.bkView as 'booksy' | 'own') ?? 'own', true);
  };
  buttons.forEach((button) => button.addEventListener('click', onClick));

  // One choreographed swap after the hero has entered; then it's the visitor's toggle.
  autoTimer = window.setTimeout(() => show('own', !reducedMotion()), reducedMotion() ? 0 : 2200);

  return () => {
    window.clearTimeout(autoTimer);
    timeline?.kill();
    buttons.forEach((button) => button.removeEventListener('click', onClick));
  };
}

/* ---------- Scroll reveals ---------- */

function initReveals(doc: Document): () => void {
  const targets = Array.from(doc.querySelectorAll<HTMLElement>('[data-bk-reveal], .bk-score__card, [data-bk-step]'));
  if (!('IntersectionObserver' in window) || reducedMotion()) {
    targets.forEach((el) => el.classList.add('is-in'));
    return () => {};
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  targets.forEach((el) => observer.observe(el));
  doc.documentElement.classList.add('bk-motion');
  return () => observer.disconnect();
}

/* ---------- Range helper ---------- */

function syncRange(input: HTMLInputElement) {
  const min = Number(input.min);
  const max = Number(input.max);
  input.style.setProperty('--bk-pos', String((Number(input.value) - min) / (max - min)));
}

/* ---------- Monthly bill ---------- */

function initBill(doc: Document): () => void {
  const root = doc.querySelector<HTMLElement>('[data-bk-bill]');
  const team = root?.querySelector<HTMLInputElement>('[data-bk-team]');
  if (!root || !team) return () => {};
  const out = (name: string) => root.querySelector<HTMLElement>(`[data-bk-out="${name}"]`);
  const starter = root.querySelector<HTMLElement>('[data-bk-starter]');
  const bar = root.querySelector<HTMLElement>('[data-bk-bar="booksy"]');

  const update = () => {
    const bill = estimateBill(Number(team.value));
    syncRange(team);
    team.setAttribute('aria-valuetext', `${bill.teamSize} team member${bill.teamSize === 1 ? '' : 's'}`);
    const teamOut = out('team');
    if (teamOut) teamOut.textContent = String(bill.teamSize);
    const count = out('extra-count');
    if (count) count.textContent = String(bill.additionalUsers);
    tweenNumber(out('extra'), bill.booksyExVatGbp - BASE_EX_VAT);
    tweenNumber(out('vat'), bill.booksyVatGbp);
    tweenNumber(out('booksy'), bill.booksyIncVatGbp);
    tweenNumber(out('year'), bill.yearlyDifferenceGbp, (n) => formatGbp(Math.round(n)));
    bar?.style.setProperty('--bk-bar', String(Math.min(1, bill.booksyIncVatGbp / BAR_SCALE_GBP)));
    if (starter) starter.hidden = !bill.starterEligible;
  };

  team.max = String(BK_TEAM_MAX);
  team.addEventListener('input', update);
  update();
  root.dataset.bkReady = 'true';
  return () => team.removeEventListener('input', update);
}

/* ---------- Boost estimator ---------- */

function initBoost(doc: Document): () => void {
  const root = doc.querySelector<HTMLElement>('[data-bk-boost]');
  const clients = root?.querySelector<HTMLInputElement>('[data-bk-boost-clients]');
  const price = root?.querySelector<HTMLInputElement>('[data-bk-boost-price]');
  if (!root || !clients || !price) return () => {};
  const out = (name: string) => root.querySelector<HTMLElement>(`[data-bk-out="${name}"]`);

  const update = () => {
    const estimate = estimateBoost({ newClients: Number(clients.value), firstVisitGbp: Number(price.value) });
    syncRange(clients);
    syncRange(price);
    const clientsOut = out('clients');
    if (clientsOut) clientsOut.textContent = clients.value;
    const priceOut = out('price');
    if (priceOut) priceOut.textContent = formatGbp(Number(price.value));
    clients.setAttribute('aria-valuetext', `${clients.value} new clients a month`);
    price.setAttribute('aria-valuetext', formatGbp(Number(price.value)));
    tweenNumber(out('per'), estimate.perClientExVatGbp);
    tweenNumber(out('month'), estimate.monthlyIncVatGbp);
    tweenNumber(out('boost-year'), estimate.yearlyIncVatGbp, (n) => formatGbp(Math.round(n)));
  };

  [clients, price].forEach((input) => input.addEventListener('input', update));
  update();
  return () => [clients, price].forEach((input) => input.removeEventListener('input', update));
}

/* ---------- Switching timeline: the rail fills as you read ---------- */

function initSteps(doc: Document): () => void {
  const root = doc.querySelector<HTMLElement>('[data-bk-steps]');
  const fill = root?.querySelector<HTMLElement>('[data-bk-steps-fill]');
  if (!root || !fill || reducedMotion()) {
    fill?.style.setProperty('--bk-fill', '1');
    return () => {};
  }
  let frame = 0;
  const measure = () => {
    frame = 0;
    const rect = root.getBoundingClientRect();
    const anchor = window.innerHeight * 0.6;
    const progress = Math.min(1, Math.max(0, (anchor - rect.top) / Math.max(1, rect.height)));
    fill.style.setProperty('--bk-fill', progress.toFixed(3));
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  measure();
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

export function initBooksyPage(doc: Document): () => void {
  const cleanups = [initReveals(doc), initHero(doc), initBill(doc), initBoost(doc), initSteps(doc)];
  return () => cleanups.forEach((cleanup) => cleanup());
}
