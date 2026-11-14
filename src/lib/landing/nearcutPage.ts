/**
 * Client behaviour for /nearcut-alternative: the hero "booking page vs your website" reveal,
 * the website anatomy pointer, the client booking-charge estimator and the comparison tabs.
 * Every figure comes from nearcutFacts via nearcutMath. Everything rests under
 * prefers-reduced-motion and the page reads fully without JS.
 */
import { gsap } from 'gsap';
import { estimateNearcutClientCharges, formatGbpWhole } from './nearcutMath';

export * from './nearcutMath';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const numberTweens = new WeakMap<HTMLElement, { tween: gsap.core.Tween; state: { n: number } }>();

function tweenNumber(el: HTMLElement | null, to: number, format: (n: number) => string) {
  if (!el) return;
  const running = numberTweens.get(el);
  running?.tween.kill();
  const from = running ? running.state.n : Number(el.dataset.value ?? to);
  el.dataset.value = String(to);
  if (reducedMotion() || from === to) {
    el.textContent = format(to);
    return;
  }
  const state = { n: from };
  const tween = gsap.to(state, {
    n: to,
    duration: 0.45,
    ease: 'power2.out',
    onUpdate: () => { el.textContent = format(state.n); },
    onComplete: () => { el.textContent = format(to); numberTweens.delete(el); },
  });
  numberTweens.set(el, { tween, state });
}

/* ---------- Hero reveal ---------- */

function describePosition(value: number): string {
  if (value >= 80) return 'Mostly the plain booking page';
  if (value <= 20) return 'Mostly the KERSIVO website';
  return 'Half booking page, half KERSIVO website';
}

function initHeroCompare(doc: Document): () => void {
  const root = doc.querySelector<HTMLElement>('[data-nc-compare]');
  const range = root?.querySelector<HTMLInputElement>('[data-nc-range]');
  if (!root || !range) return () => {};

  const state = { pos: Number(range.value) };
  const apply = (value: number) => {
    state.pos = value;
    root.style.setProperty('--pos', `${value}%`);
    root.dataset.side = value > 50 ? 'plain' : 'site';
  };
  const sync = () => {
    const value = Number(range.value);
    range.setAttribute('aria-valuetext', describePosition(value));
    apply(value);
  };

  let intro: gsap.core.Timeline | null = null;
  const stopIntro = () => {
    if (!intro) return;
    intro.kill();
    intro = null;
  };
  const onInput = () => {
    stopIntro();
    root.dataset.touched = 'true';
    sync();
  };

  range.addEventListener('input', onInput);
  range.addEventListener('pointerdown', stopIntro);
  range.addEventListener('keydown', stopIntro);
  sync();

  if (!reducedMotion()) {
    // One choreographed reveal after the hero has entered: show the booking page, then wipe to the site.
    intro = gsap.timeline({
      delay: 0.9,
      onUpdate: () => {
        const value = Math.round(state.pos);
        range.value = String(value);
        root.style.setProperty('--pos', `${state.pos}%`);
        root.dataset.side = state.pos > 50 ? 'plain' : 'site';
      },
      onComplete: () => { sync(); intro = null; },
    });
    intro
      .to(state, { pos: 90, duration: 0.8, ease: 'power2.inOut' })
      .to(state, { pos: 12, duration: 1.4, ease: 'power3.inOut' }, '+=0.25');
  }

  return () => {
    stopIntro();
    range.removeEventListener('input', onInput);
    range.removeEventListener('pointerdown', stopIntro);
    range.removeEventListener('keydown', stopIntro);
  };
}

/* ---------- Website anatomy ---------- */

function initAnatomy(doc: Document): () => void {
  const root = doc.querySelector<HTMLElement>('[data-nc-anatomy]');
  const frame = root?.querySelector<HTMLElement>('[data-nc-anatomy-frame]');
  const page = frame?.querySelector<HTMLElement>('[data-nc-page]');
  const viewport = frame?.querySelector<HTMLElement>('.nc-site__viewport');
  if (!root || !frame || !page || !viewport) return () => {};

  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-nc-part-btn]'));
  const parts = Array.from(frame.querySelectorAll<HTMLElement>('[data-nc-part]'));
  let active = buttons.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.ncPartBtn ?? 'domain';
  frame.classList.add('is-enhanced');

  const offsetFor = (id: string) => {
    const part = page.querySelector<HTMLElement>(`[data-nc-part="${id}"]`);
    if (!part) return 0;
    const max = Math.max(0, page.scrollHeight - viewport.clientHeight);
    const gap = viewport.clientHeight * 0.08;
    return Math.min(max, Math.max(0, part.offsetTop - gap));
  };

  const activate = (id: string, animate = true) => {
    active = id;
    frame.dataset.active = id;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ncPartBtn === id)));
    parts.forEach((p) => p.classList.toggle('is-active', p.dataset.ncPart === id));
    const y = -offsetFor(id);
    if (!animate || reducedMotion()) {
      gsap.set(page, { y });
      return;
    }
    gsap.to(page, { y, duration: 0.7, ease: 'power3.inOut', overwrite: true });
  };

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const handlers = buttons.map((button) => {
    const id = button.dataset.ncPartBtn ?? 'domain';
    const onClick = () => activate(id);
    const onEnter = () => { if (canHover.matches && active !== id) activate(id); };
    const onFocus = () => { if (active !== id) activate(id); };
    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', onEnter);
    button.addEventListener('focus', onFocus);
    return () => {
      button.removeEventListener('click', onClick);
      button.removeEventListener('mouseenter', onEnter);
      button.removeEventListener('focus', onFocus);
    };
  });

  const onResize = () => activate(active, false);
  const ro = new ResizeObserver(onResize);
  ro.observe(viewport);
  activate(active, false);

  return () => {
    handlers.forEach((off) => off());
    ro.disconnect();
    gsap.killTweensOf(page);
  };
}

/* ---------- Estimator ---------- */

function initEstimator(doc: Document): () => void {
  const root = doc.querySelector<HTMLElement>('[data-nc-estimator]');
  const input = root?.querySelector<HTMLInputElement>('[data-nc-bookings]');
  if (!root || !input) return () => {};
  const out = (key: string) => root.querySelector<HTMLElement>(`[data-nc-out="${key}"]`);
  const bar = root.querySelector<HTMLElement>('[data-nc-bar]');
  const barMax = Number(bar?.dataset.max ?? 1);

  const update = () => {
    const e = estimateNearcutClientCharges(Number(input.value));
    const min = Number(input.min);
    const max = Number(input.max);
    input.style.setProperty('--fill', `${((e.bookings - min) / (max - min)) * 100}%`);
    const bookings = out('bookings');
    if (bookings) bookings.textContent = String(e.bookings);
    tweenNumber(out('monthly'), e.clientChargesMonthly, formatGbpWhole);
    tweenNumber(out('yearly'), e.clientChargesYearly, formatGbpWhole);
    bar?.style.setProperty('--w', `${Math.min(100, (e.clientChargesMonthly / barMax) * 100)}%`);
  };

  input.addEventListener('input', update);
  return () => input.removeEventListener('input', update);
}

/* ---------- Tabs ---------- */

function initTabs(root: HTMLElement): () => void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = tabs.map((tab) => root.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`));
  if (!tabs.length) return () => {};

  const select = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = panels[i];
      if (!panel) return;
      const wasHidden = panel.hidden;
      panel.hidden = !on;
      if (on && wasHidden && !reducedMotion()) {
        panel.classList.remove('is-entering');
        void panel.offsetWidth;
        panel.classList.add('is-entering');
      }
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
  select(Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true')));
  root.dataset.ncTabsReady = 'true';

  return () => tabs.forEach((tab) => {
    tab.removeEventListener('click', onClick);
    tab.removeEventListener('keydown', onKey);
  });
}

export function initNearcutPage(doc: Document): () => void {
  const cleanups = [
    initHeroCompare(doc),
    initAnatomy(doc),
    initEstimator(doc),
    ...Array.from(doc.querySelectorAll<HTMLElement>('[data-nc-tabs]')).map(initTabs),
  ];
  return () => cleanups.forEach((fn) => fn());
}
