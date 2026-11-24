/**
 * Browser behaviour for /barbershop-websites/{city}: the live calculator and the Maps-to-booking tabs.
 * Client-safe: imports only the pure calculator engine. The hero entrance and bar growth are CSS-only,
 * so nothing here is needed for the page to read correctly without JavaScript.
 */
import {
  calculateCityScenario,
  formatCityGbp,
  formatCityGbpRounded,
  type CityCalculatorInputs,
  type CityCalculatorResult,
} from './marketplaceMath';
import { KERSIVO_BOOKING_DEPOSIT_GBP } from '@/lib/seo/defaults';

const REDUCED = '(prefers-reduced-motion: reduce)';
const TWEEN_MS = 320;

type Cleanup = () => void;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED).matches;
}

/** Tweens a money figure in place; snaps when motion is reduced or the element is new. */
function createTweener() {
  const current = new WeakMap<Element, number>();
  const frames = new WeakMap<Element, number>();

  return function set(el: Element | null, value: number, format: (v: number) => string) {
    if (!el) return;
    const from = current.get(el);
    current.set(el, value);
    const pending = frames.get(el);
    if (pending) cancelAnimationFrame(pending);
    if (from === undefined || from === value || prefersReducedMotion()) {
      el.textContent = format(value);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(from + (value - from) * eased);
      if (t < 1) frames.set(el, requestAnimationFrame(step));
      else el.textContent = format(value);
    };
    frames.set(el, requestAnimationFrame(step));
  };
}

function readInputs(form: HTMLFormElement): CityCalculatorInputs {
  const data = new FormData(form);
  const num = (key: string) => Number(data.get(key));
  return {
    price: num('price'),
    barbers: num('barbers'),
    marketplaceClientsPerWeek: num('marketplaceClientsPerWeek'),
    noShowsPerWeek: num('noShowsPerWeek'),
    paymentMode: data.get('paymentMode') === 'full' ? 'full' : 'deposit',
  };
}

function setRangeProgress(input: HTMLInputElement) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const ratio = max > min ? (value - min) / (max - min) : 0;
  input.style.setProperty('--cw-range', `${(ratio * 100).toFixed(2)}%`);
}

function initCalculator(root: HTMLElement): Cleanup | null {
  const form = root.querySelector<HTMLFormElement>('[data-cw-calc]');
  if (!form) return null;
  const tween = createTweener();
  const q = (key: string) => form.querySelector(`[data-cw="${key}"]`);
  const ranges = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="range"]'));

  // The first paint has no previous value, so it snaps; later paints tween from the last value.
  const paint = (r: CityCalculatorResult) => {
    const set = tween;
    const out = (key: string, text: string) => {
      const el = form.querySelector(`[data-cw-out="${key}"]`);
      if (el) el.textContent = text;
    };
    out('price', formatCityGbp(r.inputs.price));
    out('barbers', String(r.inputs.barbers));
    out('marketplaceClientsPerWeek', String(r.inputs.marketplaceClientsPerWeek));
    out('noShowsPerWeek', String(r.inputs.noShowsPerWeek));

    const max = Math.max(r.kersivoMonthly, ...r.competitors.map((c) => c.monthlyTotal));
    const fill = (id: string, value: number) => {
      const el = form.querySelector<HTMLElement>(`[data-cw-fill="${id}"]`);
      el?.style.setProperty('--cw-fill', (max > 0 ? value / max : 0).toFixed(3));
    };
    fill('kersivo', r.kersivoMonthly);

    for (const c of r.competitors) {
      fill(c.id, c.monthlyTotal);
      set(q(`${c.id}-total`), c.monthlyTotal, formatCityGbpRounded);
      set(q(`${c.id}-fee`), c.feePerNewClient, formatCityGbp);
      const match = q(`${c.id}-match`);
      if (match) match.textContent = c.feesToMatchKersivo === null ? '–' : String(c.feesToMatchKersivo);
      const detail = q(`${c.id}-detail`);
      if (detail) {
        detail.textContent =
          c.subscription === null
            ? `${formatCityGbpRounded(c.newClientFeesPerMonth)} in new-client fees, plus a quoted subscription`
            : `${formatCityGbpRounded(c.subscription)} plan + ${formatCityGbpRounded(c.newClientFeesPerMonth)} new-client fees`;
      }
    }

    set(q('lost'), r.noShow.lostPerMonth, formatCityGbpRounded);
    set(q('kept'), r.noShow.keptPerMonth, formatCityGbpRounded);
    const cover = q('cover');
    if (cover) cover.textContent = String(r.noShow.toCoverKersivo);
    const mode = q('mode');
    if (mode) mode.textContent = r.inputs.paymentMode === 'full' ? 'full payment online' : `a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit`;
  };

  paint(calculateCityScenario(readInputs(form)));
  ranges.forEach(setRangeProgress);

  const onInput = (event: Event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'range') setRangeProgress(event.target);
    paint(calculateCityScenario(readInputs(form)));
  };
  const onSubmit = (event: Event) => event.preventDefault();
  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  form.addEventListener('submit', onSubmit);
  form.classList.add('is-live');

  return () => {
    form.removeEventListener('input', onInput);
    form.removeEventListener('change', onInput);
    form.removeEventListener('submit', onSubmit);
  };
}

function initRoute(root: HTMLElement): Cleanup | null {
  const route = root.querySelector<HTMLElement>('[data-cw-route]');
  if (!route) return null;
  const tabs = Array.from(route.querySelectorAll<HTMLButtonElement>('[data-cw-tab]'));
  const panels = Array.from(route.querySelectorAll<HTMLElement>('[data-cw-panel]'));
  if (!tabs.length) return null;

  const select = (index: number, focus: boolean) => {
    const target = tabs[(index + tabs.length) % tabs.length];
    const id = target.dataset.cwTab;
    tabs.forEach((tab) => {
      const on = tab === target;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach((panel) => {
      const on = panel.dataset.cwPanel === id;
      panel.hidden = !on;
      panel.classList.toggle('is-entering', on);
    });
    route.dataset.cwStep = id;
    if (focus) target.focus();
  };

  const onClick = (event: Event) => {
    const tab = (event.target as Element).closest<HTMLButtonElement>('[data-cw-tab]');
    if (tab) select(tabs.indexOf(tab), false);
  };
  const onKey = (event: KeyboardEvent) => {
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    const keys: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    select(keys[event.key], true);
  };

  route.addEventListener('click', onClick);
  route.addEventListener('keydown', onKey);
  route.dataset.cwStep = tabs[0].dataset.cwTab;
  return () => {
    route.removeEventListener('click', onClick);
    route.removeEventListener('keydown', onKey);
  };
}

export function initCityPage(root: HTMLElement): Cleanup {
  const cleanups = [initCalculator(root), initRoute(root)].filter((fn): fn is Cleanup => fn !== null);
  return () => cleanups.forEach((fn) => fn());
}
