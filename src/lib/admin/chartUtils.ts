export type ChartPoint = { x: number; y: number };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAY_SET = new Set<string>(WEEKDAY_ORDER);

function parseIsoDateLabel(label: string): number | null {
  if (!ISO_DATE_RE.test(label)) return null;
  const ts = Date.parse(`${label}T00:00:00`);
  return Number.isNaN(ts) ? null : ts;
}

function isIsoDateLabels(labels: string[]): boolean {
  return labels.length > 0 && labels.every((label) => parseIsoDateLabel(label) !== null);
}

function isWeekdayLabels(labels: string[]): boolean {
  return labels.length > 0 && labels.every((label) => WEEKDAY_SET.has(label));
}

function isWeekBucketLabels(labels: string[]): boolean {
  return labels.length > 0 && labels.every((label) => label.includes('W'));
}

/** Sort chart X labels in chronological order (not alphabetical). */
export function sortChartLabels(labels: string[]): string[] {
  if (labels.length <= 1) return [...labels];

  const unique = Array.from(new Set(labels));

  if (unique.every((label) => /^\d{2}:00$/.test(label))) {
    return unique.sort((a, b) => a.localeCompare(b));
  }

  if (isIsoDateLabels(unique)) {
    return unique.sort((a, b) => (parseIsoDateLabel(a) ?? 0) - (parseIsoDateLabel(b) ?? 0));
  }

  if (isWeekdayLabels(unique)) {
    return unique.sort(
      (a, b) => WEEKDAY_ORDER.indexOf(a as (typeof WEEKDAY_ORDER)[number])
        - WEEKDAY_ORDER.indexOf(b as (typeof WEEKDAY_ORDER)[number]),
    );
  }

  if (isWeekBucketLabels(unique)) {
    return unique.sort((a, b) => a.localeCompare(b));
  }

  const firstSeen = new Map<string, number>();
  for (let i = 0; i < labels.length; i += 1) {
    if (!firstSeen.has(labels[i])) firstSeen.set(labels[i], i);
  }
  return unique.sort((a, b) => (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0));
}

/** Compute "nice" axis bounds and tick values for readable Y-axis labels. */
export function niceTicks(
  rawMin: number,
  rawMax: number,
  tickCount = 3,
): { min: number; max: number; ticks: number[] } {
  if (rawMin === rawMax) {
    const pad = rawMax === 0 ? 1 : Math.abs(rawMax) * 0.1;
    return niceTicks(rawMin - pad, rawMax + pad, tickCount);
  }

  const range = niceNum(rawMax - rawMin, false);
  const step = niceNum(range / tickCount, true);
  const niceMin = Math.floor(rawMin / step) * step;
  const niceMax = Math.ceil(rawMax / step) * step;

  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }

  return { min: niceMin, max: niceMax, ticks };
}

function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let niceFraction: number;

  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;

  return niceFraction * 10 ** exponent;
}

/** Snap mouse X position to nearest label index. */
export function snapIndex(
  svgMouseX: number,
  paddingLeft: number,
  innerW: number,
  labelCount: number,
): number {
  if (labelCount <= 1) return 0;
  const rawIdx = ((svgMouseX - paddingLeft) / innerW) * (labelCount - 1);
  return Math.max(0, Math.min(labelCount - 1, Math.round(rawIdx)));
}

/**
 * Monotone-in-x tangents (Steffen 1990, as d3.curveMonotoneX). Unlike Catmull-Rom, the curve
 * never overshoots its data: a day with £0 never dips below the baseline and a peak is never
 * drawn higher than it was.
 */
function monotoneTangents(points: ChartPoint[]): number[] {
  const n = points.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const h = points[i + 1].x - points[i].x;
    slopes.push(h === 0 ? 0 : (points[i + 1].y - points[i].y) / h);
  }
  const tangents = new Array<number>(n).fill(0);
  tangents[0] = slopes[0] ?? 0;
  tangents[n - 1] = slopes[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i += 1) {
    const s0 = slopes[i - 1];
    const s1 = slopes[i];
    if (s0 * s1 <= 0) continue;
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    tangents[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
  }
  // Ends: clamp so the first and last segments cannot overshoot either.
  if (n > 2) {
    tangents[0] = Math.sign(slopes[0]) !== Math.sign(tangents[1]) ? 0 : Math.min(Math.abs(slopes[0]), Math.abs(tangents[1])) * Math.sign(slopes[0]);
    tangents[n - 1] = Math.sign(slopes[n - 2]) !== Math.sign(tangents[n - 2]) ? 0 : Math.min(Math.abs(slopes[n - 2]), Math.abs(tangents[n - 2])) * Math.sign(slopes[n - 2]);
  }
  return tangents;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Build a monotone cubic-bezier smooth path through points (no overshoot). */
export function buildSmoothPath(points: ChartPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const tangents = monotoneTangents(points);
  const segments: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const third = (p2.x - p1.x) / 3;
    const cp1x = round2(p1.x + third);
    const cp1y = round2(p1.y + tangents[i] * third);
    const cp2x = round2(p2.x - third);
    const cp2y = round2(p2.y - tangents[i + 1] * third);
    segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return segments.join(' ');
}

/** Dense points along the same monotone curve buildSmoothPath draws (for canvas / WebGL charts). */
export function sampleMonotone(points: ChartPoint[], perSegment = 16): ChartPoint[] {
  if (points.length < 2) return points.slice();
  const tangents = monotoneTangents(points);
  const out: ChartPoint[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const h = p2.x - p1.x;
    for (let s = 0; s < perSegment; s += 1) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      out.push({
        x: p1.x + h * t,
        y: h00 * p1.y + h10 * h * tangents[i] + h01 * p2.y + h11 * h * tangents[i + 1],
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Drop ticks whose formatted label repeats an earlier one (e.g. £0.50 and £1 both rounding to "£1"). */
export function uniqueTicksByLabel(ticks: number[], format: (value: number) => string): number[] {
  const seen = new Set<string>();
  return ticks.filter((tick) => {
    const label = format(tick);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

export function buildLinearPath(points: ChartPoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
}

export function buildAreaPath(linePath: string, firstX: number, lastX: number, baselineY: number): string {
  return `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
}
