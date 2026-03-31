import type { Barber } from '../../components/admin/barbersTypes';

export type BarberBookingPreview = {
  barberId: string;
  status: string;
  startAt: string;
  service?: {
    name?: string | null;
  } | null;
};

export type NextBookingPreview = {
  timeLabel: string;
  relativeLabel: string;
  serviceLabel: string;
};

export type BarberAvailabilityStatus = 'busy' | 'active' | 'free' | 'off';

export type DayFillData = {
  pct: number;
  count: number;
  workingH: number;
};

export const AVAIL_STATUS_LABELS: Record<BarberAvailabilityStatus, string> = {
  busy: 'Busy',
  active: 'Has bookings today',
  free: 'Available',
  off: 'Off today',
};

export const WORKING_HOURS_PER_DAY = 8;
export const ESTIMATED_BOOKING_DURATION_H = 0.75;

const SCHEDULED_BOOKING_STATUSES = ['CONFIRMED', 'PENDING', 'PENDING_CONFIRMATION', 'RESCHEDULED'] as const;

function formatTimeHHMM(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatRelative(date: Date, now: Date) {
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return 'now';
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 60) return `in ${Math.max(1, diffMinutes)}m`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `in ${Math.max(1, diffHours)}h`;

  if (diffHours < 48) return 'tomorrow';

  const diffDays = Math.round(diffHours / 24);
  return `in ${Math.max(2, diffDays)}d`;
}

export function truncateServiceLabel(serviceName: string) {
  const trimmed = serviceName.trim();
  if (!trimmed) return 'Service';
  if (trimmed.length <= 20) return trimmed;
  return `${trimmed.slice(0, 17)}...`;
}

/** Local calendar day bounds for the given `now` (matches previous BarbersOverview behaviour). */
export function getLocalDayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function getTodayBookingsForBarber(bookings: BarberBookingPreview[], barberId: string, now: Date) {
  const { startMs, endMs } = getLocalDayBounds(now);
  return bookings.filter((b) => {
    if (b.barberId !== barberId) return false;
    if (!SCHEDULED_BOOKING_STATUSES.includes(b.status as (typeof SCHEDULED_BOOKING_STATUSES)[number])) return false;
    const t = new Date(b.startAt).getTime();
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
}

/**
 * Bookings for a barber within an explicit UTC/London-safe range (e.g. selected admin day).
 * Use when `bookings` are already scoped to one day — range should match that day.
 */
export function getBookingsForBarberInRange(
  bookings: BarberBookingPreview[],
  barberId: string,
  startMs: number,
  endMs: number
) {
  return bookings.filter((b) => {
    if (b.barberId !== barberId) return false;
    if (!SCHEDULED_BOOKING_STATUSES.includes(b.status as (typeof SCHEDULED_BOOKING_STATUSES)[number])) return false;
    const t = new Date(b.startAt).getTime();
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
}

export function getBarberAvailabilityStatus(barber: Barber, bookings: BarberBookingPreview[], now: Date): BarberAvailabilityStatus {
  if (barber.todayIsOnShift === false || barber.todayLabel?.trim() === 'Off') {
    return 'off';
  }

  const todayBookings = getTodayBookingsForBarber(bookings, barber.id, now);
  if (todayBookings.length === 0) return 'free';

  const nowMs = now.getTime();
  const BUSY_WINDOW_MS = 90 * 60 * 1000;
  const isBusy = todayBookings.some((b) => {
    const startMs = new Date(b.startAt).getTime();
    return startMs <= nowMs && nowMs - startMs <= BUSY_WINDOW_MS;
  });

  return isBusy ? 'busy' : 'active';
}

export function getBarberAvailabilityStatusForDayRange(
  barber: Barber,
  bookings: BarberBookingPreview[],
  now: Date,
  dayStartMs: number,
  dayEndMs: number
): BarberAvailabilityStatus {
  if (barber.todayIsOnShift === false || barber.todayLabel?.trim() === 'Off') {
    return 'off';
  }

  const dayBookings = getBookingsForBarberInRange(bookings, barber.id, dayStartMs, dayEndMs);
  if (dayBookings.length === 0) return 'free';

  const nowMs = now.getTime();
  const BUSY_WINDOW_MS = 90 * 60 * 1000;
  const isBusy = dayBookings.some((b) => {
    const startMs = new Date(b.startAt).getTime();
    return startMs <= nowMs && nowMs - startMs <= BUSY_WINDOW_MS;
  });

  return isBusy ? 'busy' : 'active';
}

export function getDayFill(bookings: BarberBookingPreview[], barberId: string, now: Date): DayFillData {
  const count = getTodayBookingsForBarber(bookings, barberId, now).length;
  const estimatedH = count * ESTIMATED_BOOKING_DURATION_H;
  const pct = Math.min(100, Math.round((estimatedH / WORKING_HOURS_PER_DAY) * 100));
  return { pct, count, workingH: WORKING_HOURS_PER_DAY };
}

export function getDayFillForRange(bookings: BarberBookingPreview[], barberId: string, dayStartMs: number, dayEndMs: number): DayFillData {
  const count = getBookingsForBarberInRange(bookings, barberId, dayStartMs, dayEndMs).length;
  const estimatedH = count * ESTIMATED_BOOKING_DURATION_H;
  const pct = Math.min(100, Math.round((estimatedH / WORKING_HOURS_PER_DAY) * 100));
  return { pct, count, workingH: WORKING_HOURS_PER_DAY };
}

export function getNextBookingForBarber(bookings: BarberBookingPreview[], barberId: string, now: Date): NextBookingPreview | null {
  const nowMs = now.getTime();
  const nextBooking = bookings
    .filter((booking) => booking.barberId === barberId)
    .filter((booking) => {
      if (!SCHEDULED_BOOKING_STATUSES.includes(booking.status as (typeof SCHEDULED_BOOKING_STATUSES)[number])) return false;
      const startAtMs = new Date(booking.startAt).getTime();
      return Number.isFinite(startAtMs) && startAtMs > nowMs;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];

  if (!nextBooking) return null;

  const startDate = new Date(nextBooking.startAt);

  return {
    timeLabel: formatTimeHHMM(startDate),
    relativeLabel: formatRelative(startDate, now),
    serviceLabel: truncateServiceLabel(nextBooking.service?.name ?? ''),
  };
}

export function getTodayLine(barber: Barber) {
  const todayLabel = barber.todayLabel?.trim() || '—';
  if (todayLabel === 'Off') {
    return { text: 'Today: Off', title: 'Today: Off', isOff: true };
  }
  return { text: `Today: ${todayLabel}`, title: `Today: ${todayLabel}`, isOff: false };
}
