/**
 * Client behaviour for /treatwell-alternative: the hero "listing vs your site" phone, the
 * starting-point chooser and comparison tabs, the 365-day rule slider and the commission
 * estimator. Pure maths is exported for tests; every Treatwell figure comes from treatwellFacts.
 * Everything rests under prefers-reduced-motion and the page reads fully without JS.
 */
import { gsap } from 'gsap';
import { estimateMonthlyCommission, formatGbp, readRuleScenario, type TwRuleChannel } from './treatwellMath';

export * from './treatwellMath';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Tween a number inside an element; jumps straight there under reduced motion. */
function tweenNumber(el: HTMLElement | null, to: number, format: (n: number) => string) {
  if (!el) return;
  const from = Number(el.dataset.value ?? to);
  el.dataset.value = String(to);
  if (reducedMotion() || from === to) {
    el.textContent = format(to);
    return;
  }
  const state = { n: from };
  gsap.killTweensOf(el);
  gsap.to(state, {
    n: to,
    duration: 0.45,
    ease: 'power2.out',
    overwrite: true,
    onUpdate: () => { el.textContent = format(state.n); },
    onComplete: () => { el.textContent = format(to); },
  });
}

/* ---------- Tabs (starting point chooser, comparison) ---------- */

function initTabs(root: HTMLElement): () => void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = tabs.map((tab) => root.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`));
  if (!tabs.length) return () => {};

  const select = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = panels[i];
      if (panel) panel.hidden = !active;
    });
    if (focus) tabs[index].focus();
  };

  const onClick = (event: Event) => {
    const index = tabs.indexOf(event.currentTarget as HTMLButtonElement);
    if (index >= 0) select(index);
  };
  const onKey = (event: KeyboardEvent) => {
    const index = tabs.indexOf(event.currentTarget as HTMLButtonElement);
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    select(next, true);
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', onClick);
    tab.addEventListener('keydown', onKey);
  });
  const initial = Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
  select(initial);
  root.dataset.twTabsReady = 'true';

  return () => tabs.forEach((tab) => {
    tab.removeEventListener('click', onClick);
    tab.removeEventListener('keydown', onKey);
  });
}

/* ---------- Hero phone ---------- */

function initHeroPhone(doc: Document): () => void {
  const phone = doc.querySelector<HTMLElement>('[data-tw-phone]');
  if (!phone) return () => {};
  const buttons = Array.from(doc.querySelectorAll<HTMLButtonElement>('[data-tw-view]'));
  const listing = phone.querySelectorAll<HTMLElement>('[data-tw-layer="listing"] [data-tw-item]');
  const own = phone.querySelectorAll<HTMLElement>('[data-tw-layer="own"] [data-tw-item]');
  let timeline: gsap.core.Timeline | null = null;
  let autoTimer = 0;

  const show = (view: string, animate: boolean) => {
    if (phone.dataset.view === view) return;
    phone.dataset.view = view;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.twView === view)));
    timeline?.kill();
    const incoming = view === 'own' ? own : listing;
    const outgoing = view === 'own' ? listing : own;
    if (!animate || reducedMotion()) {
      gsap.set([...incoming, ...outgoing], { clearProps: 'all' });
      return;
    }
    timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo(outgoing, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -10, duration: 0.22, stagger: 0.03, ease: 'power2.in' })
      .fromTo(incoming, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.06 }, '>-0.02')
      .set(outgoing, { clearProps: 'all' });
  };

  const onClick = (event: Event) => {
    window.clearTimeout(autoTimer);
    show((event.currentTarget as HTMLButtonElement).dataset.twView ?? 'own', true);
  };
  buttons.forEach((button) => button.addEventListener('click', onClick));

  // One choreographed swap after the hero has entered: the listing gives way to your own site.
  if (!reducedMotion()) autoTimer = window.setTimeout(() => show('own', true), 2400);

  return () => {
    window.clearTimeout(autoTimer);
    timeline?.kill();
    buttons.forEach((button) => button.removeEventListener('click', onClick));
  };
}

/* ---------- 365-day rule ---------- */

function initRule(doc: Document): () => void {
  const root = doc.querySelector<HTMLElement>('[data-tw-rule]');
  if (!root) return () => {};
  const months = root.querySelector<HTMLInputElement>('[data-tw-rule-months]');
  const price = root.querySelector<HTMLInputElement>('[data-tw-rule-price]');
  const channels = Array.from(root.querySelectorAll<HTMLInputElement>('[data-tw-rule-channel]'));
  if (!months || !price) return () => {};
  const out = (name: string) => root.querySelector<HTMLElement>(`[data-tw-out="${name}"]`);

  const update = () => {
    const monthsValue = Number(months.value);
    const priceValue = Number(price.value);
    const channel = (channels.find((c) => c.checked)?.value ?? 'marketplace') as TwRuleChannel;
    const result = readRuleScenario({ monthsSinceVisit: monthsValue, channel, priceGbp: priceValue });
    root.dataset.status = result.status;
    root.style.setProperty('--tw-rule-pos', String(monthsValue / Number(months.max)));
    const monthsLabel = out('months');
    if (monthsLabel) monthsLabel.textContent = monthsValue === 1 ? '1 month' : `${monthsValue} months`;
    const priceLabel = out('price');
    if (priceLabel) priceLabel.textContent = formatGbp(priceValue);
    months.setAttribute('aria-valuetext', `${monthsValue} months since last visit`);
    price.setAttribute('aria-valuetext', formatGbp(priceValue));
    tweenNumber(out('commission'), result.commissionExVatGbp, (n) => (n < 0.005 ? '£0' : `${formatGbp(Math.round(n * 100) / 100)} + VAT`));
  };

  const inputs = [months, price, ...channels];
  inputs.forEach((input) => input.addEventListener('input', update));
  update();
  root.dataset.twReady = 'true';
  return () => inputs.forEach((input) => input.removeEventListener('input', update));
}

/* ---------- Estimator ---------- */

function initEstimator(doc: Document): () => void {
  const root = doc.querySelector<HTMLElement>('[data-tw-estimator]');
  if (!root) return () => {};
  const clients = root.querySelector<HTMLInputElement>('[data-tw-est-clients]');
  const price = root.querySelector<HTMLInputElement>('[data-tw-est-price]');
  if (!clients || !price) return () => {};
  const kersivo = Number(root.dataset.kersivoGbp ?? '39');
  const out = (name: string) => root.querySelector<HTMLElement>(`[data-tw-out="${name}"]`);

  const update = () => {
    const estimate = estimateMonthlyCommission({ newClients: Number(clients.value), firstVisitGbp: Number(price.value) });
    const scale = Math.max(estimate.inclVatGbp, kersivo, 1) * 1.08;
    root.style.setProperty('--tw-bar-a', String(estimate.inclVatGbp / scale));
    root.style.setProperty('--tw-bar-b', String(kersivo / scale));
    const clientsLabel = out('clients');
    if (clientsLabel) clientsLabel.textContent = String(clients.value);
    const priceLabel = out('est-price');
    if (priceLabel) priceLabel.textContent = formatGbp(Number(price.value));
    clients.setAttribute('aria-valuetext', `${clients.value} new marketplace clients a month`);
    price.setAttribute('aria-valuetext', formatGbp(Number(price.value)));
    const round = (n: number) => formatGbp(Math.round(n * 100) / 100);
    tweenNumber(out('ex'), estimate.exVatGbp, round);
    tweenNumber(out('incl'), estimate.inclVatGbp, round);
    tweenNumber(out('year'), estimate.yearlyInclVatGbp, (n) => formatGbp(Math.round(n)));
  };

  [clients, price].forEach((input) => input.addEventListener('input', update));
  update();
  root.dataset.twReady = 'true';
  return () => [clients, price].forEach((input) => input.removeEventListener('input', update));
}

export function initTreatwellPage(doc: Document): () => void {
  const cleanups = [
    initHeroPhone(doc),
    initRule(doc),
    initEstimator(doc),
    ...Array.from(doc.querySelectorAll<HTMLElement>('[data-tw-tabs]')).map(initTabs),
  ];
  return () => cleanups.forEach((cleanup) => cleanup());
}
