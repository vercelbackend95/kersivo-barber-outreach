/**
 * Opening hours for the editors (paid dashboard settings and the Starter / preview hub).
 *
 * One canonical week shape (docs/site-data-contract.md): seven days, Monday first, ISO weekday
 * numbers, "HH:mm" 24-hour times, one period per day. Validation comes from the shared schema.
 *
 * Browser-safe: no Prisma or server imports.
 */
import { isValidOpeningPeriod } from './schema';

export type OpeningWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type OpeningDay = {
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  dayOfWeek: OpeningWeekday;
  isOpen: boolean;
  opens: string;
  closes: string;
};

/** Legacy row shape still used by the hours APIs ({ dayOfWeek, active, startTime, endTime }). */
export type OpeningHoursRow = {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
};

export const OPENING_WEEKDAYS: readonly OpeningWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export const OPENING_DAY_NAMES: Record<OpeningWeekday, { short: string; long: string }> = {
  1: { short: 'Mon', long: 'Monday' },
  2: { short: 'Tue', long: 'Tuesday' },
  3: { short: 'Wed', long: 'Wednesday' },
  4: { short: 'Thu', long: 'Thursday' },
  5: { short: 'Fri', long: 'Friday' },
  6: { short: 'Sat', long: 'Saturday' },
  7: { short: 'Sun', long: 'Sunday' },
};

export const OPENING_HOURS_CLOSE_AFTER_OPEN = 'Closing time must be after opening time.';
export const OPENING_HOURS_NONE_OPEN = 'Open on at least one day.';

/** Shown (unsaved) when a shop has never set hours: Monday to Saturday 09:00–18:00, Sunday closed. */
export function defaultOpeningWeek(): OpeningDay[] {
  return OPENING_WEEKDAYS.map((dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek !== 7,
    opens: '09:00',
    closes: '18:00',
  }));
}

/** Every quarter hour of the day, "00:00" … "23:45" (the editors' 15-minute steps). */
export const QUARTER_HOUR_TIMES: readonly string[] = Array.from({ length: 96 }, (_, index) => {
  const h = Math.floor(index / 4);
  const m = (index % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

/** Times to offer in a select: the quarter hours plus the current value if it is off-grid. */
export function timeOptionsFor(value: string): string[] {
  if (!value || QUARTER_HOUR_TIMES.includes(value)) return [...QUARTER_HOUR_TIMES];
  return [...QUARTER_HOUR_TIMES, value].sort();
}

export function openingDayError(day: OpeningDay): string | null {
  if (!day.isOpen) return null;
  return isValidOpeningPeriod(day.opens, day.closes) ? null : OPENING_HOURS_CLOSE_AFTER_OPEN;
}

/** Per-day errors keyed by weekday (only days with a problem). */
export function openingWeekErrors(week: readonly OpeningDay[]): Partial<Record<OpeningWeekday, string>> {
  const errors: Partial<Record<OpeningWeekday, string>> = {};
  for (const day of week) {
    const error = openingDayError(day);
    if (error) errors[day.dayOfWeek] = error;
  }
  return errors;
}

export function isOpeningWeekValid(week: readonly OpeningDay[]): boolean {
  return week.length === 7 && Object.keys(openingWeekErrors(week)).length === 0;
}

/** Monday's open/closed state and times copied to Tuesday–Friday. Weekend days are left alone. */
export function copyMondayToWeekdays(week: readonly OpeningDay[]): OpeningDay[] {
  const monday = week.find((day) => day.dayOfWeek === 1);
  if (!monday) return [...week];
  return week.map((day) =>
    day.dayOfWeek >= 2 && day.dayOfWeek <= 5
      ? { ...day, isOpen: monday.isOpen, opens: monday.opens, closes: monday.closes }
      : day,
  );
}

function asWeekday(value: number): OpeningWeekday | null {
  return Number.isInteger(value) && value >= 1 && value <= 7 ? (value as OpeningWeekday) : null;
}

/**
 * Rows from the hours APIs → a full Monday-first week. A day the API did not send is closed
 * (it keeps the default times so opening it again starts from 09:00–18:00).
 */
export function openingWeekFromRows(rows: readonly OpeningHoursRow[]): OpeningDay[] {
  const byDay = new Map<OpeningWeekday, OpeningHoursRow>();
  for (const row of rows) {
    const day = asWeekday(row.dayOfWeek);
    if (day) byDay.set(day, row);
  }
  return defaultOpeningWeek().map((fallback) => {
    const row = byDay.get(fallback.dayOfWeek);
    if (!row) return { ...fallback, isOpen: false };
    return {
      dayOfWeek: fallback.dayOfWeek,
      isOpen: row.active,
      opens: row.startTime || fallback.opens,
      closes: row.endTime || fallback.closes,
    };
  });
}

export function openingRowsFromWeek(week: readonly OpeningDay[]): OpeningHoursRow[] {
  return OPENING_WEEKDAYS.map((dayOfWeek) => {
    const day = week.find((row) => row.dayOfWeek === dayOfWeek) ?? {
      dayOfWeek,
      isOpen: false,
      opens: '09:00',
      closes: '18:00',
    };
    return { dayOfWeek, active: day.isOpen, startTime: day.opens, endTime: day.closes };
  });
}

export function sameOpeningWeek(a: readonly OpeningDay[], b: readonly OpeningDay[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((day, index) => {
    const other = b[index];
    return (
      Boolean(other) &&
      other!.dayOfWeek === day.dayOfWeek &&
      other!.isOpen === day.isOpen &&
      other!.opens === day.opens &&
      other!.closes === day.closes
    );
  });
}
