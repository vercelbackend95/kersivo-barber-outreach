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

type TodayScheduleRule = {
  active: boolean;
  startMinutes: number;
  endMinutes: number;
};

export type TodayScheduleSummary = {
  todayLabel: string;
  todayIsOnShift: boolean | null;
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
