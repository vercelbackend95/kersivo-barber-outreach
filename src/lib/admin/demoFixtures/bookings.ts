import { addMilliseconds } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { ADMIN_BOOKING_HISTORY_PAGE_SIZE } from '../bookingHistoryPageSize';
import {
  getDemoBookingsForDateParam,
  getDemoHistoryBookings,
  getSharedDemoDayBookings,
} from './bookingCalendar';
import { DEMO_DAY_TZ, demoDaySelectedDate } from './daySchedule';

export function getDemoBookingsResponse(searchParams?: URLSearchParams) {
  const dateParam = searchParams?.get('date')?.trim();
  const dayKey =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : demoDaySelectedDate();
  return {
    bookings: getDemoBookingsForDateParam(dayKey),
  };
}

export const demoTimeblocksResponse = {
  timeBlocks: [],
};

function londonDayBounds(dayKey: string): { gteMs: number; ltMs: number } {
  const gteMs = fromZonedTime(`${dayKey}T00:00:00.000`, DEMO_DAY_TZ).getTime();
  const ltMs = addMilliseconds(new Date(gteMs), 24 * 60 * 60 * 1000).getTime();
  return { gteMs, ltMs };
}

export function getDemoBookingsHistoryResponse(searchParams?: URLSearchParams) {
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

  let bookings = getDemoHistoryBookings(21);

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
      const haystack = [
        row.fullName,
        row.email,
        row.serviceNameAtBooking,
        row.barber.name,
        row.status,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  // Newest first (already sorted); cursor = `${startAt}|${id}` like live API.
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
  const nextCursor = hasMore && last ? `${last.startAt}|${last.id}` : null;

  return {
    bookings: page,
    hasMore,
    cursor: nextCursor,
  };
}

export function getDemoBookingsStatsResponse(searchParams?: URLSearchParams) {
  const barberId = searchParams?.get('barberId')?.trim();
  const history = getDemoHistoryBookings(30);
  const completed = history.filter((row) => {
    if (row.status !== 'COMPLETED') return false;
    if (barberId && barberId !== 'all') return row.barberId === barberId;
    return true;
  });
  return { totalBookingsServed: completed.length };
}

export { getSharedDemoDayBookings };
