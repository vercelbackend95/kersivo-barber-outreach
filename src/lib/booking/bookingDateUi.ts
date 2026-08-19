const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getCurrentIsoDateInTimezone(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const match = isoDate.match(ISO_DATE_PATTERN);
  if (!match) return isoDate;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  const shifted = new Date(utc);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfIsoWeek(isoDate: string): string {
  const match = isoDate.match(ISO_DATE_PATTERN);
  if (!match) return isoDate;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  const weekday = utc.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return shiftIsoDate(isoDate, mondayOffset);
}

export function isoWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftIsoDate(weekStart, index));
}

export function formatIsoWeekday(isoDate: string, timezone: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-GB', {
    timeZone: timezone,
    weekday: 'short',
  });
}

export function formatIsoDayNumber(isoDate: string, timezone: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-GB', {
    timeZone: timezone,
    day: 'numeric',
  });
}

export function formatDateForSummary(isoDate: string, timezone: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateForBookingTab(isoDate: string, timezone: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export function formatMonthYear(isoDate: string, timezone: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-GB', {
    timeZone: timezone,
    month: 'long',
    year: 'numeric',
  });
}

export function compareIsoDates(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export type TimeSlotGroupId = 'morning' | 'afternoon' | 'evening';

export type TimeSlotGroup = {
  id: TimeSlotGroupId;
  label: string;
  slots: string[];
};

export function groupTimeSlots(slots: readonly string[]): TimeSlotGroup[] {
  const morning: string[] = [];
  const afternoon: string[] = [];
  const evening: string[] = [];

  for (const slot of slots) {
    const hour = Number(slot.slice(0, 2));
    if (!Number.isFinite(hour)) continue;
    if (hour < 12) morning.push(slot);
    else if (hour < 17) afternoon.push(slot);
    else evening.push(slot);
  }

  return (
    [
      { id: 'morning' as const, label: 'Morning', slots: morning },
      { id: 'afternoon' as const, label: 'Afternoon', slots: afternoon },
      { id: 'evening' as const, label: 'Evening', slots: evening },
    ] satisfies TimeSlotGroup[]
  ).filter((group) => group.slots.length > 0);
}
