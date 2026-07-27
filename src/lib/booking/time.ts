import { WEEKDAY_SHORT_TO_MON1 } from './weekdays';

// src/lib/booking/time.ts
const LONDON_TZ = 'Europe/London';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
export const BOOKING_MINIMUM_LEAD_TIME_MINUTES = 30;
function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.getUTCFullYear() === year
    && utcDate.getUTCMonth() === month - 1
    && utcDate.getUTCDate() === day;
}

export function normalizeToIsoDate(input: string): string | null {
  const trimmed = input.trim();
  const isoMatch = trimmed.match(ISO_DATE_PATTERN);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidDateParts(year, month, day)) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const dmyMatch = trimmed.match(DMY_DATE_PATTERN);
  if (!dmyMatch) return null;

  const day = Number(dmyMatch[1]);
  const month = Number(dmyMatch[2]);
  const year = Number(dmyMatch[3]);

  if (!isValidDateParts(year, month, day)) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function londonDayOfWeekFromIsoDate(isoDate: string): number | null {
  const isoMatch = isoDate.match(ISO_DATE_PATTERN);
  if (!isoMatch) return null;

  const year = Number(isoMatch[1]);
  const month = Number(isoMatch[2]);
  const day = Number(isoMatch[3]);
  if (!isValidDateParts(year, month, day)) return null;

  const middayUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    weekday: 'short'
  }).format(middayUtc);

  // Canonical weekday mapping across UI/API/DB: Mon=1 … Sun=7.
  return WEEKDAY_SHORT_TO_MON1[weekday] ?? null;
}

export function toUtcFromLondon(date: string, minutes: number): Date {
  const [year, month, day] = date.split('-').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0));
  const londonParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(utcGuess);

  const get = (type: string) => Number(londonParts.find((p) => p.type === type)?.value ?? '0');
  const diffMinutes = (get('hour') * 60 + get('minute')) - minutes;
  return new Date(utcGuess.getTime() - diffMinutes * 60000);
}

export function minutesInLondonDay(dateUtc: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(dateUtc);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

export function londonDateKey(dateUtc: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateUtc);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}
export function roundMinutesUpToInterval(minutes: number, intervalMinutes: number): number {
  if (intervalMinutes <= 0) return minutes;
  return Math.ceil(minutes / intervalMinutes) * intervalMinutes;
}

export function getEarliestBookableSlotMinute(input: {
  date: string;
  slotIntervalMinutes: number;
  now?: Date;
  minimumLeadTimeMinutes?: number;
}): number | null {
  const now = input.now ?? new Date();
  const today = londonDateKey(now);

  if (input.date < today) return null;
  if (input.date > today) return 0;

  const leadTimeMinutes = input.minimumLeadTimeMinutes ?? BOOKING_MINIMUM_LEAD_TIME_MINUTES;
  const earliestBookableMoment = addMinutes(now, leadTimeMinutes);

  if (londonDateKey(earliestBookableMoment) !== input.date) {
    return 24 * 60;
  }

  return roundMinutesUpToInterval(
    minutesInLondonDay(earliestBookableMoment),
    input.slotIntervalMinutes
  );
}

export function formatLondonTime(dateUtc: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(dateUtc);
}
