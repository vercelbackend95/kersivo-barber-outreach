/** Canonical weekday numbers used in DB/API/UI: Monday=1 … Sunday=7 (ISO-like). */

export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type WeekdayMon1 = (typeof ALL_WEEKDAYS)[number];

export const WEEKDAY_SHORT_TO_MON1: Record<string, WeekdayMon1> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** Index 0 unused; 1=Monday … 7=Sunday */
export const WEEKDAY_LABELS_FULL: readonly string[] = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** Index 0 unused; 1=Mon … 7=Sun */
export const WEEKDAY_LABELS_SHORT: readonly string[] = [
  '',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];

export function isWeekday(n: number): n is WeekdayMon1 {
  return Number.isInteger(n) && n >= 1 && n <= 7;
}

export function weekdayLabelFull(dayOfWeek: number): string {
  return WEEKDAY_LABELS_FULL[dayOfWeek] ?? `Day ${dayOfWeek}`;
}

export function weekdayLabelShort(dayOfWeek: number): string {
  return WEEKDAY_LABELS_SHORT[dayOfWeek] ?? `Day ${dayOfWeek}`;
}
