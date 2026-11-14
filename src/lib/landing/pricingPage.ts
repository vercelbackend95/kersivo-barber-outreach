/**
 * Client behaviour for /pricing: hero "month in your shop" feed, plan-fit chooser,
 * per-barber split, comparison table switch, scroll reveals, receipt print-in, steps rail
 * and the mobile sticky CTA. Everything rests under prefers-reduced-motion and the page
 * reads fully without JS.
 */
import { gsap } from 'gsap';
import { clampBarbers, formatPounds, pricePerBarber, recommendPlan } from './pricingMath';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Hero feed ---------- */

function initFeed(root: HTMLElement): () => void {
  const card = root.querySelector<HTMLElement>('[data-pr-live]');
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-pr-feed-item]'));
  const marker = root.querySelector<HTMLElement>('[data-pr-marker]');
  const amount = root.querySelector<HTMLElement>('[data-pr-count]');
  if (!card || !items.length || !marker) return () => {};

  let index = 0;
  let timer = 0;
  let visible = true;
  const moveTo = (i: number, animate: boolean) => {
    items.forEach((item, n) => item.toggleAttribute('data-active', n === i));
    const target = items[i];
    const y = target.offsetTop;
    const h = target.offsetHeight;
    if (animate) gsap.to(marker, { y, height: h, duration: 0.55, ease: 'power3.inOut', overwrite: true });
    else gsap.set(marker, { y, height: h });
  };

  if (reducedMotion()) {
    moveTo(1, false);
    return () => {};
  }

  // Entrance: price counts up, then events drop in one by one.
  const tl = gsap.timeline({ delay: 0.35 });
  if (amount) {
    const to = Number(amount.dataset.prCount ?? '0');
    const state = { n: 0 };
    tl.to(state, {
      n: to,
      duration: 0.9,
      ease: 'power3.out',
      onUpdate: () => { amount.textContent = `£${Math.round(state.n)}`; },
    });
  }
  tl.fromTo(
    items,
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.09, ease: 'power3.out', clearProps: 'opacity,visibility,transform' },
    '<0.2',
  )
    .add(() => moveTo(0, false))
    .fromTo(marker, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });

  const tick = () => {
    if (visible && !document.hidden) {
      index = (index + 1) % items.length;
      moveTo(index, true);
    }
    timer = window.setTimeout(tick, 2600);
  };
  tl.add(() => { timer = window.setTimeout(tick, 2200); });

  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  io.observe(card);
  const onResize = () => moveTo(index, false);
  window.addEventListener('resize', onResize);

  return () => {
    tl.kill();
    window.clearTimeout(timer);
    io.disconnect();
    window.removeEventListener('resize', onResize);
  };
}

/* ---------- Fit chooser ---------- */

function initFit(root: HTMLElement): () => void {
  const tool = root.querySelector<HTMLElement>('[data-pr-fit]');
  if (!tool) return () => {};
  const buttons = Array.from(tool.querySelectorAll<HTMLButtonElement>('[data-pr-fit-q]'));
  const answers = Array.from(tool.querySelectorAll<HTMLElement>('[data-pr-fit-answer]'));
  let touched = false;

  const render = () => {
    const selected = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.prFitQ ?? '');
    const state = recommendPlan(selected, touched);
    if (tool.dataset.state === state) return;
    tool.dataset.state = state;
    answers.forEach((answer) => {
      const on = answer.dataset.prFitAnswer === state;
      answer.hidden = !on;
      if (on && !reducedMotion()) {
        gsap.fromTo(answer.children, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out', clearProps: 'all' });
      }
    });
  };

  const onClick = (event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
    touched = true;
    render();
  };
  buttons.forEach((b) => b.addEventListener('click', onClick));
  return () => buttons.forEach((b) => b.removeEventListener('click', onClick));
}

/* ---------- Per-barber split ---------- */

function initSplit(root: HTMLElement): () => void {
  const split = root.querySelector<HTMLElement>('[data-pr-split]');
  if (!split) return () => {};
  const price = Number(split.dataset.price ?? '0');
  const count = split.querySelector<HTMLElement>('[data-pr-split-count]');
  const out = split.querySelector<HTMLElement>('[data-pr-split-out]');
  const steps = Array.from(split.querySelectorAll<HTMLButtonElement>('[data-pr-split-step]'));
  let barbers = clampBarbers(Number(count?.textContent ?? '4'));
  const state = { n: pricePerBarber(price, barbers) };

  const update = () => {
    if (count) count.textContent = String(barbers);
    steps.forEach((b) => {
      const dir = Number(b.dataset.prSplitStep);
      b.disabled = clampBarbers(barbers + dir) === barbers;
    });
    const to = pricePerBarber(price, barbers);
    if (!out) return;
    if (reducedMotion()) {
      state.n = to;
      out.textContent = formatPounds(to);
      return;
    }
    gsap.to(state, {
      n: to,
      duration: 0.4,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => { out.textContent = formatPounds(state.n); },
      onComplete: () => { out.textContent = formatPounds(to); },
    });
  };

  const onClick = (event: Event) => {
    const dir = Number((event.currentTarget as HTMLButtonElement).dataset.prSplitStep);
    barbers = clampBarbers(barbers + dir);
    update();
  };
  steps.forEach((b) => b.addEventListener('click', onClick));
  update();
  return () => steps.forEach((b) => b.removeEventListener('click', onClick));
}

/* ---------- Comparison table ---------- */

function initTable(root: HTMLElement): () => void {
  const host = root.querySelector<HTMLElement>('[data-pr-table]');
  if (!host) return () => {};
  const radios = Array.from(host.querySelectorAll<HTMLInputElement>('input[name="pricing-compare-plan"]'));
  const more = host.querySelector<HTMLButtonElement>('[data-pr-table-more]');
  const spans = Array.from(host.querySelectorAll<HTMLTableCellElement>('[data-group-span]'));
  const mq = window.matchMedia('(max-width: 47.99rem)');

  const setExpanded = (expanded: boolean) => {
    host.dataset.expanded = String(expanded);
    if (!more) return;
    more.setAttribute('aria-expanded', String(expanded));
    more.textContent = expanded ? 'Show fewer features' : 'Show all features';
  };
  const layout = () => {
    spans.forEach((cell) => { cell.colSpan = mq.matches ? 2 : 3; });
    if (more) more.hidden = !mq.matches;
    setExpanded(!mq.matches);
  };
  const onChange = (event: Event) => {
    const radio = event.currentTarget as HTMLInputElement;
    if (radio.checked) host.dataset.plan = radio.value;
  };
  const onMore = () => setExpanded(host.dataset.expanded !== 'true');

  radios.forEach((r) => r.addEventListener('change', onChange));
  more?.addEventListener('click', onMore);
  mq.addEventListener('change', layout);
  layout();
  return () => {
    radios.forEach((r) => r.removeEventListener('change', onChange));
    more?.removeEventListener('click', onMore);
    mq.removeEventListener('change', layout);
  };
}

/* ---------- Reveals, receipt, steps rail ---------- */

function initReveals(root: HTMLElement): () => void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('.pr-reveal'));
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return () => {};
  }
  // Anything already on screen shows at once (no flash); the rest rises in as it arrives.
  els.forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) el.classList.add('is-in');
  });
  root.dataset.prReveal = 'true';

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        el.classList.add('is-in');
        io.unobserve(el);
        if (el.matches('[data-pr-receipt]')) printReceipt(el);
      });
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  els.filter((el) => !el.classList.contains('is-in')).forEach((el) => io.observe(el));

  const rail = root.querySelector<HTMLElement>('[data-pr-rail]');
  const steps = root.querySelector<HTMLElement>('[data-pr-steps]');
  let railTween: gsap.core.Tween | null = null;
  let railIo: IntersectionObserver | null = null;
  if (rail && steps) {
    railIo = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      railTween = gsap.fromTo(rail, { scaleX: 0, scaleY: 0 }, { scaleX: 1, scaleY: 1, duration: 1.2, ease: 'power2.inOut' });
      railIo?.disconnect();
    }, { threshold: 0.4 });
    railIo.observe(steps);
  }

  return () => {
    io.disconnect();
    railIo?.disconnect();
    railTween?.kill();
  };
}

function printReceipt(receipt: HTMLElement) {
  const lines = receipt.querySelectorAll<HTMLElement>('[data-pr-receipt-line]');
  gsap.fromTo(lines, { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.08, ease: 'power3.out', delay: 0.15, clearProps: 'opacity,visibility,transform' });
}

/* ---------- Mobile sticky CTA ---------- */

function initSticky(root: HTMLElement): () => void {
  const bar = root.querySelector<HTMLElement>('[data-pr-sticky]');
  const hero = root.querySelector<HTMLElement>('.pr-hero__actions');
  const final = root.querySelector<HTMLElement>('[data-pr-final]');
  const footer = root.querySelector<HTMLElement>('footer') ?? document.querySelector<HTMLElement>('footer');
  if (!bar || !hero) return () => {};
  let pastHero = false;
  let nearEnd = false;
  const sync = () => {
    const show = pastHero && !nearEnd;
    bar.dataset.show = String(show);
    bar.setAttribute('aria-hidden', String(!show));
    bar.toggleAttribute('inert', !show);
  };
  const heroIo = new IntersectionObserver(([entry]) => {
    pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    sync();
  });
  heroIo.observe(hero);
  // Track every end marker separately: a callback only carries the entries that changed.
  const past = new Map<Element, boolean>();
  const endIo = new IntersectionObserver((entries) => {
    entries.forEach((entry) => past.set(entry.target, entry.isIntersecting || entry.boundingClientRect.top < 0));
    nearEnd = [...past.values()].some(Boolean);
    sync();
  });
  [final, footer].forEach((el) => el && endIo.observe(el));
  return () => {
    heroIo.disconnect();
    endIo.disconnect();
  };
}

/* ---------- Spotlight on the Full card ---------- */

function initSpot(root: HTMLElement): () => void {
  const card = root.querySelector<HTMLElement>('[data-pr-spot]');
  if (!card || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  const onMove = (event: PointerEvent) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    card.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };
  card.addEventListener('pointermove', onMove);
  return () => card.removeEventListener('pointermove', onMove);
}

export function initPricingPage(root: HTMLElement): () => void {
  const cleanups = [initFeed(root), initFit(root), initSplit(root), initTable(root), initReveals(root), initSticky(root), initSpot(root)];
  return () => cleanups.forEach((cleanup) => cleanup());
}
