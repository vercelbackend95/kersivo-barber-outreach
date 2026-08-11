/**
 * Landing "Inside the System" live timeline data.
 *
 * Uses the shared admin-demo day schedule (deterministic 28-day cycle + weekday
 * density, Europe/London, no Neon). Recomputed from the current date on every call.
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import type { TimelineBooking } from '@/components/admin/TodayTimeline';
import { getSharedDemoDayBookings } from '@/lib/admin/demoFixtures/bookingCalendar';
import {
  DEMO_DAY_BARBERS,
  DEMO_DAY_TZ,
  demoDaySelectedDate,
  type DemoDayBarber,
} from '@/lib/admin/demoFixtures/daySchedule';
import { landingDemoClientAvatarForSeed } from '@/lib/landing/landingDemoAssets';
import { LANDING_TIMELINE_SCROLL_FOCUS } from '@/lib/landing/liveTimelineScroll';

export type LandingBarber = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

type LandingTimeBlock = {
  id: string;
  title: string;
  barberId?: string | null;
  startAt: string;
  endAt: string;
};

const FIXTURE_BARBERS: LandingBarber[] = DEMO_DAY_BARBERS.map((barber: DemoDayBarber) => ({
  id: barber.id,
  name: barber.name,
  avatarUrl: barber.avatarUrl,
}));

function timeLabelToMinutes(label: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(label.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** London wall-clock HH:mm for a booking start. */
export function bookingStartLabelLondon(iso: string): string {
  return formatInTimeZone(new Date(iso), DEMO_DAY_TZ, 'HH:mm');
}

function atDayKey(dayKey: string, hour: number, minute: number): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return fromZonedTime(`${dayKey}T${hh}:${mm}:00`, DEMO_DAY_TZ).toISOString();
}

/**
 * Landing-only: guarantee at least one booking starts at the scroll-focus time
 * (default 14:10 Europe/London) so the widget always has a tappable mid-afternoon slot.
 */
export function ensureLandingFocusBooking(
  bookings: TimelineBooking[],
  dayKey: string,
  focus: string = LANDING_TIMELINE_SCROLL_FOCUS,
): TimelineBooking[] {
  const focusMinutes = timeLabelToMinutes(focus);
  if (focusMinutes === null || bookings.length === 0) return bookings;

  if (bookings.some((booking) => bookingStartLabelLondon(booking.startAt) === focus)) {
    return bookings;
  }

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  bookings.forEach((booking, index) => {
    const label = bookingStartLabelLondon(booking.startAt);
    const minutes = timeLabelToMinutes(label);
    if (minutes === null) return;
    const distance = Math.abs(minutes - focusMinutes);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  const focusHour = Math.floor(focusMinutes / 60);
  const focusMinute = focusMinutes % 60;
  const target = bookings[closestIndex]!;
  const durationMs = Math.max(
    5 * 60_000,
    new Date(target.endAt).getTime() - new Date(target.startAt).getTime(),
  );
  const nextStart = atDayKey(dayKey, focusHour, focusMinute);
  const nextEnd = new Date(new Date(nextStart).getTime() + durationMs).toISOString();

  const next = bookings.map((booking, index) =>
    index === closestIndex ? { ...booking, startAt: nextStart, endAt: nextEnd } : { ...booking },
  );

  // Keep one-start-per-slot: nudge any other booking that still shares the focus start.
  return next.map((booking, index) => {
    if (index === closestIndex) return booking;
    if (bookingStartLabelLondon(booking.startAt) !== focus) return booking;

    const duration = Math.max(
      5 * 60_000,
      new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime(),
    );
    const nudgedMinute = Math.min(19 * 60 - 5, focusMinutes + 5);
    const nudgedStart = atDayKey(
      dayKey,
      Math.floor(nudgedMinute / 60),
      nudgedMinute % 60,
    );
    return {
      ...booking,
      startAt: nudgedStart,
      endAt: new Date(new Date(nudgedStart).getTime() + duration).toISOString(),
    };
  });
}

export function getLandingTimelineData(
  _realBarbers?: LandingBarber[],
  now: Date = new Date(),
): {
  barbers: LandingBarber[];
  bookings: TimelineBooking[];
  timeBlocks: LandingTimeBlock[];
  selectedDate: string;
} {
  // Always use fixture barbers — never Neon — so landing matches /admin-demo.
  const barbers = FIXTURE_BARBERS;
  const selectedDate = demoDaySelectedDate(now);
  const bookings: TimelineBooking[] = ensureLandingFocusBooking(
    getSharedDemoDayBookings(now).map((booking) => ({
      id: booking.id,
      fullName: booking.fullName,
      email: booking.email,
      phone: booking.phone,
      clientId: booking.clientId,
      clientAvatarUrl: landingDemoClientAvatarForSeed(booking.id),
      clientTags: booking.clientTags,
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
      barberId: booking.barberId,
      notes: booking.notes,
      rescheduledAt: booking.rescheduledAt,
      paymentRequired: booking.paymentRequired,
      depositAmountPence: booking.depositAmountPence,
      paymentStatus: booking.paymentStatus,
      totalPricePence: booking.totalPricePence,
      servicePricePenceAtBooking: booking.servicePricePenceAtBooking,
      barber: booking.barber,
      service: booking.service,
    })),
    selectedDate,
  );

  return {
    barbers,
    bookings,
    timeBlocks: [],
    selectedDate,
  };
}

export { DEMO_DAY_TZ };
