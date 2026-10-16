/**
 * Data for the real admin `TodayTimeline` shown in /barbershop-online-booking Section 03.
 *
 * It is the CUTSTATE demo owner timeline (the rows /demo/admin renders) for the same fixed
 * example weekday and clock as `availabilityExample`, so the client times in that example and
 * this timeline come from one set of fixture rows. Barbers carry the same avatars the demo admin
 * loads. Everything is fictional demo data; nothing reads a database.
 */
import type { TimelineBooking } from '@/components/admin/TodayTimeline';
import { getBlacklineBookingsForDayKey } from '@/lib/admin/blacklineDemoFixtures/schedule';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { EXAMPLE_CLOCK, EXAMPLE_DAY_KEY } from './availabilityExample';

export type AvailabilityTimelineBarber = { id: string; name: string; avatarUrl: string };

export type AvailabilityTimelineData = {
  barbers: AvailabilityTimelineBarber[];
  bookings: TimelineBooking[];
  timeBlocks: [];
  selectedDate: string;
};

export function getAvailabilityTimelineData(): AvailabilityTimelineData {
  const bookings: TimelineBooking[] = getBlacklineBookingsForDayKey(EXAMPLE_DAY_KEY, { now: EXAMPLE_CLOCK }).map(
    (row) => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      clientId: row.clientId,
      clientTags: row.clientTags,
      status: row.status,
      startAt: row.startAt,
      endAt: row.endAt,
      barberId: row.barberId,
      notes: row.notes,
      rescheduledAt: row.rescheduledAt,
      paymentRequired: row.paymentRequired,
      depositAmountPence: row.depositAmountPence,
      paymentStatus: row.paymentStatus,
      totalPricePence: row.totalPricePence,
      servicePricePenceAtBooking: row.servicePricePenceAtBooking,
      barber: { name: row.barber.name },
      service: { id: row.service.id, name: row.service.name },
    }),
  );

  return {
    barbers: DEMO_BARBERS.map((barber) => ({ id: barber.id, name: barber.name, avatarUrl: barber.image.src })),
    bookings,
    timeBlocks: [],
    selectedDate: EXAMPLE_DAY_KEY,
  };
}
