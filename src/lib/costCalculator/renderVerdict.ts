/**
 * Renders the live verdict, ranked cost bars and mobile result dock from a CostVerdict.
 * Motion is presentation only: bar lengths ease, rows slide to their new rank (FLIP) and the
 * KERSIVO figure counts to its new value. Under prefers-reduced-motion every change is instant.
 */

import type { CostPeriod } from './costPeriod';
import { formatMoneyGbp } from './money';
import type { CostVerdict } from './costVerdict';

const PERIOD_SUFFIX: Record<CostPeriod, string> = {
  monthly: 'a month',
  annual: 'over 12 months',
  threeYear: 'over 3 years',
};

const COUNT_MS = 520;
const FLIP_MS = 420;
const ANNOUNCE_DELAY_MS = 900;

type Animated = HTMLElement & { _countFrom?: number; _countRaf?: number; _countTimer?: ReturnType<typeof setTimeout> };

function reducedMotion(doc: Document): boolean {
  return doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
}

function setText(element: Element | null, text: string) {
  if (element && element.textContent !== text) element.textContent = text;
}

function countTo(element: Animated | null, target: number | null, reduce: boolean) {
  if (!element) return;
  const win = element.ownerDocument.defaultView;
  if (target === null) {
    element._countFrom = undefined;
    setText(element, '£—');
    return;
  }
  const from = element._countFrom;
  element._countFrom = target;
  if (reduce || from === undefined || from === target || !win?.requestAnimationFrame) {
    setText(element, formatMoneyGbp(target));
    return;
  }
  if (element._countRaf) win.cancelAnimationFrame(element._countRaf);
  clearTimeout(element._countTimer);
  // rAF pauses in background tabs: always land on the final value.
  element._countTimer = setTimeout(() => {
    if (element._countRaf) win.cancelAnimationFrame(element._countRaf);
    setText(element, formatMoneyGbp(target));
  }, COUNT_MS + 80);
  const start = win.performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / COUNT_MS);
    const eased = 1 - (1 - t) ** 4;
    const value = Math.round((from + (target - from) * eased) * 100) / 100;
    setText(element, formatMoneyGbp(t === 1 ? target : value));
    if (t < 1) element._countRaf = win.requestAnimationFrame(step);
  };
  element._countRaf = win.requestAnimationFrame(step);
}

function renderBars(list: HTMLElement, verdict: CostVerdict, reduce: boolean) {
  const rows = [...list.querySelectorAll<HTMLElement>('[data-bar]')];
  const before = new Map(rows.filter((row) => !row.hidden).map((row) => [row, row.getBoundingClientRect().top]));

  rows.forEach((row) => {
    const index = verdict.bars.findIndex((bar) => bar.id === row.dataset.bar);
    const bar = verdict.bars[index];
    row.hidden = !bar;
    if (!bar) return;
    row.style.order = String(index);
    row.style.setProperty('--share', bar.share.toFixed(4));
    setText(row.querySelector('[data-bar-value]'), formatMoneyGbp(bar.amountGbp));
  });

  if (reduce) return;
  for (const [row, top] of before) {
    if (row.hidden || typeof row.animate !== 'function') continue;
    const delta = top - row.getBoundingClientRect().top;
    if (Math.abs(delta) < 1) continue;
    row.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], {
      duration: FLIP_MS,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
  }
}

function setList(list: Element | null, items: readonly string[]) {
  if (!list) return;
  const current = [...list.children].map((child) => child.textContent);
  if (current.length === items.length && current.every((text, index) => text === items[index])) return;
  list.replaceChildren(
    ...items.map((text) => {
      const item = list.ownerDocument.createElement('li');
      item.textContent = text;
      return item;
    }),
  );
}

const announceTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function renderVerdict(results: HTMLElement, verdict: CostVerdict, period: CostPeriod) {
  const doc = results.ownerDocument;
  const reduce = reducedMotion(doc);
  const root = doc.querySelector<HTMLElement>('[data-calc-verdict]') ?? results;
  root.dataset.state = verdict.ok ? 'ready' : 'invalid';

  countTo(root.querySelector<Animated>('[data-verdict="kersivo"]'), verdict.kersivoGbp, reduce);
  for (const node of doc.querySelectorAll('[data-verdict="period"]')) setText(node, PERIOD_SUFFIX[period]);
  setText(root.querySelector('[data-verdict="headline"]'), verdict.headline);
  if (verdict.ok) setList(root.querySelector('[data-verdict="lines"]'), verdict.lines);

  const quote = root.querySelector<HTMLElement>('[data-verdict="quote"]');
  if (quote) {
    quote.hidden = verdict.quoteNeeded.length === 0;
    setText(quote.querySelector('[data-verdict="quote-names"]'), verdict.quoteNeeded.join(' · '));
  }

  // Invalid input keeps the last bars on screen (dimmed by CSS) so the layout does not jump.
  const bars = root.querySelector<HTMLElement>('[data-calc-bars]');
  if (bars && verdict.ok) renderBars(bars, verdict, reduce);

  const dock = doc.querySelector<HTMLElement>('[data-calc-dock]');
  if (dock) {
    countTo(dock.querySelector<Animated>('[data-dock="kersivo"]'), verdict.kersivoGbp, reduce);
    const top = verdict.bars.find((bar) => !bar.isKersivo);
    setText(dock.querySelector('[data-dock="top"]'), top ? `${top.name} ${formatMoneyGbp(top.amountGbp)}` : '');
  }

  const status = root.querySelector<HTMLElement>('[data-verdict="status"]');
  if (status) {
    clearTimeout(announceTimers.get(status));
    announceTimers.set(
      status,
      setTimeout(() => {
        const text = verdict.ok && verdict.kersivoGbp !== null
          ? `Full KERSIVO ${formatMoneyGbp(verdict.kersivoGbp)} ${PERIOD_SUFFIX[period]}. ${verdict.headline}`
          : verdict.headline;
        setText(status, text);
      }, ANNOUNCE_DELAY_MS),
    );
  }
}
