/**
 * Landing "Inside the System" live timeline data.
 *
 * Uses the shared admin-demo day schedule (deterministic 28-day cycle + weekday
 * density, Europe/London, no Neon). Recomputed from the current date on every call.
 */
import type { TimelineBooking } from '@/components/admin/TodayTimeline';
import { getSharedDemoDayBookings } from '@/lib/admin/demoFixtures/bookingCalendar';
import {
  DEMO_DAY_BARBERS,
  DEMO_DAY_TZ,
  demoDaySelectedDate,
  type DemoDayBarber,
} from '@/lib/admin/demoFixtures/daySchedule';
import { landingDemoClientAvatarForSeed } from '@/lib/landing/landingDemoAssets';

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

export function getLandingTimelineData(_realBarbers?: LandingBarber[]): {
  barbers: LandingBarber[];
  bookings: TimelineBooking[];
  timeBlocks: LandingTimeBlock[];
  selectedDate: string;
} {
  // Always use fixture barbers — never Neon — so landing matches /admin-demo.
  const barbers = FIXTURE_BARBERS;
  const bookings: TimelineBooking[] = getSharedDemoDayBookings().map((booking) => ({
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
  }));

  return {
    barbers,
    bookings,
    timeBlocks: [],
    selectedDate: demoDaySelectedDate(),
  };
}

export { DEMO_DAY_TZ };
