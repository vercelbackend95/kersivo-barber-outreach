import { WEEKDAY_SHORT_TO_MON1 } from '@/lib/booking/weekdays';

const LONDON_TIME_ZONE = 'Europe/London';

export type TodayScheduleRule = {
  active: boolean;
  startMinutes: number;
  endMinutes: number;
  breakStartMin?: number | null;
  breakEndMin?: number | null;
};

export type TodayScheduleSummary = {
  todayLabel: string;
  todayIsOnShift: boolean | null;
};

/** Serialized on barbers API for client-side `isWithinShiftNow` with live `nowMs`. */
export type TodayShiftWindow = {
  startMinutes: number;
  endMinutes: number;
  breakStartMin: number | null;
  breakEndMin: number | null;
};

export function getTodayInLondon(now = new Date()): number | null {
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    weekday: 'short'
  }).format(now);

  return WEEKDAY_SHORT_TO_MON1[weekday] ?? null;
}

function formatMinutesAsTime(minutes: number): string {
  const safeMinutes = Math.max(0, Math.min(24 * 60, Math.trunc(minutes)));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function getTodayShiftWindowForBarber(rulesForToday?: TodayScheduleRule[]): TodayShiftWindow | null {
  if (!rulesForToday || rulesForToday.length === 0) {
    return null;
  }

  const activeRule = rulesForToday.find((rule) => rule.active);
  if (!activeRule) {
    return null;
  }

  return {
    startMinutes: activeRule.startMinutes,
    endMinutes: activeRule.endMinutes,
    breakStartMin: activeRule.breakStartMin ?? null,
    breakEndMin: activeRule.breakEndMin ?? null
  };
}

export function getTodayScheduleForBarber(rulesForToday?: TodayScheduleRule[]): TodayScheduleSummary {
  if (!rulesForToday || rulesForToday.length === 0) {
    return { todayLabel: 'Off', todayIsOnShift: false };
  }

  const activeRule = rulesForToday.find((rule) => rule.active);
  if (!activeRule) {
    return { todayLabel: 'Off', todayIsOnShift: false };
  }

  return {
    todayLabel: `${formatMinutesAsTime(activeRule.startMinutes)}–${formatMinutesAsTime(activeRule.endMinutes)}`,
    todayIsOnShift: true
  };
}

/** True when a time-block title represents vacation / holiday (not a short break). */
export function isHolidayBlockTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const normalized = title.trim().toLowerCase();
  return (
    normalized === 'holiday' ||
    normalized.includes('holiday') ||
    normalized.includes('vacation')
  );
}

export function withHolidayTodayLabel(
  schedule: TodayScheduleSummary,
  hasHolidayToday: boolean,
): TodayScheduleSummary {
  if (!hasHolidayToday) return schedule;
  return { todayLabel: 'Holiday', todayIsOnShift: false };
}

/** Minutes since local midnight in Europe/London for this instant. */
export function getLondonMinutesFromMidnight(now: Date): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * True when London time is inside [startMinutes, endMinutes) for the shift window,
 * excluding [breakStartMin, breakEndMin) when both break fields are set (aligned with slot generation).
 */
export function isWithinShiftNow(now: Date, window: TodayShiftWindow | null | undefined): boolean {
  if (window == null) {
    return false;
  }

  const { startMinutes, endMinutes, breakStartMin, breakEndMin } = window;
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || startMinutes >= endMinutes) {
    return false;
  }

  const m = getLondonMinutesFromMidnight(now);
  if (m < startMinutes || m >= endMinutes) {
    return false;
  }

  if (breakStartMin != null && breakEndMin != null && breakStartMin < breakEndMin) {
    if (m >= breakStartMin && m < breakEndMin) {
      return false;
    }
  }

  return true;
}
