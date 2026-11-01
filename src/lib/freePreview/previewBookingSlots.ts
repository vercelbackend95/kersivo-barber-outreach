/** Fixed example slots for preview / sandbox booking — no live availability fetch. */
export const PREVIEW_STATIC_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '14:00',
  '14:30',
] as const;

export type PreviewBookingHoursDay = {
  dayOfWeek: number;
  open: boolean;
};

/** ISO weekday: Monday = 1 … Sunday = 7, from a YYYY-MM-DD date at noon UTC. */
export function isoWeekdayFromIsoDate(isoDate: string): number {
  const utcDay = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

/**
 * Hub booking preview uses static example times, but must still honour applied shop hours
 * so a closed Sunday (or any closed weekday) shows no slots.
 * Marketing `/book` sandbox passes no hours and keeps every weekday open.
 */
/** Pad stored shop hours to Mon–Sun. Missing weekdays are closed. Empty input stays empty. */
export function previewHoursFromRows(rows: Array<{ dayOfWeek: number; active: boolean }>): PreviewBookingHoursDay[] {
  if (!rows.length) return [];
  const byDay = new Map(rows.map((row) => [row.dayOfWeek, row.active]));
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    dayOfWeek,
    open: byDay.get(dayOfWeek) ?? false,
  }));
}

export function previewSlotsForDate(input: {
  isoDate: string;
  hours?: PreviewBookingHoursDay[] | null;
}): string[] {
  if (!input.hours?.length) return [...PREVIEW_STATIC_SLOTS];
  const dayOfWeek = isoWeekdayFromIsoDate(input.isoDate);
  const row = input.hours.find((day) => day.dayOfWeek === dayOfWeek);
  if (!row || !row.open) return [];
  return [...PREVIEW_STATIC_SLOTS];
}
