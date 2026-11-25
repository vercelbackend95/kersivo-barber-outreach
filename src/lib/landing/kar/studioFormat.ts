/**
 * Formatting and chart geometry for the /barbershop-reports studio, shared by the server render
 * (first paint, no JavaScript needed) and the client script (range and metric switches).
 * Client-safe: no fixture or database imports.
 */
import { buildSmoothPath, niceTicks } from '@/lib/admin/chartUtils';
import type { KarStudioRange } from './reportsDemo';

export type KarMetricKey = 'bookings' | 'value';
export type KarTone = 'good' | 'bad' | 'flat';
export type KarKpi = { value: string; delta: string; tone: KarTone };

export const KAR_CHART = { width: 640, height: 220, padTop: 16, padBottom: 6, points: 48 } as const;

const gbp = (n: number, digits = 2) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const num = (n: number) => new Intl.NumberFormat('en-GB').format(n);
const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`;

/** higherIsGood: bookings, utilisation, value. Rates of cancellations and no-shows are the reverse. */
const tone = (delta: number | null, higherIsGood: boolean): KarTone => {
  if (delta === null || Math.abs(delta) < 0.05) return 'flat';
  return delta > 0 === higherIsGood ? 'good' : 'bad';
};

export function karKpis(r: KarStudioRange): Record<'bookings' | 'utilisation' | 'value' | 'cancelled' | 'noshow', KarKpi> {
  return {
    bookings: {
      value: num(r.bookings),
      delta: r.bookingsTrendPct === null ? 'No earlier period' : `${signed(r.bookingsTrendPct)}% vs previous`,
      tone: tone(r.bookingsTrendPct, true),
    },
    utilisation: {
      value: r.utilisationPct === null ? '—' : `${r.utilisationPct.toFixed(1)}%`,
      delta: r.utilisationPp === null ? 'No earlier period' : `${signed(r.utilisationPp)} pts vs previous`,
      tone: tone(r.utilisationPp, true),
    },
    value: {
      value: r.avgValueGbp === null ? '—' : gbp(r.avgValueGbp),
      delta: r.avgValueGbp === null ? 'No completed bookings yet' : `${r.avgValueDeltaGbp > 0 ? '+' : r.avgValueDeltaGbp < 0 ? '−' : '±'}${gbp(Math.abs(r.avgValueDeltaGbp))} vs previous`,
      tone: r.avgValueGbp === null ? 'flat' : tone(r.avgValueDeltaGbp, true),
    },
    cancelled: {
      value: `${r.cancelledRatePct.toFixed(1)}%`,
      delta: `${signed(r.cancelledRatePp)} pts vs previous`,
      tone: tone(r.cancelledRatePp, false),
    },
    noshow: {
      value: `${r.noShowRatePct.toFixed(1)}%`,
      delta: `${signed(r.noShowRatePp)} pts vs previous`,
      tone: tone(r.noShowRatePp, false),
    },
  };
}

export const karMetricTotal = (r: KarStudioRange, metric: KarMetricKey) => {
  const sum = r.series[metric].reduce((a, b) => a + b, 0);
  return metric === 'value' ? gbp(sum, 0) : num(sum);
};

/** Resample a series to a fixed number of points so any two ranges can morph into each other. */
export function resample(values: readonly number[], n: number = KAR_CHART.points): number[] {
  if (values.length === 0) return new Array<number>(n).fill(0);
  if (values.length === 1) return new Array<number>(n).fill(values[0]);
  return Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * (values.length - 1);
    const lo = Math.floor(x);
    const hi = Math.min(values.length - 1, lo + 1);
    return values[lo] + (values[hi] - values[lo]) * (x - lo);
  });
}

/** Normalise to 0..1 against `max` (default: the series maximum with headroom). */
export function normalise(values: readonly number[], max?: number): number[] {
  const top = max && max > 0 ? max : Math.max(1, ...values) * 1.08;
  return values.map((v) => v / top);
}

export type KarScale = { max: number; ticks: { label: string; y: number }[] };

/**
 * Round axis for the film's Reports chart, the same "nice" ticks the dashboard uses, so a gridline
 * carries a real figure. `y` is the tick's position as a percentage from the top of the chart box.
 */
export function karScale(values: readonly number[], metric: KarMetricKey): KarScale {
  const { max, ticks } = niceTicks(0, Math.max(metric === 'value' ? 10 : 2, ...values), 3);
  const { height: h, padTop, padBottom } = KAR_CHART;
  const usable = h - padTop - padBottom;
  const fmt = (v: number) => (metric === 'value' ? gbp(v, 0) : num(Math.round(v)));
  const seen = new Set<string>();
  return {
    max,
    ticks: ticks
      .map((v) => ({ label: fmt(v), y: ((padTop + (1 - v / max) * usable) / h) * 100 }))
      .filter((t) => (seen.has(t.label) ? false : (seen.add(t.label), true))),
  };
}

/** Where point i of n sits in the chart box, as percentages (for HTML markers over a stretched SVG). */
export function karPointPercent(ys: readonly number[], i: number): { x: number; y: number } {
  const { height: h, padTop, padBottom } = KAR_CHART;
  const usable = h - padTop - padBottom;
  return {
    x: ys.length <= 1 ? 50 : (i / (ys.length - 1)) * 100,
    y: ((padTop + (1 - (ys[i] ?? 0)) * usable) / h) * 100,
  };
}

/** Smooth line and area paths for normalised y values: the dashboard's monotone curve (no overshoot). */
export function karChartPaths(ys: readonly number[]): { line: string; area: string } {
  const { width: w, height: h, padTop, padBottom } = KAR_CHART;
  const usable = h - padTop - padBottom;
  const pts = ys.map((y, i) => ({
    x: Math.round((i / Math.max(1, ys.length - 1)) * w * 10) / 10,
    y: Math.round((padTop + (1 - y) * usable) * 10) / 10,
  }));
  const line = buildSmoothPath(pts);
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area };
}
