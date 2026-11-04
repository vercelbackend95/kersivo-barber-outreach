/**
 * Opening hours for the editors (paid dashboard settings and the Starter / preview hub).
 *
 * One canonical week shape (docs/site-data-contract.md): seven days, Monday first, ISO weekday
 * numbers, "HH:mm" 24-hour times, one period per day. Validation comes from the shared schema.
 *
 * Browser-safe: no Prisma or server imports.
 */
import { hhmmToMinutes, isValidOpeningPeriod } from './schema';

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

/**
 * One day's open/closed state and times copied to other days (the editor's "Copy to" panel). The source day and
 * days not listed are left alone.
 */
export function copyDayTo(
  week: readonly OpeningDay[],
  fromDay: OpeningWeekday,
  targetDays: readonly OpeningWeekday[],
): OpeningDay[] {
  const source = week.find((day) => day.dayOfWeek === fromDay);
  if (!source) return [...week];
  const targets = new Set(targetDays.filter((day) => day !== fromDay));
  return week.map((day) =>
    targets.has(day.dayOfWeek) ? { ...day, isOpen: source.isOpen, opens: source.opens, closes: source.closes } : day,
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

// ---------------------------------------------------------------------------
// Week at a glance (summary, total, quick patterns)
// ---------------------------------------------------------------------------

/** "09:00 – 18:00" (en dash with spaces), the one way the editors print a period. */
export function formatOpeningPeriod(opens: string, closes: string): string {
  return `${opens} – ${closes}`;
}

export type OpeningWeekSummaryLine = { days: string; time: string; closed: boolean };

/**
 * Consecutive days (Monday first) with the same hours, grouped: "Mon – Fri" "09:00 – 18:00", "Sun" "Closed".
 * Closed days group together whatever their stored times.
 */
export function summariseOpeningWeek(week: readonly OpeningDay[]): OpeningWeekSummaryLine[] {
  const ordered = OPENING_WEEKDAYS.map((dayOfWeek) => week.find((day) => day.dayOfWeek === dayOfWeek)).filter(
    (day): day is OpeningDay => Boolean(day),
  );
  const key = (day: OpeningDay) => (day.isOpen ? `${day.opens}-${day.closes}` : 'closed');
  const lines: OpeningWeekSummaryLine[] = [];
  let index = 0;
  while (index < ordered.length) {
    const first = ordered[index]!;
    let last = first;
    while (index + 1 < ordered.length && key(ordered[index + 1]!) === key(first)) {
      index += 1;
      last = ordered[index]!;
    }
    const from = OPENING_DAY_NAMES[first.dayOfWeek].short;
    const to = OPENING_DAY_NAMES[last.dayOfWeek].short;
    lines.push({
      days: first === last ? from : `${from} – ${to}`,
      time: first.isOpen ? formatOpeningPeriod(first.opens, first.closes) : 'Closed',
      closed: !first.isOpen,
    });
    index += 1;
  }
  return lines;
}

/** Minutes open across the week (open days with a valid period only). */
export function weeklyOpenMinutes(week: readonly OpeningDay[]): number {
  return week.reduce(
    (total, day) =>
      day.isOpen && isValidOpeningPeriod(day.opens, day.closes)
        ? total + hhmmToMinutes(day.closes) - hhmmToMinutes(day.opens)
        : total,
    0,
  );
}

/** 3240 → "54", 3150 → "52.5", 3165 → "52.75". */
export function formatOpenHours(minutes: number): string {
  return String(Math.round((minutes / 60) * 100) / 100);
}

export type OpeningWeekPreset = { id: string; label: string; week: OpeningDay[] };

function presetWeek(
  open: Partial<Record<OpeningWeekday, readonly [string, string]>>,
  closedTimes: readonly [string, string],
): OpeningDay[] {
  return OPENING_WEEKDAYS.map((dayOfWeek) => {
    const period = open[dayOfWeek];
    return period
      ? { dayOfWeek, isOpen: true, opens: period[0], closes: period[1] }
      : { dayOfWeek, isOpen: false, opens: closedTimes[0], closes: closedTimes[1] };
  });
}

const NINE_SIX = ['09:00', '18:00'] as const;
const TEN_SIX = ['10:00', '18:00'] as const;

/** Quick patterns ("Start from"). Applying one replaces the whole week. */
export const OPENING_WEEK_PRESETS: readonly OpeningWeekPreset[] = [
  {
    id: 'mon-sat',
    label: 'Mon–Sat · 09:00–18:00',
    week: presetWeek({ 1: NINE_SIX, 2: NINE_SIX, 3: NINE_SIX, 4: NINE_SIX, 5: NINE_SIX, 6: NINE_SIX }, NINE_SIX),
  },
  {
    id: 'mon-fri-short-sat',
    label: 'Mon–Fri 09:00–18:00 · Sat 09:00–17:00',
    week: presetWeek(
      { 1: NINE_SIX, 2: NINE_SIX, 3: NINE_SIX, 4: NINE_SIX, 5: NINE_SIX, 6: ['09:00', '17:00'] },
      NINE_SIX,
    ),
  },
  {
    id: 'tue-sat',
    label: 'Tue–Sat · 09:00–18:00',
    week: presetWeek({ 2: NINE_SIX, 3: NINE_SIX, 4: NINE_SIX, 5: NINE_SIX, 6: NINE_SIX }, NINE_SIX),
  },
  {
    id: 'every-day',
    label: 'Every day · 10:00–18:00',
    week: presetWeek({ 1: TEN_SIX, 2: TEN_SIX, 3: TEN_SIX, 4: TEN_SIX, 5: TEN_SIX, 6: TEN_SIX, 7: TEN_SIX }, TEN_SIX),
  },
];

/** Same open days and times as the preset (times of closed days are ignored). */
export function openingWeekMatchesPreset(week: readonly OpeningDay[], preset: OpeningWeekPreset): boolean {
  return preset.week.every((target) => {
    const day = week.find((row) => row.dayOfWeek === target.dayOfWeek);
    if (!day || day.isOpen !== target.isOpen) return false;
    return !target.isOpen || (day.opens === target.opens && day.closes === target.closes);
  });
}

// ---------------------------------------------------------------------------
// Time picker rules (the editor enforces these; the schema still validates)
// ---------------------------------------------------------------------------

/** Latest opening time: leaves one quarter hour for closing (23:45). */
export const OPENING_LATEST_OPENS = 23 * 60 + 30;
export const OPENING_LATEST_CLOSES = 23 * 60 + 45;
const MIN_AUTO_DURATION = 60;

export function minutesToHhmm(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/** Minutes of a "HH:mm" value, or null when it is not one. */
export function openingTimeMinutes(value: string): number | null {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? hhmmToMinutes(value) : null;
}

/** Off-grid minutes snap down to the quarter (09:10 → 09:00). */
export function snapToQuarter(minutes: number): number {
  return minutes - (minutes % 15);
}

export function isOpeningChoiceAllowed(minutes: number): boolean {
  return minutes >= 0 && minutes <= OPENING_LATEST_OPENS && minutes % 15 === 0;
}

export function isClosingChoiceAllowed(opens: string, minutes: number): boolean {
  const open = openingTimeMinutes(opens);
  return minutes % 15 === 0 && minutes <= OPENING_LATEST_CLOSES && (open === null || minutes > open);
}

export type OpeningTimePick = { day: OpeningDay; movedClosing: string | null };

/**
 * New opening time for a day. When it reaches or passes closing, closing moves forward by the previous length of
 * the day (at least an hour, never past 23:45) and the new closing time is returned for the announcement.
 */
export function pickOpeningTime(day: OpeningDay, minutes: number): OpeningTimePick {
  const opens = Math.min(snapToQuarter(Math.max(0, minutes)), OPENING_LATEST_OPENS);
  const oldOpens = openingTimeMinutes(day.opens);
  const oldCloses = openingTimeMinutes(day.closes);
  const next: OpeningDay = { ...day, opens: minutesToHhmm(opens) };
  if (oldCloses !== null && oldCloses > opens) return { day: next, movedClosing: null };
  const previous = oldOpens !== null && oldCloses !== null && oldCloses > oldOpens ? oldCloses - oldOpens : 0;
  const closes = Math.min(opens + Math.max(previous, MIN_AUTO_DURATION), OPENING_LATEST_CLOSES);
  next.closes = minutesToHhmm(closes);
  return { day: next, movedClosing: next.closes };
}

/** New closing time; a choice at or before opening becomes the first valid quarter of that hour. */
export function pickClosingTime(day: OpeningDay, minutes: number): OpeningDay {
  let closes = Math.min(snapToQuarter(Math.max(0, minutes)), OPENING_LATEST_CLOSES);
  if (!isClosingChoiceAllowed(day.opens, closes)) {
    const hourStart = closes - (closes % 60);
    const firstValid = [0, 15, 30, 45].map((m) => hourStart + m).find((m) => isClosingChoiceAllowed(day.opens, m));
    if (firstValid === undefined) return day;
    closes = firstValid;
  }
  return { ...day, closes: minutesToHhmm(closes) };
}
