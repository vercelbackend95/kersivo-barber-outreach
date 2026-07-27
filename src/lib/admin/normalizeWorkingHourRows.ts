import type { WorkingHourRow } from '../../components/admin/barbersTypes';
import { minutesToTimeString } from './timeStrings';
import { ALL_WEEKDAYS, isWeekday } from '@/lib/booking/weekdays';

type RawWorkingHourRule = {
  dayOfWeek?: unknown;
  active?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  startMinutes?: unknown;
  endMinutes?: unknown;
};

const DEFAULT_START_MIN = 10 * 60;
const DEFAULT_END_MIN = 18 * 60;

function isHhMm(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function minutesFromUnknown(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1440) {
    return Math.floor(value);
  }
  return fallback;
}

/**
 * Normalize API / demo fixture rules into UI `WorkingHourRow`s.
 * Accepts the production shape (`startTime`/`endTime`) and a legacy minutes shape.
 */
export function normalizeWorkingHourRows(rawRules: unknown): WorkingHourRow[] {
  const list = Array.isArray(rawRules) ? (rawRules as RawWorkingHourRule[]) : [];
  const byDay = new Map<number, WorkingHourRow>();

  for (const rule of list) {
    const dayOfWeek = typeof rule.dayOfWeek === 'number' ? rule.dayOfWeek : Number(rule.dayOfWeek);
    if (!isWeekday(dayOfWeek)) continue;

    let startTime: string;
    let endTime: string;
    if (isHhMm(rule.startTime) && isHhMm(rule.endTime)) {
      startTime = rule.startTime;
      endTime = rule.endTime;
    } else {
      startTime = minutesToTimeString(minutesFromUnknown(rule.startMinutes, DEFAULT_START_MIN));
      endTime = minutesToTimeString(minutesFromUnknown(rule.endMinutes, DEFAULT_END_MIN));
    }

    byDay.set(dayOfWeek, {
      dayOfWeek,
      active: Boolean(rule.active),
      startTime,
      endTime,
    });
  }

  return ALL_WEEKDAYS.map((dayOfWeek) => {
    return (
      byDay.get(dayOfWeek) ?? {
        dayOfWeek,
        active: false,
        startTime: minutesToTimeString(DEFAULT_START_MIN),
        endTime: minutesToTimeString(DEFAULT_END_MIN),
      }
    );
  });
}
