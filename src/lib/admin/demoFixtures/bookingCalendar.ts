/**
 * Deterministic demo booking calendar — 28-day cycle + weekday density.
 * Same dayKey always yields the same bookings; adjacent days differ.
 */
import { addMilliseconds } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  DEMO_DAY_SEEDS,
  DEMO_DAY_TZ,
  type DemoDayBooking,
  type DemoDaySeed,
  demoDaySelectedDate,
} from './daySchedule';

export type DemoBookingStatus = 'BOOKED' | 'COMPLETED' | 'CANCELLED_BY_CLIENT' | 'CANCELLED_BY_SHOP';

export type DemoCalendarBooking = Omit<DemoDayBooking, 'status'> & {
  status: DemoBookingStatus;
};

/** Mon=1 … Sun=7 base slot counts for a busy 4-chair shop (from full 35-seed pool). */
const WEEKDAY_KEEP_COUNTS = [0, 28, 30, 30, 32, 35, 35, 18] as const;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 — deterministic PRNG. */
export function createDemoPrng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoCycleDayIndex(dayKey: string): number {
  const dayOfMonth = Number(dayKey.slice(8, 10));
  if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1) return 0;
  return (dayOfMonth - 1) % 28;
}

function londonWeekdayMon1(dayKey: string): number {
  const isoDow = Number(
    formatInTimeZone(fromZonedTime(`${dayKey}T12:00:00.000`, DEMO_DAY_TZ), DEMO_DAY_TZ, 'i'),
  );
  return Number.isFinite(isoDow) ? isoDow : 1;
}

function atDayKey(dayKey: string, hour: number, minute: number): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return fromZonedTime(`${dayKey}T${hh}:${mm}:00`, DEMO_DAY_TZ).toISOString();
}

function atDayMinute(dayKey: string, dayMinute: number): string {
  return atDayKey(dayKey, Math.floor(dayMinute / 60), dayMinute % 60);
}

/** Trading window (Europe/London) every generated booking has to fit inside. */
const DEMO_DAY_OPEN_MINUTE = 9 * 60;
const DEMO_DAY_CLOSE_MINUTE = 19 * 60;
const DEMO_SLOT_STEP_MINUTES = 5;

type BusyInterval = { startMinute: number; endMinute: number };

function slotIsFree(
  busy: BusyInterval[],
  usedStartMinutes: Set<number>,
  startMinute: number,
  durationMin: number,
): boolean {
  const endMinute = startMinute + durationMin;
  if (startMinute < DEMO_DAY_OPEN_MINUTE || endMinute > DEMO_DAY_CLOSE_MINUTE) return false;
  // Staggered chair starts, so a day never shows two appointments beginning at once.
  if (usedStartMinutes.has(startMinute)) return false;
  return busy.every(
    (interval) => startMinute >= interval.endMinute || endMinute <= interval.startMinute,
  );
}

/** Earliest free slot at or after the seed's own time, wrapping to the start of the day. */
function findFreeSlot(
  busy: BusyInterval[],
  usedStartMinutes: Set<number>,
  desiredMinute: number,
  durationMin: number,
): number | null {
  const latestStart = DEMO_DAY_CLOSE_MINUTE - durationMin;
  const alignedDesired =
    Math.ceil(desiredMinute / DEMO_SLOT_STEP_MINUTES) * DEMO_SLOT_STEP_MINUTES;

  for (let start = alignedDesired; start <= latestStart; start += DEMO_SLOT_STEP_MINUTES) {
    if (slotIsFree(busy, usedStartMinutes, start, durationMin)) return start;
  }
  for (
    let start = DEMO_DAY_OPEN_MINUTE;
    start < alignedDesired && start <= latestStart;
    start += DEMO_SLOT_STEP_MINUTES
  ) {
    if (slotIsFree(busy, usedStartMinutes, start, durationMin)) return start;
  }
  return null;
}

function rotateSeeds(seeds: DemoDaySeed[], offset: number): DemoDaySeed[] {
  if (seeds.length === 0) return [];
  const n = ((offset % seeds.length) + seeds.length) % seeds.length;
  return [...seeds.slice(n), ...seeds.slice(0, n)];
}

/**
 * Build bookings for one calendar day (Europe/London dayKey).
 * `forHistory` marks past days with COMPLETED / cancel mix instead of all BOOKED.
 */
export function getDemoBookingsForDayKey(
  dayKey: string,
  options: { forHistory?: boolean } = {},
): DemoCalendarBooking[] {
  const { forHistory = false } = options;
  const prng = createDemoPrng(hashString(`kersivo-demo|${dayKey}`));
  const cycle = demoCycleDayIndex(dayKey);
  const weekday = londonWeekdayMon1(dayKey);
  const keepCount = WEEKDAY_KEEP_COUNTS[weekday] ?? 28;

  const rotated = rotateSeeds(DEMO_DAY_SEEDS, cycle * 3 + weekday);
  const picked = rotated.slice(0, Math.min(keepCount, rotated.length));

  const shuffled = [...picked];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(prng() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const placed: DemoCalendarBooking[] = [];
  const barberBusy = new Map<string, BusyInterval[]>();
  const usedStartMinutes = new Set<number>();

  shuffled.forEach((seed, index) => {
    const minuteJitter = [0, 5, 10, -5][Math.floor(prng() * 4)]!;
    const desiredMinute = Math.min(
      Math.max(seed.hour * 60 + seed.minute + minuteJitter, DEMO_DAY_OPEN_MINUTE),
      DEMO_DAY_CLOSE_MINUTE - seed.durationMin,
    );

    const busy = barberBusy.get(seed.barberId) ?? [];
    const startMinute = findFreeSlot(busy, usedStartMinutes, desiredMinute, seed.durationMin);
    // Seeds are shuffled, so a chair can already be booked solid; drop the seed rather
    // than trade past closing time.
    if (startMinute === null) return;

    const endMinute = startMinute + seed.durationMin;
    busy.push({ startMinute, endMinute });
    barberBusy.set(seed.barberId, busy);
    usedStartMinutes.add(startMinute);

    const clientSeed = DEMO_DAY_SEEDS[(index + cycle * 5) % DEMO_DAY_SEEDS.length]!;
    const fullName = cycle % 2 === 0 ? seed.fullName : clientSeed.fullName;
    const email = cycle % 2 === 0 ? seed.email : clientSeed.email;

    let status: DemoBookingStatus = 'BOOKED';
    if (forHistory) {
      const roll = prng();
      if (roll < 0.06) status = 'CANCELLED_BY_CLIENT';
      else if (roll < 0.08) status = 'CANCELLED_BY_SHOP';
      else status = 'COMPLETED';
    }

    placed.push({
      id: `demo-${dayKey}-${String(index + 1).padStart(2, '0')}`,
      serviceId: seed.serviceId,
      barberId: seed.barberId,
      fullName,
      email,
      phone: null,
      clientId: null,
      startAt: atDayMinute(dayKey, startMinute),
      endAt: atDayMinute(dayKey, endMinute),
      status,
      notes: null,
      rescheduledAt: null,
      paymentRequired: false,
      depositAmountPence: null,
      paymentStatus: 'NOT_REQUIRED',
      totalPricePence: seed.pricePence,
      serviceNameAtBooking: seed.serviceName,
      servicePricePenceAtBooking: seed.pricePence,
      barber: { name: seed.barberName },
      service: { id: seed.serviceId, name: seed.serviceName },
      clientTags: seed.tags ?? [],
    });
  });

  return placed.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

/** Today’s schedule for timeline / landing (all BOOKED for a live feel). */
export function getSharedDemoDayBookings(now = new Date()): DemoDayBooking[] {
  if (DEMO_DAY_SEEDS.length !== 35) {
    throw new Error(`Demo day schedule must have exactly 35 seeds (got ${DEMO_DAY_SEEDS.length})`);
  }
  const dayKey = demoDaySelectedDate(now);
  return getDemoBookingsForDayKey(dayKey, { forHistory: false }).map((b) => ({
    ...b,
    status: 'BOOKED' as const,
  }));
}

export function getDemoBookingsForDateParam(dayKey: string, now = new Date()): DemoDayBooking[] {
  const todayKey = demoDaySelectedDate(now);
  if (dayKey === todayKey || dayKey > todayKey) {
    return getDemoBookingsForDayKey(dayKey, { forHistory: false }).map((b) => ({
      ...b,
      status: 'BOOKED' as const,
    }));
  }
  return getDemoBookingsForDayKey(dayKey, { forHistory: true }).map((b) => ({
    ...b,
    status: (b.status === 'BOOKED' ? 'COMPLETED' : b.status) as DemoDayBooking['status'],
  }));
}

export function dayKeyDaysAgo(daysAgo: number, now = new Date()): string {
  const todayKey = demoDaySelectedDate(now);
  const anchor = fromZonedTime(`${todayKey}T12:00:00.000`, DEMO_DAY_TZ);
  return formatInTimeZone(
    addMilliseconds(anchor, -daysAgo * 24 * 60 * 60 * 1000),
    DEMO_DAY_TZ,
    'yyyy-MM-dd',
  );
}

/** Past N days of history with unique times and mixed statuses. */
export function getDemoHistoryBookings(days = 21, now = new Date()): DemoCalendarBooking[] {
  const rows: DemoCalendarBooking[] = [];
  for (let ago = days; ago >= 1; ago -= 1) {
    const dayKey = dayKeyDaysAgo(ago, now);
    rows.push(...getDemoBookingsForDayKey(dayKey, { forHistory: true }));
  }
  rows.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  // Guarantee unique startAt across the history window (History list UX).
  const used = new Set<number>();
  for (const row of rows) {
    let startMs = new Date(row.startAt).getTime();
    const duration = new Date(row.endAt).getTime() - startMs;
    while (used.has(startMs)) {
      startMs += 1000;
    }
    used.add(startMs);
    row.startAt = new Date(startMs).toISOString();
    row.endAt = new Date(startMs + duration).toISOString();
  }

  return rows.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}
