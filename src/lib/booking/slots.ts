import type { AvailabilityRule, BarberTimeOff, Booking, Service, ShopSettings } from '@prisma/client';
import { hasAnyOverlap } from './overlap';
import { addMinutes, londonDateKey, minutesInLondonDay, toUtcFromLondon } from './time';

type SlotInput = {
  date: string;
  service: Service;
  rules: AvailabilityRule[];
  confirmedBookings: Pick<Booking, 'startAt' | 'endAt'>[];
  timeOff: Pick<BarberTimeOff, 'startsAt' | 'endsAt'>[];
  settings: ShopSettings;
};

export function generateSlots(input: SlotInput): string[] {
  const weekday = new Date(`${input.date}T00:00:00`).getDay();
  const rule = input.rules.find((entry) => entry.dayOfWeek === weekday && entry.active);
  if (!rule) return [];

  const buffer = input.service.bufferMinutes || input.settings.defaultBufferMinutes;
  const totalDuration = input.service.durationMinutes + buffer;
  const out: string[] = [];

  for (let minute = rule.startMinutes; minute + totalDuration <= rule.endMinutes; minute += input.settings.slotIntervalMinutes) {
    if (rule.breakStartMin != null && rule.breakEndMin != null) {
      const inBreak = minute < rule.breakEndMin && minute + totalDuration > rule.breakStartMin;
      if (inBreak) continue;
    }

    const startAt = toUtcFromLondon(input.date, minute);
    const endAt = addMinutes(startAt, totalDuration);

    const sameDate = londonDateKey(startAt) === input.date && londonDateKey(endAt) === input.date;
    if (!sameDate) continue;

    const collidesBooking = hasAnyOverlap({ startAt, endAt }, input.confirmedBookings.map((b) => ({ startAt: b.startAt, endAt: b.endAt })));
    if (collidesBooking) continue;

    const collidesTimeOff = hasAnyOverlap({ startAt, endAt }, input.timeOff.map((b) => ({ startAt: b.startsAt, endAt: b.endsAt })));
    if (collidesTimeOff) continue;

    const hh = String(Math.floor(minutesInLondonDay(startAt) / 60)).padStart(2, '0');
    const mm = String(minutesInLondonDay(startAt) % 60).padStart(2, '0');
    out.push(`${hh}:${mm}`);
  }

  return out;
}
