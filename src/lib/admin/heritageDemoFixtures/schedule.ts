import type { DemoDayBooking } from '@/lib/admin/demoFixtures/daySchedule';
import { ADMIN_BOOKING_HISTORY_PAGE_SIZE } from '@/lib/admin/bookingHistoryPageSize';
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
} from '@/lib/admin/blacklineDemoFixtures/time';
import {
  HERITAGE_BARBERS,
  getHeritageService,
  type HeritageBarber,
  type HeritageService,
} from '@/lib/demo/heritage/data';
import { HERITAGE_PEOPLE, barberWorksOn, heritageTradingWindow, siteWeekday } from './catalog';

export type HeritageBooking = DemoDayBooking;

/**
 * What each barber is booked for, weighted by the specialities on the team page
 * (Arthur: scissors and beards, Kit: fades, Rafi: open-razor shaves, Owen: beards and line-ups).
 */
const SERVICE_MIX: Readonly<Record<string, ReadonlyArray<readonly [string, number]>>> = {
  arthur: [
    ['haircut', 6],
    ['haircut-beard', 4],
    ['long-hair', 3],
    ['beard-trim', 2],
    ['the-heritage', 2],
    ['clipper-cut', 1],
    ['child-cut', 1],
    ['father-son', 1],
  ],
  kit: [
    ['skin-fade', 7],
    ['fade-beard', 4],
    ['haircut', 2],
    ['line-up', 2],
    ['clipper-cut', 2],
    ['child-fade', 2],
  ],
  rafi: [
    ['hot-towel-shave', 5],
    ['the-heritage', 3],
    ['beard-sculpt', 3],
    ['head-shave', 2],
    ['long-hair', 2],
    ['beard-trim', 1],
  ],
  owen: [
    ['beard-trim', 4],
    ['beard-sculpt', 3],
    ['line-up', 3],
    ['fade-beard', 3],
    ['skin-fade', 2],
    ['hot-towel-shave', 2],
  ],
};

/** Share of the chair that is booked, by site weekday (0 = Sunday). Fridays and Saturdays fill first. */
const FILL_BY_WEEKDAY: Readonly<Record<number, number>> = { 2: 0.7, 3: 0.74, 4: 0.8, 5: 0.88, 6: 0.94 };

const SLOT_GRID_MINUTES = 15;
const DAY_CACHE_MAX = 400;
const dayCache = new Map<string, HeritageBooking[]>();

function cloneBookings(rows: HeritageBooking[]): HeritageBooking[] {
  return rows.map((row) => ({ ...row, barber: { ...row.barber }, service: { ...row.service } }));
}

function pickWeighted<T>(rows: ReadonlyArray<readonly [T, number]>, roll: number): T {
  const total = rows.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = roll * total;
  for (const [value, weight] of rows) {
    cursor -= weight;
    if (cursor < 0) return value;
  }
  return rows[rows.length - 1]![0];
}

function ceilToGrid(minute: number): number {
  return Math.ceil(minute / SLOT_GRID_MINUTES) * SLOT_GRID_MINUTES;
}

/** Earlier clients come back more often, so the client list has regulars. */
function pickPerson(roll: number) {
  const index = Math.min(HERITAGE_PEOPLE.length - 1, Math.floor(Math.pow(roll, 1.6) * HERITAGE_PEOPLE.length));
  return HERITAGE_PEOPLE[index]!;
}

function bookingRow(
  dayKey: string,
  index: number,
  barber: HeritageBarber,
  service: HeritageService,
  startMinute: number,
  person: (typeof HERITAGE_PEOPLE)[number],
): HeritageBooking {
  return {
    id: `hg-${dayKey}-${barber.siteId}-${String(index + 1).padStart(2, '0')}`,
    serviceId: service.id,
    barberId: barber.id,
    fullName: person.fullName,
    email: person.email,
    phone: person.phone,
    clientId: person.id,
    startAt: atDayMinute(dayKey, startMinute),
    endAt: atDayMinute(dayKey, startMinute + service.mins),
    status: 'BOOKED',
    notes: null,
    rescheduledAt: null,
    // The site says "to pay in the shop": Heritage takes no deposits.
    paymentRequired: false,
    depositAmountPence: null,
    paymentStatus: 'NOT_REQUIRED',
    totalPricePence: service.pricePence,
    serviceNameAtBooking: service.name,
    servicePricePenceAtBooking: service.pricePence,
    barber: { name: barber.name },
    service: { id: service.id, name: service.name },
    clientTags: [],
  };
}

/** One barber's chair for one day, as it looks once the day has filled up. */
function placeBarberDay(dayKey: string, barber: HeritageBarber, barberIndex: number): HeritageBooking[] {
  const window = heritageTradingWindow(dayKey);
  if (!window || !barberWorksOn(barber, dayKey)) return [];
  const mix = SERVICE_MIX[barber.siteId];
  if (!mix) return [];

  const weekday = siteWeekday(londonWeekdayMon1(dayKey));
  const fill = FILL_BY_WEEKDAY[weekday] ?? 0.75;
  const prng = createPrng(hashString(`heritage-day|${dayKey}|${barber.siteId}`));
  // A half-hour lunch, staggered so the shop is never empty.
  const lunchStart = 12 * 60 + barberIndex * 30;
  const lunchEnd = lunchStart + 30;

  const rows: HeritageBooking[] = [];
  let cursor = window.openMinute;
  let guard = 0;
  while (cursor < window.closeMinute && guard < 80) {
    guard += 1;
    if (cursor >= lunchStart && cursor < lunchEnd) {
      cursor = lunchEnd;
      continue;
    }
    if (prng() > fill) {
      cursor += prng() < 0.6 ? 15 : 30;
      continue;
    }
    const serviceSiteId = pickWeighted(mix, prng());
    const service = getHeritageService(serviceSiteId);
    if (!service) break;
    const end = cursor + service.mins;
    const crossesLunch = cursor < lunchEnd && end > lunchStart;
    if (end > window.closeMinute || crossesLunch) {
      cursor += SLOT_GRID_MINUTES;
      continue;
    }
    rows.push(bookingRow(dayKey, rows.length, barber, service, cursor, pickPerson(prng())));
    cursor = ceilToGrid(end);
  }
  return rows;
}

function placeDay(dayKey: string): HeritageBooking[] {
  return HERITAGE_BARBERS.flatMap((barber, index) => placeBarberDay(dayKey, barber, index)).sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime() || a.barberId.localeCompare(b.barberId),
  );
}

function applyHistoryStatuses(rows: HeritageBooking[], dayKey: string): HeritageBooking[] {
  const prng = createPrng(hashString(`heritage-history|${dayKey}`));
  return rows.map((row) => {
    const roll = prng();
    if (roll < 0.035) return { ...row, status: 'CANCELLED_BY_CLIENT' };
    if (roll < 0.05) return { ...row, status: 'NO_SHOW' };
    return { ...row, status: 'COMPLETED' };
  });
}

function applyTodayStatuses(rows: HeritageBooking[], dayKey: string, now: Date): HeritageBooking[] {
  const nowMinute = londonNowMinutes(now, dayKey);
  if (nowMinute == null) return applyHistoryStatuses(rows, dayKey);

  const next = rows.map((row) => {
    const end = londonNowMinutes(new Date(row.endAt), dayKey);
    return { ...row, status: end != null && end <= nowMinute ? 'COMPLETED' : 'BOOKED' } as HeritageBooking;
  });

  // One late cancellation and one no-show earlier today, so the owner sees what those look like.
  const past = next.filter((row) => row.status === 'COMPLETED');
  if (past[2]) past[2].status = 'CANCELLED_BY_CLIENT';
  if (past[5]) past[5].status = 'NO_SHOW';

  // The rest of today still has a few free chairs, so a visitor can book one on the site.
  return thinUpcoming(next, dayKey, TODAY_REMAINING_FILL, (row) => {
    const start = londonNowMinutes(new Date(row.startAt), dayKey);
    return start != null && start > nowMinute;
  });
}

/** Share of the remaining appointments today that are already taken. */
const TODAY_REMAINING_FILL = 0.72;

/**
 * Days ahead fill up as they get closer: tomorrow is about two-thirds booked, a fortnight out under a third.
 * Whole appointments drop out of a full day, so the free gaps are real, bookable lengths.
 */
function fillScaleFor(dayKey: string, todayKey: string): number {
  if (dayKey <= todayKey) return 1;
  const ahead = Math.round(
    (londonDayBounds(dayKey).gteMs - londonDayBounds(todayKey).gteMs) / (24 * 60 * 60 * 1000),
  );
  return Math.max(0.3, 0.76 - ahead * 0.06);
}

function thinUpcoming(
  rows: HeritageBooking[],
  dayKey: string,
  keepShare: number,
  isUpcoming: (row: HeritageBooking) => boolean = () => true,
): HeritageBooking[] {
  if (keepShare >= 1) return rows;
  const prng = createPrng(hashString(`heritage-ahead|${dayKey}`));
  return rows.filter((row) => {
    const roll = prng();
    return !isUpcoming(row) || roll < keepShare;
  });
}

export function getHeritageBookingsForDayKey(
  dayKey: string,
  options: { now?: Date; forHistory?: boolean } = {},
): HeritageBooking[] {
  const now = coarseLondonNow(options.now ?? new Date());
  const todayKey = blacklineDayKey(now);
  const forHistory = options.forHistory ?? dayKey < todayKey;
  const fillScale = forHistory ? 1 : fillScaleFor(dayKey, todayKey);
  const mode = forHistory ? 'h' : dayKey === todayKey ? `t:${londonNowMinutes(now, dayKey)}` : `f:${fillScale}`;
  const cacheKey = `${dayKey}|${mode}`;
  const cached = dayCache.get(cacheKey);
  if (cached) return cloneBookings(cached);

  let rows = placeDay(dayKey);
  if (forHistory) rows = applyHistoryStatuses(rows, dayKey);
  else if (dayKey === todayKey) rows = applyTodayStatuses(rows, dayKey, now);
  else rows = thinUpcoming(rows, dayKey, fillScale);

  if (dayCache.size >= DAY_CACHE_MAX) {
    const oldest = dayCache.keys().next().value;
    if (oldest != null) dayCache.delete(oldest);
  }
  dayCache.set(cacheKey, rows);
  return cloneBookings(rows);
}

export function getHeritageBookingsResponse(searchParams?: URLSearchParams, now = new Date()) {
  const clock = coarseLondonNow(now);
  const dateParam = searchParams?.get('date')?.trim();
  const dayKey = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : blacklineDayKey(clock);
  return {
    bookings: getHeritageBookingsForDayKey(dayKey, { now: clock }),
  };
}

function compareHistoryBookingsDesc(a: HeritageBooking, b: HeritageBooking): number {
  const startDelta = new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
  if (startDelta !== 0) return startDelta;
  return b.id.localeCompare(a.id);
}

export function getHeritageHistoryBookings(days = 30, now = new Date()): HeritageBooking[] {
  const clock = coarseLondonNow(now);
  const rows: HeritageBooking[] = [];
  for (let ago = days; ago >= 1; ago -= 1) {
    const dayKey = dayKeyDaysAgo(ago, clock);
    rows.push(...getHeritageBookingsForDayKey(dayKey, { now: clock, forHistory: true }));
  }
  return rows.sort(compareHistoryBookingsDesc);
}

export function getHeritageBookingsHistoryResponse(searchParams?: URLSearchParams, now = new Date()) {
  const params = searchParams ?? new URLSearchParams();
  const barberId = params.get('barberId')?.trim() || 'all';
  const from = params.get('from')?.trim();
  const to = params.get('to')?.trim();
  const q = (params.get('q')?.trim() || '').toLowerCase();
  const includeToday = params.get('scope') === 'past' && params.get('includeToday') === '1';
  const cursor = params.get('cursor')?.trim() || '';
  const limitRaw = Number(params.get('limit') || ADMIN_BOOKING_HISTORY_PAGE_SIZE);
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : ADMIN_BOOKING_HISTORY_PAGE_SIZE));

  let bookings = getHeritageHistoryBookings(30, now);
  if (includeToday) {
    const clock = coarseLondonNow(now);
    bookings = [
      ...getHeritageBookingsForDayKey(blacklineDayKey(clock), { now: clock, forHistory: false }),
      ...bookings,
    ].sort(compareHistoryBookingsDesc);
  }

  if (barberId !== 'all') bookings = bookings.filter((row) => row.barberId === barberId);

  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const { gteMs } = londonDayBounds(from);
    const { ltMs } = londonDayBounds(to);
    bookings = bookings.filter((row) => {
      const startMs = new Date(row.startAt).getTime();
      return startMs >= gteMs && startMs < ltMs;
    });
  }

  if (q) {
    bookings = bookings.filter((row) =>
      [row.fullName, row.email, row.serviceNameAtBooking, row.barber.name, row.status].join(' ').toLowerCase().includes(q),
    );
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

export function getHeritageBookingsStatsResponse(searchParams?: URLSearchParams, now = new Date()) {
  const barberId = searchParams?.get('barberId')?.trim();
  const completed = getHeritageHistoryBookings(30, now).filter((row) => {
    if (row.status !== 'COMPLETED') return false;
    if (barberId && barberId !== 'all') return row.barberId === barberId;
    return true;
  });
  return { totalBookingsServed: completed.length };
}
