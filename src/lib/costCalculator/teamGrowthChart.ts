/**
 * Team-size chart on /barber-software-cost-calculator: a slider moves a marker across
 * server-rendered engine series, and the lines draw once when the chart first scrolls into view.
 * Values come only from the data attribute the server rendered from the engine.
 */

import { formatMoneyGbp } from './money';

type ChartData = {
  series: { id: string; label: string; points: number[] }[];
  yMax: number;
  geometry: { W: number; H: number; PAD: { top: number; right: number; bottom: number; left: number }; max: number };
};

const READY = 'growthReady';

export function initTeamGrowthChart(root: Document) {
  for (const chart of root.querySelectorAll<HTMLElement>('[data-cost-growth]')) {
    if (chart.dataset[READY]) continue;
    chart.dataset[READY] = 'true';

    let data: ChartData;
    try {
      data = JSON.parse(chart.dataset.chart ?? '');
    } catch {
      continue;
    }
    const { W, H, PAD, max } = data.geometry;
    const x = (count: number) => PAD.left + ((count - 1) / (max - 1)) * (W - PAD.left - PAD.right);
    const y = (gbp: number) => PAD.top + (1 - gbp / data.yMax) * (H - PAD.top - PAD.bottom);

    const range = chart.querySelector<HTMLInputElement>('[data-growth-range]');
    const count = chart.querySelector<HTMLOutputElement>('[data-growth-count]');
    const marker = chart.querySelector<SVGLineElement>('[data-growth-marker]');
    const readout = chart.querySelector<HTMLOListElement>('[data-growth-readout]');
    if (!range || !readout) continue;

    const update = () => {
      const barbers = Math.min(max, Math.max(1, Number(range.value) || 1));
      if (count) count.textContent = String(barbers);
      marker?.setAttribute('x1', String(x(barbers)));
      marker?.setAttribute('x2', String(x(barbers)));
      for (const entry of data.series) {
        const dot = chart.querySelector<SVGCircleElement>(`[data-series="${entry.id}"] [data-growth-dot]`);
        dot?.setAttribute('cx', String(x(barbers)));
        dot?.setAttribute('cy', String(y(entry.points[barbers - 1])));
      }
      const rows = [...data.series]
        .map((entry) => ({ entry, gbp: entry.points[barbers - 1] }))
        .sort((a, b) => b.gbp - a.gbp);
      readout.replaceChildren(
        ...rows.map(({ entry, gbp }) => {
          const item = root.createElement('li');
          if (entry.id === 'kersivo') item.dataset.kersivo = 'true';
          const name = root.createElement('span');
          name.textContent = entry.label;
          const value = root.createElement('strong');
          value.textContent = formatMoneyGbp(gbp);
          item.append(name, value);
          return item;
        }),
      );
      range.setAttribute('aria-valuetext', `${barbers} bookable ${barbers === 1 ? 'barber' : 'barbers'}`);
    };
    range.addEventListener('input', update);
    update();

    // Draw the lines once, the first time the chart is on screen.
    const win = root.defaultView;
    const reduce = win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !win || typeof win.IntersectionObserver !== 'function') continue;
    chart.dataset.draw = 'armed';
    const observer = new win.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        chart.dataset.draw = 'run';
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(chart);
  }
}
