const LONDON_TIME_ZONE = 'Europe/London';

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6
};

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

  return WEEKDAY_TO_INDEX[weekday] ?? null;
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
    return { todayLabel: '—', todayIsOnShift: null };
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
