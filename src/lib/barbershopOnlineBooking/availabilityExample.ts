/**
 * The worked availability example for /barbershop-online-booking Section 03.
 *
 * It reads one fixed weekday of the Heritage Grooming demo owner timeline (the same generated day
 * its owner dashboard shows) and works out which Skin fade start times the diary would offer with
 * Kit Harlow: 15-minute starts inside opening hours that end before his next appointment. The clock is pinned before that day, so the example never depends on
 * the build date and every appointment is still Booked. Only times, durations and service names
 * leave this module — never the fictional client names attached to the demo appointments.
 */
import { HERITAGE_DEMO_BARBERS as DEMO_BARBERS, heritageBarberThumb, HERITAGE_DEMO_DEFAULT_SERVICE_SLUG as DEMO_DEFAULT_SERVICE_SLUG, HERITAGE_DEMO_SERVICES as DEMO_SERVICES } from '@/lib/demo/heritage/demoShapes';
import { formatInTimeZone } from 'date-fns-tz';
import { BLACKLINE_TZ } from '@/lib/admin/blacklineDemoFixtures/time';
import { heritageTradingWindow } from '@/lib/admin/heritageDemoFixtures/catalog';
import { getHeritageBookingsForDayKey } from '@/lib/admin/heritageDemoFixtures/schedule';
import { formatDemoPriceGbp } from '@/lib/demo/services';

/** A Wednesday: Heritage Grooming is open 09:00–19:00 and Kit Harlow is in. */
export const EXAMPLE_DAY_KEY = '2027-01-13';
/** The evening before, so the day is fully booked in and every appointment is still Booked. */
export const EXAMPLE_CLOCK = new Date('2027-01-12T20:00:00.000Z');
export const EXAMPLE_DAY_LABEL = 'Example weekday';
export const EXAMPLE_BARBER_SLUG = 'kit';
/** The diary steps through the day in 15-minute starts. */
export const EXAMPLE_SLOT_STEP_MINUTES = 15;
/** How many "not offered" start times the example explains. */
const NOT_OFFERED_COUNT = 2;

export type DiaryAppointment = {
  start: number;
  end: number;
  duration: number;
  service: string;
  startLabel: string;
  endLabel: string;
};

export type OfferedTime = { start: number; end: number; label: string; endLabel: string };

export type NotOfferedTime = { label: string; endLabel: string; blockedBy: DiaryAppointment };

export type AvailabilityExample = {
  dayLabel: string;
  barber: { name: string; slug: string; thumb: string };
  service: { name: string; duration: number; price: string };
  window: { open: number; close: number; openLabel: string; closeLabel: string };
  appointments: DiaryAppointment[];
  offered: OfferedTime[];
  notOffered: NotOfferedTime[];
};

export const formatMinute = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

const parseMinute = (label: string) => {
  const [h, m] = label.split(':').map(Number);
  return h * 60 + m;
};

const londonMinute = (iso: string) => {
  const date = new Date(iso);
  return Number(formatInTimeZone(date, BLACKLINE_TZ, 'H')) * 60 + Number(formatInTimeZone(date, BLACKLINE_TZ, 'm'));
};

export function buildAvailabilityExample(): AvailabilityExample {
  const window = heritageTradingWindow(EXAMPLE_DAY_KEY);
  const barber = DEMO_BARBERS.find((entry) => entry.slug === EXAMPLE_BARBER_SLUG);
  const service = DEMO_SERVICES.find((entry) => entry.slug === DEMO_DEFAULT_SERVICE_SLUG);
  if (!window || !barber || !service) throw new Error('Availability example: demo day, barber or service missing');

  const rows = getHeritageBookingsForDayKey(EXAMPLE_DAY_KEY, { now: EXAMPLE_CLOCK }).filter(
    (row) => row.barberId === barber.id && row.status === 'BOOKED',
  );
  const appointments: DiaryAppointment[] = rows
    .map((row) => {
      const start = londonMinute(row.startAt);
      const end = londonMinute(row.endAt);
      return {
        start,
        end,
        duration: end - start,
        service: row.serviceNameAtBooking ?? row.service.name,
        startLabel: formatMinute(start),
        endLabel: formatMinute(end),
      };
    })
    .sort((a, b) => a.start - b.start);

  const duration = service.durationMinutes;
  const overlaps = (start: number) => appointments.find((a) => start < a.end && a.start < start + duration);
  const offered: OfferedTime[] = [];
  const blocked: NotOfferedTime[] = [];
  for (let start = window.openMinute; start + duration <= window.closeMinute; start += EXAMPLE_SLOT_STEP_MINUTES) {
    const blockedBy = overlaps(start);
    const end = start + duration;
    if (!blockedBy) offered.push({ start, end, label: formatMinute(start), endLabel: formatMinute(end) });
    // The instructive case: the chair is free at that time, but the cut would run into the next appointment.
    else if (blockedBy.start > start) blocked.push({ label: formatMinute(start), endLabel: formatMinute(end), blockedBy });
  }
  const notOffered = blocked.filter((time) => parseMinute(time.label) >= 10 * 60).slice(0, NOT_OFFERED_COUNT);
  if (offered.length === 0 || notOffered.length < NOT_OFFERED_COUNT) {
    throw new Error('Availability example: the example day needs offered and blocked start times');
  }

  return {
    dayLabel: EXAMPLE_DAY_LABEL,
    barber: { name: barber.name, slug: barber.slug, thumb: heritageBarberThumb(barber.slug) },
    service: { name: service.name, duration: service.durationMinutes, price: formatDemoPriceGbp(service.pricePence) },
    window: {
      open: window.openMinute,
      close: window.closeMinute,
      openLabel: formatMinute(window.openMinute),
      closeLabel: formatMinute(window.closeMinute),
    },
    appointments,
    offered,
    notOffered,
  };
}
