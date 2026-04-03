import type { WorkingHourRow } from '../../components/admin/barbersTypes';

/**
 * Minute-based defaults for new barbers — must match `DEFAULT_RULES` in
 * `defaultAvailability.ts` (days 0–5 on shift; Sunday 6 has no DB row = off).
 */
const DEFAULT_ACTIVE_RULES_MINUTES: { dayOfWeek: number; startMinutes: number; endMinutes: number }[] = [
  { dayOfWeek: 0, startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { dayOfWeek: 1, startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { dayOfWeek: 2, startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { dayOfWeek: 3, startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { dayOfWeek: 4, startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { dayOfWeek: 5, startMinutes: 10 * 60, endMinutes: 16 * 60 }
];

function minutesToTime(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Seven rows (Mon–Sun) matching what `ensureBarberHasAvailabilityRules` seeds before profile edits. */
export function getDefaultWorkingHourRows(): WorkingHourRow[] {
  const byDay = new Map(DEFAULT_ACTIVE_RULES_MINUTES.map((r) => [r.dayOfWeek, r]));
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const rule = byDay.get(dayOfWeek);
    if (rule) {
      return {
        dayOfWeek,
        active: true,
        startTime: minutesToTime(rule.startMinutes),
        endTime: minutesToTime(rule.endMinutes)
      };
    }
    return {
      dayOfWeek,
      active: false,
      startTime: minutesToTime(10 * 60),
      endTime: minutesToTime(18 * 60)
    };
  });
}
