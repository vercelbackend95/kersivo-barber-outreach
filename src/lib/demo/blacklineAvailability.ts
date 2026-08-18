import { formatInTimeZone } from 'date-fns-tz';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { ANY_BARBER_ID } from '@/lib/booking/constants';
import { getBlacklineBookingsForDayKey } from '@/lib/admin/blacklineDemoFixtures/schedule';
import { BLACKLINE_TZ, tradingWindow } from '@/lib/admin/blacklineDemoFixtures/time';
import {
  listBlacklineSessionBookings,
  parseHhMmToMinutes,
} from './blacklineSessionBookings';

const SLOT_STEP_MINUTES = 15;
const BLOCKING_STATUSES = new Set(['BOOKED', 'COMPLETED', 'NO_SHOW']);

export type BlacklineOccupancyInterval = {
  barberId: string;
  startMinute: number;
  endMinute: number;
};

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function formatHhMm(dayMinute: number): string {
  const hours = Math.floor(dayMinute / 60);
  const minutes = dayMinute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function intervalFromIso(startAt: string, endAt: string): { startMinute: number; endMinute: number } | null {
  const startMinute =
    Number(formatInTimeZone(new Date(startAt), BLACKLINE_TZ, 'H')) * 60 +
    Number(formatInTimeZone(new Date(startAt), BLACKLINE_TZ, 'm'));
  const endMinute =
    Number(formatInTimeZone(new Date(endAt), BLACKLINE_TZ, 'H')) * 60 +
    Number(formatInTimeZone(new Date(endAt), BLACKLINE_TZ, 'm'));
  if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute) {
    return null;
  }
  return { startMinute, endMinute };
}

export function collectBlacklineOccupancy(
  dayKey: string,
  options: { now?: Date; extra?: BlacklineOccupancyInterval[] } = {},
): BlacklineOccupancyInterval[] {
  const now = options.now ?? new Date();
  const intervals: BlacklineOccupancyInterval[] = [...(options.extra ?? [])];

  for (const row of getBlacklineBookingsForDayKey(dayKey, { now })) {
    if (!BLOCKING_STATUSES.has(row.status)) continue;
    const span = intervalFromIso(row.startAt, row.endAt);
    if (!span) continue;
    intervals.push({ barberId: row.barberId, ...span });
  }

  for (const row of listBlacklineSessionBookings(now)) {
    if (row.date !== dayKey) continue;
    const startMinute = parseHhMmToMinutes(row.startTime);
    if (startMinute == null) continue;
    intervals.push({
      barberId: row.barberId,
      startMinute,
      endMinute: startMinute + row.durationMinutes,
    });
  }

  return intervals;
}

function barberIsFree(
  occupancy: readonly BlacklineOccupancyInterval[],
  barberId: string,
  startMinute: number,
  endMinute: number,
): boolean {
  return !occupancy.some(
    (interval) =>
      interval.barberId === barberId &&
      overlaps(startMinute, endMinute, interval.startMinute, interval.endMinute),
  );
}

export function listBlacklineAvailableSlots(options: {
  date: string;
  barberId: string | null;
  durationMinutes: number;
  now?: Date;
  occupancy?: BlacklineOccupancyInterval[];
}): string[] {
  const window = tradingWindow(options.date);
  if (!window || options.durationMinutes <= 0) return [];

  const occupancy = options.occupancy ?? collectBlacklineOccupancy(options.date, { now: options.now });
  const anyBarber = !options.barberId || options.barberId === ANY_BARBER_ID;
  const barberIds = anyBarber
    ? DEMO_BARBERS.map((barber) => barber.id)
    : options.barberId
      ? [options.barberId]
      : [];

  const now = options.now ?? new Date();
  const todayKey = formatInTimeZone(now, BLACKLINE_TZ, 'yyyy-MM-dd');
  const nowMinute =
    todayKey === options.date
      ? Number(formatInTimeZone(now, BLACKLINE_TZ, 'H')) * 60 +
        Number(formatInTimeZone(now, BLACKLINE_TZ, 'm'))
      : null;

  const slots: string[] = [];
  for (let start = window.openMinute; start + options.durationMinutes <= window.closeMinute; start += SLOT_STEP_MINUTES) {
    if (nowMinute != null && start < nowMinute) continue;
    const end = start + options.durationMinutes;
    const free = barberIds.some((barberId) => barberIsFree(occupancy, barberId, start, end));
    if (free) slots.push(formatHhMm(start));
  }
  return slots;
}

export function resolveBlacklineBarberForSlot(options: {
  date: string;
  time: string;
  durationMinutes: number;
  preferredBarberId?: string | null;
  now?: Date;
  occupancy?: BlacklineOccupancyInterval[];
}): { id: string; name: string } | null {
  const startMinute = parseHhMmToMinutes(options.time);
  if (startMinute == null || options.durationMinutes <= 0) return null;
  const endMinute = startMinute + options.durationMinutes;
  const occupancy = options.occupancy ?? collectBlacklineOccupancy(options.date, { now: options.now });

  const preferred =
    options.preferredBarberId && options.preferredBarberId !== ANY_BARBER_ID
      ? DEMO_BARBERS.find((barber) => barber.id === options.preferredBarberId)
      : null;

  if (preferred) {
    if (!barberIsFree(occupancy, preferred.id, startMinute, endMinute)) return null;
    return { id: preferred.id, name: preferred.name };
  }

  for (const barber of DEMO_BARBERS) {
    if (barberIsFree(occupancy, barber.id, startMinute, endMinute)) {
      return { id: barber.id, name: barber.name };
    }
  }
  return null;
}
