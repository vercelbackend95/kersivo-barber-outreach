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

/** Build a monotone cubic-bezier smooth path through points. */
export function buildSmoothPath(points: ChartPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const segments: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return segments.join(' ');
}

export function buildLinearPath(points: ChartPoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
}

export function buildAreaPath(linePath: string, firstX: number, lastX: number, baselineY: number): string {
  return `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
}
