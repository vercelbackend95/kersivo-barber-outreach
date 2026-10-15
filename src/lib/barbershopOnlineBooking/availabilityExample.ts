/**
 * The worked availability example for /barbershop-online-booking Section 03.
 *
 * It reads one fixed weekday of the CUTSTATE demo owner timeline (the same generated day
 * /demo/admin shows) and asks the demo's own slot function which Skin Fade start times it would
 * offer with Marcus Bell. The clock is pinned before that day, so the example never depends on
 * the build date and every appointment is still Booked. Only times, durations and service names
 * leave this module — never the fictional client names attached to the demo appointments.
 */
import { formatInTimeZone } from 'date-fns-tz';
import { getBlacklineBookingsForDayKey } from '@/lib/admin/blacklineDemoFixtures/schedule';
import { BLACKLINE_TZ, tradingWindow } from '@/lib/admin/blacklineDemoFixtures/time';
import { listBlacklineAvailableSlots, type BlacklineOccupancyInterval } from '@/lib/demo/blacklineAvailability';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_DEFAULT_SERVICE_SLUG, DEMO_SERVICES, formatDemoPriceGbp } from '@/lib/demo/services';

/** A Wednesday on which all eight of Marcus Bell's template appointments are placed. */
export const EXAMPLE_DAY_KEY = '2027-01-06';
export const EXAMPLE_CLOCK = new Date('2027-01-01T12:00:00.000Z');
export const EXAMPLE_DAY_LABEL = 'Example weekday';
export const EXAMPLE_BARBER_SLUG = 'marcus-bell';
/** The demo slot function steps through the day in 15-minute starts. */
export const EXAMPLE_SLOT_STEP_MINUTES = 15;
/** Start times shown as "not offered", each with the appointment it would run into. */
export const EXAMPLE_NOT_OFFERED = ['11:45', '12:30'] as const;

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
  const window = tradingWindow(EXAMPLE_DAY_KEY);
  const barber = DEMO_BARBERS.find((entry) => entry.slug === EXAMPLE_BARBER_SLUG);
  const service = DEMO_SERVICES.find((entry) => entry.slug === DEMO_DEFAULT_SERVICE_SLUG);
  if (!window || !barber || !service) throw new Error('Availability example: demo day, barber or service missing');

  const rows = getBlacklineBookingsForDayKey(EXAMPLE_DAY_KEY, { now: EXAMPLE_CLOCK }).filter(
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

  const occupancy: BlacklineOccupancyInterval[] = appointments.map((a) => ({
    barberId: barber.id,
    startMinute: a.start,
    endMinute: a.end,
  }));
  const offered = listBlacklineAvailableSlots({
    date: EXAMPLE_DAY_KEY,
    barberId: barber.id,
    durationMinutes: service.durationMinutes,
    now: EXAMPLE_CLOCK,
    occupancy,
  }).map((label) => {
    const start = parseMinute(label);
    const end = start + service.durationMinutes;
    return { start, end, label, endLabel: formatMinute(end) };
  });

  const notOffered = EXAMPLE_NOT_OFFERED.map((label) => {
    const start = parseMinute(label);
    const end = start + service.durationMinutes;
    const blockedBy = appointments.find((a) => start < a.end && a.start < end);
    if (!blockedBy || offered.some((time) => time.label === label)) {
      throw new Error(`Availability example: ${label} is not a blocked start time`);
    }
    return { label, endLabel: formatMinute(end), blockedBy };
  });

  return {
    dayLabel: EXAMPLE_DAY_LABEL,
    barber: { name: barber.name, slug: barber.slug, thumb: `/demo/barbers/thumbs/${barber.slug}-160.webp` },
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
