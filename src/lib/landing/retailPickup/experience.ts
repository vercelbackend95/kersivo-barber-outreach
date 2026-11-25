/**
 * /barbershop-retail-pickup interactions.
 * - Hero: lines rise once on load; the three.js scene loads after first paint and follows pointer + scroll.
 * - Payment switch: two native radios choose the mode; the checkout mock, the points and the comparison
 *   table follow the choice (main[data-mode]).
 * - Journey (the page's dealt moment): on wide screens with motion allowed the section pins and scroll
 *   walks the four chapters; the chapter buttons work everywhere and are the only control on phones
 *   and under reduced motion.
 * - Counter: a working Orders view. Collect / Take payment move an order to Collected and only paid
 *   orders add to Sales.
 * Under prefers-reduced-motion nothing is hidden, nothing pins and nothing loops.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { RetailHeroScene } from './heroScene';

gsap.registerPlugin(ScrollTrigger);

type Cleanup = () => void;

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const gbp = (pence: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);

/* ---------- Hero ---------- */

function initHero(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const hero = root.querySelector<HTMLElement>('[data-rp-hero]');
  if (!hero) return;

  if (!reduced) {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(hero.querySelectorAll('[data-rp-rise]'), { y: 0, yPercent: 108 }, { yPercent: 0, duration: 1.15, stagger: 0.12 }, 0.05)
      .fromTo(
        hero.querySelectorAll('[data-rp-enter]'),
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out' },
        0.4,
      )
      .fromTo(hero.querySelector('[data-rp-visual]'), { autoAlpha: 0, scale: 0.95 }, { autoAlpha: 1, scale: 1, duration: 1.5, ease: 'power2.out' }, 0.15)
      .fromTo(
        hero.querySelector('[data-rp-ticket]'),
        { autoAlpha: 0, y: 24, rotate: -2 },
        { autoAlpha: 1, y: 0, rotate: 0, duration: 1, ease: 'back.out(1.4)' },
        0.9,
      );
    disposers.push(() => tl.kill());
  }
  hero.classList.add('is-in');

  const canvas = hero.querySelector<HTMLCanvasElement>('[data-rp-canvas]');
  const visual = hero.querySelector<HTMLElement>('[data-rp-visual]');
  if (!canvas || !visual) return;

  let scene: RetailHeroScene | null = null;
  let disposed = false;
  let inView = true;
  const updateRunning = () => scene?.setRunning(inView && document.visibilityState === 'visible');
  const onVisibility = () => updateRunning();
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const rect = hero.getBoundingClientRect();
    scene?.setPointer(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateRunning();
  });

  const start = async () => {
    try {
      const { createRetailHeroScene } = await import('./heroScene');
      if (disposed) return;
      scene = createRetailHeroScene(canvas, { reducedMotion: reduced });
    } catch {
      scene = null;
    }
    if (!scene) {
      visual.classList.add('is-fallback');
      return;
    }
    visual.classList.add('is-live');
    io.observe(hero);
    document.addEventListener('visibilitychange', onVisibility);
    hero.addEventListener('pointermove', onPointer);
    updateRunning();

    const ticket = hero.querySelector<HTMLElement>('[data-rp-ticket]');
    const st = ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: 'bottom top',
      onUpdate: (self) => {
        scene?.setProgress(self.progress);
        if (ticket) ticket.classList.toggle('is-collected', self.progress > 0.45);
      },
    });
    disposers.push(() => st.kill());
  };

  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
  const handle = idle(() => void start());

  disposers.push(() => {
    disposed = true;
    if (window.cancelIdleCallback && typeof handle === 'number') window.cancelIdleCallback(handle);
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    hero.removeEventListener('pointermove', onPointer);
    scene?.dispose();
    scene = null;
  });
}

/* ---------- Payment mode switch ---------- */

function initModes(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-rp-modes]');
  if (!section) return;
  const radios = Array.from(section.querySelectorAll<HTMLInputElement>('input[name="rp-mode"]'));
  const panels = Array.from(section.querySelectorAll<HTMLElement>('[data-rp-mode-panel]'));
  const views = Array.from(section.querySelectorAll<HTMLElement>('[data-rp-mode-view]'));

  const apply = (mode: string, animate: boolean) => {
    root.dataset.mode = mode;
    panels.forEach((panel) => {
      const active = panel.dataset.rpModePanel === mode;
      panel.hidden = !active;
      if (active && animate && !reduced) {
        gsap.fromTo(panel.querySelectorAll('li'), { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out' });
      }
    });
    views.forEach((view) => {
      const active = view.dataset.rpModeView === mode;
      view.hidden = !active;
      if (active && animate && !reduced) {
        gsap.fromTo(view, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' });
      }
    });
  };

  const onChange = (event: Event) => apply((event.target as HTMLInputElement).value, true);
  radios.forEach((radio) => radio.addEventListener('change', onChange));
  apply(radios.find((radio) => radio.checked)?.value ?? 'upfront', false);
  disposers.push(() => radios.forEach((radio) => radio.removeEventListener('change', onChange)));
}

/* ---------- Journey: the pinned moment ---------- */

function initJourney(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-rp-journey]');
  if (!section) return;
  const buttons = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-rp-chapter]'));
  const frame = section.querySelector<HTMLElement>('[data-rp-frame]');
  const screens = Array.from(section.querySelectorAll<HTMLElement>('[data-rp-screen]'));
  const bar = section.querySelector<HTMLElement>('[data-rp-progress]');
  if (!buttons.length || !frame) return;

  let index = -1;
  let pin: ScrollTrigger | null = null;

  const show = (next: number, animate = true) => {
    if (next === index) return;
    const prev = index;
    index = next;
    buttons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(i === next));
      button.closest('li')?.classList.toggle('is-active', i === next);
      button.closest('li')?.classList.toggle('is-done', i < next);
    });
    frame.dataset.step = String(next);
    screens.forEach((screen, i) => {
      const active = i === next;
      screen.setAttribute('aria-hidden', String(!active));
      // A fast scroll can pass several chapters while a swap is still running: stop it first.
      gsap.killTweensOf(screen);
      gsap.killTweensOf(screen.querySelectorAll('[data-rp-pop]'));
      if (reduced || !animate || prev < 0) {
        gsap.set(screen, { autoAlpha: active ? 1 : 0, y: 0, scale: 1 });
        return;
      }
      if (active) {
        gsap.fromTo(screen, { autoAlpha: 0, y: next > prev ? 28 : -28, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'expo.out' });
        gsap.fromTo(screen.querySelectorAll('[data-rp-pop]'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, delay: 0.15, ease: 'power3.out' });
      } else if (i === prev) {
        gsap.to(screen, { autoAlpha: 0, y: next > prev ? -20 : 20, duration: 0.35, ease: 'power2.in' });
      } else {
        gsap.set(screen, { autoAlpha: 0 });
      }
    });
  };

  const onClick = (event: Event) => {
    const i = buttons.indexOf(event.currentTarget as HTMLButtonElement);
    if (i < 0) return;
    if (pin) {
      // Scroll to the chapter's slice of the pinned range so scroll and state agree.
      const target = pin.start + ((pin.end - pin.start) * (i + 0.5)) / buttons.length;
      window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
    }
    show(i);
  };
  buttons.forEach((button) => button.addEventListener('click', onClick));
  show(0, false);

  const mm = gsap.matchMedia();
  if (!reduced) {
    mm.add('(min-width: 1024px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)', () => {
      section.classList.add('is-pinned');
      pin = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${window.innerHeight * (buttons.length - 0.4)}`,
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const i = Math.min(buttons.length - 1, Math.floor(self.progress * buttons.length));
          show(i);
          if (bar) bar.style.transform = `scaleX(${self.progress})`;
        },
      });
      return () => {
        section.classList.remove('is-pinned');
        pin?.kill();
        pin = null;
      };
    });
  }

  disposers.push(() => {
    buttons.forEach((button) => button.removeEventListener('click', onClick));
    mm.revert();
  });
}

/* ---------- Counter simulator ---------- */

function initCounter(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-rp-counter]');
  if (!section) return;
  const rows = Array.from(section.querySelectorAll<HTMLElement>('[data-rp-order]'));
  const filters = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-rp-filter]'));
  const sales = section.querySelector<HTMLElement>('[data-rp-sales]');
  const salesCount = section.querySelector<HTMLElement>('[data-rp-sales-count]');
  const openCount = section.querySelector<HTMLElement>('[data-rp-open-count]');
  const doneCount = section.querySelector<HTMLElement>('[data-rp-done-count]');
  const reserved = section.querySelector<HTMLElement>('[data-rp-reserved]');
  const announce = section.querySelector<HTMLElement>('[data-rp-announce]');
  const reset = section.querySelector<HTMLButtonElement>('[data-rp-reset]');
  const empty = section.querySelector<HTMLElement>('[data-rp-empty]');

  type OrderState = { el: HTMLElement; total: number; paid: boolean; collected: boolean; reference: string };
  const orders: OrderState[] = rows.map((el) => ({
    el,
    total: Number(el.dataset.total ?? 0),
    paid: el.dataset.paid === 'true',
    collected: false,
    reference: el.dataset.reference ?? '',
  }));
  const initial = orders.map((o) => ({ paid: o.paid }));
  let filter = 'open';
  const shown = { sales: 0 };

  // Paid online counts from checkout; a reservation counts once payment is taken at the counter.
  const salesTotal = () => orders.filter((o) => o.paid).reduce((sum, o) => sum + o.total, 0);

  const render = (animateSales: boolean) => {
    const open = orders.filter((o) => !o.collected).length;
    if (openCount) openCount.textContent = String(open);
    if (doneCount) doneCount.textContent = String(orders.length - open);
    const unpaidTotal = orders.filter((o) => !o.paid).reduce((sum, o) => sum + o.total, 0);
    if (reserved) reserved.textContent = gbp(unpaidTotal);
    const paidCount = orders.filter((o) => o.paid).length;
    if (salesCount) salesCount.textContent = `${paidCount} paid ${paidCount === 1 ? 'order' : 'orders'}`;

    orders.forEach((order) => {
      const visible = filter === 'all' || (filter === 'open' ? !order.collected : order.collected);
      order.el.hidden = !visible;
      order.el.dataset.state = order.collected ? 'collected' : order.paid ? 'paid' : 'unpaid';
    });
    if (empty) empty.hidden = orders.some((o) => !o.el.hidden);
    filters.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.rpFilter === filter)));

    const total = salesTotal();
    if (!sales) return;
    if (reduced || !animateSales) {
      shown.sales = total;
      sales.textContent = gbp(total);
      return;
    }
    gsap.to(shown, {
      sales: total,
      duration: 0.9,
      ease: 'power3.out',
      onUpdate: () => {
        sales.textContent = gbp(Math.round(shown.sales));
      },
    });
    gsap.fromTo(sales, { color: '#ffffff', y: -4 }, { color: '', y: 0, duration: 0.5, ease: 'power3.out' });
  };

  const onAction = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-rp-action]');
    if (!button) return;
    const order = orders.find((o) => o.el.contains(button));
    if (!order || order.collected) return;
    const wasUnpaid = !order.paid;
    order.paid = true;
    order.collected = true;
    if (announce) {
      announce.textContent = wasUnpaid
        ? `${order.reference}: payment taken, marked paid and collected. Sales now ${gbp(salesTotal())}.`
        : `${order.reference}: marked collected.`;
    }
    const finish = () => {
      render(true);
      // Keep keyboard focus inside the table after the row leaves the To collect filter.
      const next = orders.find((o) => !o.el.hidden && !o.collected)?.el.querySelector<HTMLButtonElement>('[data-rp-action]');
      (next ?? filters.find((f) => f.dataset.rpFilter === 'collected') ?? null)?.focus({ preventScroll: true });
    };
    if (reduced || filter === 'all') {
      finish();
      return;
    }
    order.el.dataset.state = 'collected';
    gsap.to(order.el, { autoAlpha: 0, x: 24, duration: 0.35, delay: 0.35, ease: 'power2.in', onComplete: () => {
      gsap.set(order.el, { clearProps: 'opacity,visibility,transform' });
      finish();
    } });
  };

  const onFilter = (event: Event) => {
    filter = (event.currentTarget as HTMLButtonElement).dataset.rpFilter ?? 'open';
    render(false);
  };

  const onReset = () => {
    orders.forEach((order, i) => {
      order.paid = initial[i]!.paid;
      order.collected = false;
    });
    filter = 'open';
    if (announce) announce.textContent = 'Counter reset: three orders to collect.';
    render(true);
  };

  section.addEventListener('click', onAction);
  filters.forEach((button) => button.addEventListener('click', onFilter));
  reset?.addEventListener('click', onReset);
  render(false);

  disposers.push(() => {
    section.removeEventListener('click', onAction);
    filters.forEach((button) => button.removeEventListener('click', onFilter));
    reset?.removeEventListener('click', onReset);
  });
}

/* ---------- Entry ---------- */

export function initRetailPickup(root: HTMLElement): Cleanup {
  const reduced = prefersReduced();
  const disposers: Cleanup[] = [];

  initHero(root, reduced, disposers);
  initModes(root, reduced, disposers);
  initJourney(root, reduced, disposers);
  initCounter(root, reduced, disposers);

  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh).catch(() => {});
  window.addEventListener('load', refresh, { once: true });

  return () => {
    window.removeEventListener('load', refresh);
    disposers.reverse().forEach((dispose) => dispose());
    document.documentElement.classList.remove('rp-js');
    delete root.dataset.rpBound;
  };
}
