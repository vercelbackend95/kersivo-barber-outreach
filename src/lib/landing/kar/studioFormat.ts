/**
 * Formatting and chart geometry for the /barbershop-reports studio, shared by the server render
 * (first paint, no JavaScript needed) and the client script (range and metric switches).
 * Client-safe: no fixture or database imports.
 */
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

/** Normalise to 0..1 against the series maximum (with headroom). */
export function normalise(values: readonly number[]): number[] {
  const max = Math.max(1, ...values) * 1.08;
  return values.map((v) => v / max);
}

/** Smooth line and area paths (Catmull-Rom to cubic Bézier) for normalised y values. */
export function karChartPaths(ys: readonly number[]): { line: string; area: string } {
  const { width: w, height: h, padTop, padBottom } = KAR_CHART;
  const usable = h - padTop - padBottom;
  const pts = ys.map((y, i) => [(i / (ys.length - 1)) * w, padTop + (1 - y) * usable] as const);
  const f = (n: number) => n.toFixed(1);
  let line = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = Math.min(h - padBottom, p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = Math.min(h - padBottom, p2[1] - (p3[1] - p1[1]) / 6);
    line += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`;
  }
  const area = `${line} L${f(w)},${f(h)} L0,${f(h)} Z`;
  return { line, area };
}
