import type { WorkingHourRow } from '../../components/admin/barbersTypes';

/**
 * Minute-based defaults for new barbers — must match `DEFAULT_RULES` in
 * `defaultAvailability.ts` (Mon–Sun 09:00–20:00, no breaks).
 */
const DEFAULT_ACTIVE_RULES_MINUTES: { dayOfWeek: number; startMinutes: number; endMinutes: number }[] =
  Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startMinutes: 9 * 60,
    endMinutes: 20 * 60
  }));

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
      startTime: minutesToTime(9 * 60),
      endTime: minutesToTime(20 * 60)
    };
  });
}
