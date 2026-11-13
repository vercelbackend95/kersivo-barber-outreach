/**
 * Client behaviour for the number-led sections of /compare: the team-size cost meter,
 * the new-client fee slider, the KERSIVO vs competitor switcher and the control map reveal.
 * Everything is server-rendered with the default values; this only updates in place.
 * Motion is transform/opacity only and rests completely under prefers-reduced-motion.
 */

export function formatGbp(value: number): string {
  return Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
}

export function feeFor(priceGbp: number, percent: number, minimumGbp: number): number {
  if (percent === 0) return 0;
  return Math.round(Math.max((priceGbp * percent) / 100, minimumGbp) * 100) / 100;
}

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Tween the number shown in `el` to `to`, cancelling any tween already running on it. */
const tweens = new WeakMap<HTMLElement, number>();
function tweenMoney(el: HTMLElement, to: number): void {
  const from = Number(el.dataset.value ?? Number.NaN);
  el.dataset.value = String(to);
  const prev = tweens.get(el);
  if (prev) cancelAnimationFrame(prev);
  if (!Number.isFinite(from) || reducedMotion() || from === to) {
    el.textContent = formatGbp(to);
    return;
  }
  const start = performance.now();
  const duration = 380;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = from + (to - from) * eased;
    el.textContent = t < 1 ? formatGbp(Math.round(v * 100) / 100) : formatGbp(to);
    if (t < 1) tweens.set(el, requestAnimationFrame(step));
  };
  tweens.set(el, requestAnimationFrame(step));
}

function setRangeFill(input: HTMLInputElement): void {
  const min = Number(input.min);
  const max = Number(input.max);
  input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
}

function initMeter(root: HTMLElement): void {
  const range = root.querySelector<HTMLInputElement>('[data-cb-meter-range]');
  if (!range) return;
  const min = Number(root.dataset.min ?? 1);
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-cb-meter-row]')).map((el) => {
    const value = el.querySelector<HTMLElement>('[data-cb-meter-value]')!;
    const series = JSON.parse(el.dataset.series ?? '[]') as number[];
    value.dataset.value = String(series[Number(range.value) - min]);
    return {
      el,
      series,
      name: el.dataset.name ?? '',
      ours: el.dataset.firstParty === 'true',
      value,
      bar: el.querySelector<HTMLElement>('[data-cb-meter-bar]')!,
    };
  });
  const count = root.querySelector<HTMLElement>('[data-cb-meter-count]');
  const unit = root.querySelector<HTMLElement>('[data-cb-meter-unit]');
  const gapN = root.querySelector<HTMLElement>('[data-cb-gap-n]');
  const gapName = root.querySelector<HTMLElement>('[data-cb-gap-name]');
  const gapGbp = root.querySelector<HTMLElement>('[data-cb-gap-gbp]');

  const render = () => {
    const n = Number(range.value);
    const values = rows.map((r) => r.series[n - min]);
    const max = Math.max(...values);
    rows.forEach((r, i) => {
      tweenMoney(r.value, values[i]);
      r.bar.style.setProperty('--scale', (values[i] / max).toFixed(4));
    });
    const label = n === 1 ? 'barber' : 'barbers';
    if (count) count.textContent = String(n);
    if (unit) unit.textContent = label;
    range.setAttribute('aria-valuetext', `${n} ${label}`);
    setRangeFill(range);

    const ours = rows.find((r) => r.ours);
    const others = rows.filter((r) => !r.ours);
    if (ours && others.length && gapN && gapName && gapGbp) {
      const priciest = others.reduce((a, b) => (b.series[n - min] > a.series[n - min] ? b : a));
      const gap = Math.round((priciest.series[n - min] - ours.series[n - min]) * 12 * 100) / 100;
      gapN.textContent = String(n);
      gapName.textContent = priciest.name;
      tweenMoney(gapGbp, gap);
    }
  };

  if (gapGbp) gapGbp.dataset.value = (gapGbp.textContent ?? '').replace(/[£,]/g, '');
  range.addEventListener('input', render);
  root.querySelectorAll<HTMLButtonElement>('[data-cb-meter-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = Math.min(Number(range.max), Math.max(Number(range.min), Number(range.value) + Number(button.dataset.cbMeterStep)));
      range.value = String(next);
      render();
    });
  });
}

function initFees(root: HTMLElement): void {
  const range = root.querySelector<HTMLInputElement>('[data-cb-fees-range]');
  if (!range) return;
  const price = root.querySelector<HTMLElement>('[data-cb-fees-price]');
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-cb-fee-row]')).map((el) => {
    const value = el.querySelector<HTMLElement>('[data-cb-fee-value]')!;
    const percent = Number(el.dataset.percent ?? 0);
    const minimum = Number(el.dataset.minimum ?? 0);
    value.dataset.value = String(feeFor(Number(range.value), percent, minimum));
    return { value, percent, minimum };
  });
  range.addEventListener('input', () => {
    const p = Number(range.value);
    if (price) price.textContent = formatGbp(p);
    range.setAttribute('aria-valuetext', `£${p}`);
    setRangeFill(range);
    rows.forEach((r) => tweenMoney(r.value, feeFor(p, r.percent, r.minimum)));
  });
}

function initDuel(root: HTMLElement): void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-cb-duel-tab]'));
  const panels = new Map(
    Array.from(root.querySelectorAll<HTMLElement>('[data-cb-duel-panel]')).map((p) => [p.dataset.cbDuelPanel, p]),
  );

  const select = (tab: HTMLButtonElement, focus: boolean) => {
    const id = tab.dataset.cbDuelTab;
    if (tab.getAttribute('aria-selected') === 'true') return;
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((panel, key) => {
      panel.hidden = key !== id;
    });
    if (focus) tab.focus();
    const panel = id ? panels.get(id) : undefined;
    if (!panel || reducedMotion()) return;
    // KERSIVO's column is identical in every panel, so only the competitor's cells move.
    panel.querySelectorAll<HTMLElement>('td.cb-duel__them, th.cb-duel__them').forEach((cell, i) => {
      cell.animate(
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 260, delay: i * 35, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' },
      );
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', (event) => {
      const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let next: number | null = null;
      if (event.key in keys) next = (index + keys[event.key] + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      select(tabs[next], true);
    });
  });
}

function initControl(root: HTMLElement): void {
  if (reducedMotion() || !('IntersectionObserver' in window)) return;
  const rect = root.getBoundingClientRect();
  // Already on screen (deep link, reload mid-page): show it at rest.
  if (rect.top < window.innerHeight * 0.85) return;
  root.dataset.armed = 'true';
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      root.classList.add('is-in');
      observer.disconnect();
    },
    { threshold: 0.25 },
  );
  observer.observe(root);
}

export function initBestCompare(doc: Document = document): void {
  const once = (selector: string, init: (el: HTMLElement) => void) => {
    doc.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (el.dataset.cbReady === 'true') return;
      el.dataset.cbReady = 'true';
      init(el);
    });
  };
  once('[data-cb-meter]', initMeter);
  once('[data-cb-fees]', initFees);
  once('[data-cb-duel]', initDuel);
  once('[data-cb-control]', initControl);
}
