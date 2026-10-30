export type BookingPreviewDay = {
  weekday: string;
  dayOfMonth: number;
  selected: boolean;
};

export type BookingPreviewDates = {
  /** Europe/London month (and year) covering the three dates. Never a month before `now`. */
  monthLabel: string;
  days: readonly [BookingPreviewDay, BookingPreviewDay, BookingPreviewDay];
};

type CalendarDate = { year: number; month: number; day: number };

function londonDate(instant: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function utcNoon(date: CalendarDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
}

function shiftDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function formatMonthYear(date: CalendarDate): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utcNoon(date));
}

function formatMonth(date: CalendarDate): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(utcNoon(date));
}

function formatWeekday(date: CalendarDate): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(utcNoon(date));
}

/**
 * Three weekday dates starting on the next Monday in Europe/London
 * (today, when today is already Monday). The middle day is marked selected.
 */
export function bookingPreviewDates(now: Date = new Date()): BookingPreviewDates {
  const today = londonDate(now);
  const weekday = utcNoon(today).getUTCDay();
  const daysUntilMonday = weekday === 1 ? 0 : (8 - weekday) % 7;
  const start = shiftDays(today, daysUntilMonday);
  const dates = [0, 1, 2].map((offset) => shiftDays(start, offset));
  const [first, , last] = dates;
  const sameMonth = first.year === last.year && first.month === last.month;
  const monthLabel = sameMonth
    ? formatMonthYear(first)
    : first.year === last.year
      ? `${formatMonth(first)}–${formatMonthYear(last)}`
      : `${formatMonthYear(first)}–${formatMonthYear(last)}`;

  const days = dates.map((date, index) => ({
    weekday: formatWeekday(date),
    dayOfMonth: date.day,
    selected: index === 1,
  })) as [BookingPreviewDay, BookingPreviewDay, BookingPreviewDay];

  return { monthLabel, days };
}
