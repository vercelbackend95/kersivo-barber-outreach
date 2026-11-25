/**
 * Data for the real KERSIVO owner timeline (`TodayTimeline`) on /barbershop-online-booking.
 *
 * Runs in the browser only (loaded by `BobLiveTimeline`). It takes the same Heritage Grooming demo
 * weekday the hero simulator and the availability example are built on, and moves its appointments
 * onto today's date in London, so the timeline shows its live "now" line the way the owner sees it.
 * The wall-clock times stay exactly as the simulator offers them.
 *
 * Client-safe: no Prisma, no `@/lib/db/*`, no Node built-ins (see deferredWidgetClientSafe.test.ts).
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import type { TimelineBooking } from '@/components/admin/TodayTimeline';
import { getHeritageBookingsForDayKey } from '@/lib/admin/heritageDemoFixtures/schedule';
import { HERITAGE_BARBERS } from '@/lib/demo/heritage/data';
import { landingDemoClientAvatarForSeed } from '@/lib/landing/landingDemoAssets';
import { EXAMPLE_CLOCK, EXAMPLE_DAY_KEY } from './availabilityExample';

export const LIVE_DIARY_TZ = 'Europe/London';

export type LiveDiaryBarber = { id: string; name: string; avatarUrl?: string | null };

export type LiveDiary = {
  selectedDate: string;
  barbers: LiveDiaryBarber[];
  bookings: TimelineBooking[];
};

/** Today in London as yyyy-MM-dd. */
export function londonDayKey(now: Date = new Date()): string {
  return formatInTimeZone(now, LIVE_DIARY_TZ, 'yyyy-MM-dd');
}

/** ISO instant for a London wall-clock minute on `dayKey`. */
export function isoAt(dayKey: string, minute: number): string {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return fromZonedTime(`${dayKey}T${hh}:${mm}:00`, LIVE_DIARY_TZ).toISOString();
}

/** London wall-clock minute of an ISO instant. */
export function londonMinuteOf(iso: string): number {
  const date = new Date(iso);
  return Number(formatInTimeZone(date, LIVE_DIARY_TZ, 'H')) * 60 + Number(formatInTimeZone(date, LIVE_DIARY_TZ, 'm'));
}

/**
 * The demo weekday, moved onto `dayKey`. Only Booked appointments, the same set the simulator
 * works out free times from. `barberIds` limits it to some barbers (the availability example
 * shows one).
 */
export function buildLiveDiary(options: { barberIds?: string[]; now?: Date } = {}): LiveDiary {
  const selectedDate = londonDayKey(options.now);
  const keep = options.barberIds ? new Set(options.barberIds) : null;
  const barbers = HERITAGE_BARBERS.filter((barber) => !keep || keep.has(barber.id)).map((barber) => ({
    id: barber.id,
    name: barber.name,
    avatarUrl: barber.avatarSrc,
  }));
  const ids = new Set(barbers.map((barber) => barber.id));

  const bookings: TimelineBooking[] = getHeritageBookingsForDayKey(EXAMPLE_DAY_KEY, { now: EXAMPLE_CLOCK })
    .filter((row) => row.status === 'BOOKED' && row.barberId && ids.has(row.barberId))
    .map((row) => ({
      id: `bob-${row.id}`,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      clientId: null,
      clientAvatarUrl: landingDemoClientAvatarForSeed(row.id),
      clientTags: row.clientTags,
      status: row.status,
      startAt: isoAt(selectedDate, londonMinuteOf(row.startAt)),
      endAt: isoAt(selectedDate, londonMinuteOf(row.endAt)),
      barberId: row.barberId,
      notes: row.notes,
      rescheduledAt: null,
      paymentRequired: row.paymentRequired,
      depositAmountPence: row.depositAmountPence,
      paymentStatus: row.paymentStatus,
      totalPricePence: row.totalPricePence,
      servicePricePenceAtBooking: row.servicePricePenceAtBooking,
      barber: row.barber,
      service: { id: row.service.id, name: row.serviceNameAtBooking ?? row.service.name },
    }));

  return { selectedDate, barbers, bookings };
}

