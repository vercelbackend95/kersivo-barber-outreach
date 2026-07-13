import { formatInTimeZone } from 'date-fns-tz';

export const REPORTS_WORKDAY_OPEN_HOUR = 9;
export const REPORTS_WORKDAY_CLOSE_HOUR = 19;
export const REPORTS_CHART_TIMEZONE = 'Europe/London';

const HOUR_LABEL_RE = /^\d{2}:00$/;

export function isHourLabel(label: string): boolean {
  return HOUR_LABEL_RE.test(label);
}

export function formatHourLabel(hour: number): string {
  return `${String(Math.max(0, Math.min(23, Math.floor(hour)))).padStart(2, '0')}:00`;
}

export function parseHourLabel(label: string): number | null {
  if (!isHourLabel(label)) return null;
  const hour = Number(label.slice(0, 2));
  return Number.isFinite(hour) ? hour : null;
}

/** Workday hour labels from open through min(current London hour, close). Always at least open. */
export function buildWorkdayHourLabels(
  now = new Date(),
  timezone = REPORTS_CHART_TIMEZONE,
  openHour = REPORTS_WORKDAY_OPEN_HOUR,
  closeHour = REPORTS_WORKDAY_CLOSE_HOUR,
): string[] {
  const currentHour = Number(formatInTimeZone(now, timezone, 'H'));
  const endHour = Math.min(
    closeHour,
    Number.isFinite(currentHour) ? Math.max(openHour, currentHour) : openHour,
  );
  const labels: string[] = [];
  for (let hour = openHour; hour <= endHour; hour += 1) {
    labels.push(formatHourLabel(hour));
  }
  return labels;
}

export function getHourBucketLabel(
  date: Date | string,
  timezone = REPORTS_CHART_TIMEZONE,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, timezone, 'HH:00');
}

/** Cumulative series from per-hour increments (labels already ordered). */
export function toCumulativeSeries(
  labels: string[],
  perHour: Map<string, number>,
): Array<{ label: string; value: number }> {
  let running = 0;
  return labels.map((label) => {
    running += perHour.get(label) ?? 0;
    return { label, value: running };
  });
}
