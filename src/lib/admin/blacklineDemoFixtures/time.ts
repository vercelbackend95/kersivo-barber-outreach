import { addMilliseconds } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const BLACKLINE_TZ = 'Europe/London' as const;

export const WEEKDAY_OPEN_MINUTE = 9 * 60;
export const WEEKDAY_CLOSE_MINUTE = 19 * 60;
export const SATURDAY_CLOSE_MINUTE = 17 * 60;

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 — deterministic PRNG, same as generic admin-demo calendar. */
export function createPrng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function blacklineDayKey(now = new Date()): string {
  return formatInTimeZone(now, BLACKLINE_TZ, 'yyyy-MM-dd');
}

/** Floor London time to 5-minute buckets so SSR and hydration agree. */
export function coarseLondonNow(now = new Date()): Date {
  const zoned = toZonedTime(now, BLACKLINE_TZ);
  const floored = Math.floor(zoned.getMinutes() / 5) * 5;
  const stamp = `${formatInTimeZone(now, BLACKLINE_TZ, 'yyyy-MM-dd')}T${String(zoned.getHours()).padStart(2, '0')}:${String(floored).padStart(2, '0')}:00.000`;
  return fromZonedTime(stamp, BLACKLINE_TZ);
}

export function londonWeekdayMon1(dayKey: string): number {
  const isoDow = Number(
    formatInTimeZone(fromZonedTime(`${dayKey}T12:00:00.000`, BLACKLINE_TZ), BLACKLINE_TZ, 'i'),
  );
  return Number.isFinite(isoDow) ? isoDow : 1;
}

export function tradingWindow(dayKey: string): { openMinute: number; closeMinute: number } | null {
  const weekday = londonWeekdayMon1(dayKey);
  if (weekday === 7) return null;
  return {
    openMinute: WEEKDAY_OPEN_MINUTE,
    closeMinute: weekday === 6 ? SATURDAY_CLOSE_MINUTE : WEEKDAY_CLOSE_MINUTE,
  };
}

export function atDayMinute(dayKey: string, dayMinute: number): string {
  const hour = Math.floor(dayMinute / 60);
  const minute = dayMinute % 60;
  return fromZonedTime(
    `${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
    BLACKLINE_TZ,
  ).toISOString();
}

export function londonNowMinutes(now: Date, dayKey: string): number | null {
  if (blacklineDayKey(now) !== dayKey) return null;
  return Number(formatInTimeZone(now, BLACKLINE_TZ, 'H')) * 60 + Number(formatInTimeZone(now, BLACKLINE_TZ, 'm'));
}

export function dayKeyDaysAgo(daysAgo: number, now = new Date()): string {
  const todayKey = blacklineDayKey(now);
  const anchor = fromZonedTime(`${todayKey}T12:00:00.000`, BLACKLINE_TZ);
  return formatInTimeZone(
    addMilliseconds(anchor, -daysAgo * 24 * 60 * 60 * 1000),
    BLACKLINE_TZ,
    'yyyy-MM-dd',
  );
}

export function londonDayBounds(dayKey: string): { gteMs: number; ltMs: number } {
  const gteMs = fromZonedTime(`${dayKey}T00:00:00.000`, BLACKLINE_TZ).getTime();
  const ltMs = addMilliseconds(new Date(gteMs), 24 * 60 * 60 * 1000).getTime();
  return { gteMs, ltMs };
}
