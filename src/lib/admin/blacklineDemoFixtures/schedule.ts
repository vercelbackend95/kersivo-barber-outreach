import type { DemoDayBooking } from '@/lib/admin/demoFixtures/daySchedule';
import { ADMIN_BOOKING_HISTORY_PAGE_SIZE } from '@/lib/admin/bookingHistoryPageSize';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { getDemoServiceById } from '@/lib/demo/services';
import { BLACKLINE_PEOPLE } from './catalog';
import {
  atDayMinute,
  blacklineDayKey,
  coarseLondonNow,
  createPrng,
  dayKeyDaysAgo,
  hashString,
  londonDayBounds,
  londonNowMinutes,
  londonWeekdayMon1,
  tradingWindow,
} from './time';

export type BlacklineBooking = DemoDayBooking;

type SlotTemplate = {
  barberIndex: number;
  serviceId: string;
  startMinute: number;
};

const SKIN_FADE_ID = 'bl-svc-skin-fade';
const CLASSIC_CUT_ID = 'bl-svc-haircut-finish';
const HAIRCUT_BEARD_ID = 'bl-svc-haircut-beard';
const HOT_TOWEL_ID = 'bl-svc-hot-towel-shave';

/**
 * 24 candidate chairs across the three BLACKLINE barbers.
 * Gaps are deliberate so the timeline is not a solid block.
 * Service IDs stay on the original four so catalogue expansion cannot desync the day.
 */
const SLOT_TEMPLATES: readonly SlotTemplate[] = [
  { barberIndex: 0, serviceId: SKIN_FADE_ID, startMinute: 9 * 60 },
  { barberIndex: 0, serviceId: CLASSIC_CUT_ID, startMinute: 10 * 60 },
  { barberIndex: 0, serviceId: HAIRCUT_BEARD_ID, startMinute: 11 * 60 },
  { barberIndex: 0, serviceId: SKIN_FADE_ID, startMinute: 13 * 60 },
  { barberIndex: 0, serviceId: CLASSIC_CUT_ID, startMinute: 14 * 60 + 15 },
  { barberIndex: 0, serviceId: HOT_TOWEL_ID, startMinute: 15 * 60 + 15 },
  { barberIndex: 0, serviceId: SKIN_FADE_ID, startMinute: 16 * 60 + 15 },
  { barberIndex: 0, serviceId: CLASSIC_CUT_ID, startMinute: 17 * 60 + 15 },
  { barberIndex: 1, serviceId: CLASSIC_CUT_ID, startMinute: 9 * 60 + 15 },
  { barberIndex: 1, serviceId: HAIRCUT_BEARD_ID, startMinute: 10 * 60 + 15 },
  { barberIndex: 1, serviceId: SKIN_FADE_ID, startMinute: 11 * 60 + 30 },
  { barberIndex: 1, serviceId: HOT_TOWEL_ID, startMinute: 13 * 60 + 15 },
  { barberIndex: 1, serviceId: CLASSIC_CUT_ID, startMinute: 14 * 60 + 15 },
  { barberIndex: 1, serviceId: SKIN_FADE_ID, startMinute: 15 * 60 + 15 },
  { barberIndex: 1, serviceId: HAIRCUT_BEARD_ID, startMinute: 16 * 60 + 15 },
  { barberIndex: 1, serviceId: HOT_TOWEL_ID, startMinute: 17 * 60 + 30 },
  { barberIndex: 2, serviceId: HAIRCUT_BEARD_ID, startMinute: 9 * 60 },
  { barberIndex: 2, serviceId: SKIN_FADE_ID, startMinute: 10 * 60 + 15 },
  { barberIndex: 2, serviceId: CLASSIC_CUT_ID, startMinute: 11 * 60 + 15 },
  { barberIndex: 2, serviceId: HOT_TOWEL_ID, startMinute: 13 * 60 },
  { barberIndex: 2, serviceId: HAIRCUT_BEARD_ID, startMinute: 14 * 60 },
  { barberIndex: 2, serviceId: CLASSIC_CUT_ID, startMinute: 15 * 60 + 15 },
  { barberIndex: 2, serviceId: SKIN_FADE_ID, startMinute: 16 * 60 + 15 },
  { barberIndex: 2, serviceId: CLASSIC_CUT_ID, startMinute: 17 * 60 + 15 },
];

const TARGET_BY_WEEKDAY = [0, 19, 21, 20, 22, 21, 18, 0] as const;

const DAY_CACHE_MAX = 64;
const dayCache = new Map<string, BlacklineBooking[]>();

function cloneBookings(rows: BlacklineBooking[]): BlacklineBooking[] {
  return rows.map((row) => ({ ...row, barber: { ...row.barber }, service: { ...row.service } }));
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function placeDay(dayKey: string): BlacklineBooking[] {
  const window = tradingWindow(dayKey);
  if (!window) return [];

  const weekday = londonWeekdayMon1(dayKey);
  const target = TARGET_BY_WEEKDAY[weekday] ?? 20;
  const prng = createPrng(hashString(`blackline-day|${dayKey}`));
  const rotation = Math.floor(prng() * SLOT_TEMPLATES.length);
  const rotated = [...SLOT_TEMPLATES.slice(rotation), ...SLOT_TEMPLATES.slice(0, rotation)];

  const fitting = rotated.filter((slot) => {
    const service = getDemoServiceById(slot.serviceId);
    if (!service) return false;
    const end = slot.startMinute + service.durationMinutes;
    return slot.startMinute >= window.openMinute && end <= window.closeMinute;
  });

  const keep = fitting.slice(0, Math.min(target, fitting.length));
  const placed: BlacklineBooking[] = [];
  const busy = new Map<string, Array<{ start: number; end: number }>>();

  keep.forEach((slot, index) => {
    const barber = DEMO_BARBERS[slot.barberIndex];
    const service = getDemoServiceById(slot.serviceId);
    if (!barber || !service) return;
    const startMinute = slot.startMinute;
    const endMinute = startMinute + service.durationMinutes;
    const chair = busy.get(barber.id) ?? [];
    if (chair.some((interval) => overlaps(startMinute, endMinute, interval.start, interval.end))) {
      return;
    }
    chair.push({ start: startMinute, end: endMinute });
    busy.set(barber.id, chair);

    const person = BLACKLINE_PEOPLE[(index + Number(dayKey.slice(8, 10)) * 3) % BLACKLINE_PEOPLE.length]!;
    placed.push({
      id: `bl-${dayKey}-${String(index + 1).padStart(2, '0')}`,
      serviceId: service.id,
      barberId: barber.id,
      fullName: person.fullName,
      email: person.email,
      phone: null,
      clientId: person.id,
      startAt: atDayMinute(dayKey, startMinute),
      endAt: atDayMinute(dayKey, endMinute),
      status: 'BOOKED',
      notes: null,
      rescheduledAt: null,
      paymentRequired: false,
      depositAmountPence: null,
      paymentStatus: 'NOT_REQUIRED',
      totalPricePence: service.pricePence,
      serviceNameAtBooking: service.name,
      servicePricePenceAtBooking: service.pricePence,
      barber: { name: barber.name },
      service: { id: service.id, name: service.name },
      clientTags: [],
    });
  });

  return placed.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function applyHistoryStatuses(rows: BlacklineBooking[], dayKey: string): BlacklineBooking[] {
  const prng = createPrng(hashString(`blackline-history|${dayKey}`));
  let cancelled = 0;
  let noShow = 0;
  return rows.map((row, index) => {
    const next = { ...row };
    const roll = prng();
    if (cancelled === 0 && index > 2 && roll < 0.05) {
      next.status = 'CANCELLED_BY_CLIENT';
      cancelled += 1;
      return next;
    }
    if (noShow === 0 && index > 4 && roll >= 0.05 && roll < 0.08) {
      next.status = 'NO_SHOW';
      noShow += 1;
      return next;
    }
    next.status = 'COMPLETED';
    if (index % 11 === 0) {
      next.paymentRequired = true;
      next.depositAmountPence = 1000;
      next.paymentStatus = 'PAID';
    }
    return next;
  });
}

function applyTodayStatuses(rows: BlacklineBooking[], dayKey: string, now: Date): BlacklineBooking[] {
  const nowMinute = londonNowMinutes(now, dayKey);
  const window = tradingWindow(dayKey);
  const next = rows.map((row) => ({ ...row }));

  if (nowMinute == null) {
    return applyHistoryStatuses(next, dayKey);
  }

  for (const row of next) {
    const start = londonNowMinutes(new Date(row.startAt), dayKey);
    const end = londonNowMinutes(new Date(row.endAt), dayKey);
    if (start == null || end == null) continue;
    if (end <= nowMinute) row.status = 'COMPLETED';
    else row.status = 'BOOKED';
  }

  const past = next.filter((row) => row.status === 'COMPLETED');
  if (past[1]) past[1].status = 'CANCELLED_BY_CLIENT';
  if (past[3] && past[3].id !== past[1]?.id) past[3].status = 'NO_SHOW';

  const hasLive = next.some((row) => {
    const start = londonNowMinutes(new Date(row.startAt), dayKey);
    const end = londonNowMinutes(new Date(row.endAt), dayKey);
    return start != null && end != null && start <= nowMinute && nowMinute < end;
  });

  if (!hasLive && window && nowMinute >= window.openMinute && nowMinute < window.closeMinute - 20) {
    ensureInProgress(next, dayKey, nowMinute, window.closeMinute);
  }

  for (const row of next) {
    if (row.status === 'COMPLETED' && row.fullName.startsWith('Theo')) {
      row.paymentRequired = true;
      row.depositAmountPence = 1000;
      row.paymentStatus = 'PAID';
    }
  }

  return next;
}

function ensureInProgress(
  rows: BlacklineBooking[],
  dayKey: string,
  nowMinute: number,
  closeMinute: number,
): void {
  const service = getDemoServiceById(SKIN_FADE_ID);
  if (!service) return;
  const startMinute = Math.floor(nowMinute / 5) * 5;
  const endMinute = startMinute + service.durationMinutes;
  if (endMinute > closeMinute) return;

  const busyByBarber = new Map<string, Array<{ start: number; end: number }>>();
  for (const row of rows) {
    const start = londonNowMinutes(new Date(row.startAt), dayKey);
    const end = londonNowMinutes(new Date(row.endAt), dayKey);
    if (start == null || end == null) continue;
    const list = busyByBarber.get(row.barberId) ?? [];
    list.push({ start, end });
    busyByBarber.set(row.barberId, list);
  }

  const barber = DEMO_BARBERS.find((candidate) => {
    const busy = busyByBarber.get(candidate.id) ?? [];
    return !busy.some((interval) => overlaps(startMinute, endMinute, interval.start, interval.end));
  });
  if (!barber) return;

  const person = BLACKLINE_PEOPLE[0]!;
  rows.push({
    id: `bl-${dayKey}-live`,
    serviceId: service.id,
    barberId: barber.id,
    fullName: person.fullName,
    email: person.email,
    phone: null,
    clientId: person.id,
    startAt: atDayMinute(dayKey, startMinute),
    endAt: atDayMinute(dayKey, endMinute),
    status: 'BOOKED',
    notes: null,
    rescheduledAt: null,
    paymentRequired: false,
    depositAmountPence: null,
    paymentStatus: 'NOT_REQUIRED',
    totalPricePence: service.pricePence,
    serviceNameAtBooking: service.name,
    servicePricePenceAtBooking: service.pricePence,
    barber: { name: barber.name },
    service: { id: service.id, name: service.name },
    clientTags: [],
  });
  rows.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export function getBlacklineBookingsForDayKey(
  dayKey: string,
  options: { now?: Date; forHistory?: boolean } = {},
): BlacklineBooking[] {
  const now = coarseLondonNow(options.now ?? new Date());
  const todayKey = blacklineDayKey(now);
  const forHistory = options.forHistory ?? dayKey < todayKey;
  const cacheKey = `${dayKey}|${forHistory ? 'h' : dayKey === todayKey ? `t:${londonNowMinutes(now, dayKey)}` : 'f'}`;
  const cached = dayCache.get(cacheKey);
  if (cached) return cloneBookings(cached);

  let rows = placeDay(dayKey);
  if (forHistory) rows = applyHistoryStatuses(rows, dayKey);
  else if (dayKey === todayKey) rows = applyTodayStatuses(rows, dayKey, now);

  if (dayCache.size >= DAY_CACHE_MAX) {
    const oldest = dayCache.keys().next().value;
    if (oldest != null) dayCache.delete(oldest);
  }
  dayCache.set(cacheKey, rows);
  return cloneBookings(rows);
}

export function getBlacklineBookingsResponse(searchParams?: URLSearchParams, now = new Date()) {
  const clock = coarseLondonNow(now);
  const dateParam = searchParams?.get('date')?.trim();
  const dayKey =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : blacklineDayKey(clock);
  return {
    bookings: getBlacklineBookingsForDayKey(dayKey, { now: clock }),
  };
}

export function getBlacklineHistoryBookings(days = 30, now = new Date()): BlacklineBooking[] {
  const clock = coarseLondonNow(now);
  const rows: BlacklineBooking[] = [];
  for (let ago = days; ago >= 1; ago -= 1) {
    const dayKey = dayKeyDaysAgo(ago, clock);
    rows.push(...getBlacklineBookingsForDayKey(dayKey, { now: clock, forHistory: true }));
  }
  return rows.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}

export function getBlacklineBookingsHistoryResponse(searchParams?: URLSearchParams, now = new Date()) {
  const params = searchParams ?? new URLSearchParams();
  const barberId = params.get('barberId')?.trim() || 'all';
  const from = params.get('from')?.trim();
  const to = params.get('to')?.trim();
  const q = (params.get('q')?.trim() || '').toLowerCase();
  const cursor = params.get('cursor')?.trim() || '';
  const limitRaw = Number(params.get('limit') || ADMIN_BOOKING_HISTORY_PAGE_SIZE);
  const limit = Math.max(
    1,
    Math.min(100, Number.isFinite(limitRaw) ? limitRaw : ADMIN_BOOKING_HISTORY_PAGE_SIZE),
  );

  let bookings = getBlacklineHistoryBookings(30, now);

  if (barberId && barberId !== 'all') {
    bookings = bookings.filter((row) => row.barberId === barberId);
  }

  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const { gteMs } = londonDayBounds(from);
    const { ltMs } = londonDayBounds(to);
    bookings = bookings.filter((row) => {
      const startMs = new Date(row.startAt).getTime();
      return startMs >= gteMs && startMs < ltMs;
    });
  }

  if (q) {
    bookings = bookings.filter((row) => {
      const haystack = [row.fullName, row.email, row.serviceNameAtBooking, row.barber.name, row.status]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (cursor.includes('|')) {
    const [cursorStartAt, cursorId] = cursor.split('|');
    const cursorMs = cursorStartAt ? new Date(cursorStartAt).getTime() : NaN;
    if (Number.isFinite(cursorMs) && cursorId) {
      bookings = bookings.filter((row) => {
        const startMs = new Date(row.startAt).getTime();
        if (startMs < cursorMs) return true;
        if (startMs > cursorMs) return false;
        return row.id < cursorId;
      });
    }
  }

  const page = bookings.slice(0, limit);
  const hasMore = bookings.length > limit;
  const last = page[page.length - 1];
  return {
    bookings: page,
    hasMore,
    cursor: hasMore && last ? `${last.startAt}|${last.id}` : null,
  };
}

export function getBlacklineBookingsStatsResponse(searchParams?: URLSearchParams, now = new Date()) {
  const barberId = searchParams?.get('barberId')?.trim();
  const history = getBlacklineHistoryBookings(30, now);
  const completed = history.filter((row) => {
    if (row.status !== 'COMPLETED') return false;
    if (barberId && barberId !== 'all') return row.barberId === barberId;
    return true;
  });
  return { totalBookingsServed: completed.length };
}
