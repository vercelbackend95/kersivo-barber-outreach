/**
 * Data for the /barbershop-online-booking hero simulator and diary scrubber.
 *
 * Built on the server from one fixed weekday of the Heritage Grooming demo diary (the same day the
 * availability example uses), so every time the page offers is a time the demo diary really has
 * free. Only service names, durations and times leave this module, never the fictional client
 * names attached to the demo appointments. The pure helpers below run in the browser too.
 */
import { formatInTimeZone } from 'date-fns-tz';
import { BLACKLINE_TZ } from '@/lib/admin/blacklineDemoFixtures/time';
import { barberWorksOn, heritageTradingWindow } from '@/lib/admin/heritageDemoFixtures/catalog';
import { HERITAGE_BARBERS } from '@/lib/demo/heritage/data';
import { getHeritageBookingsForDayKey } from '@/lib/admin/heritageDemoFixtures/schedule';
import {
  HERITAGE_DEMO_BARBERS,
  HERITAGE_DEMO_SERVICES,
  getHeritageFeaturedServices,
  heritageBarberThumb,
} from '@/lib/demo/heritage/demoShapes';
import { EXAMPLE_CLOCK, EXAMPLE_DAY_KEY, EXAMPLE_SLOT_STEP_MINUTES } from './availabilityExample';
import { type SimAppointment, offeredStarts } from './bookingTimes';

export * from './bookingTimes';

export type SimService = {
  id: string;
  name: string;
  duration: number;
  pricePence: number;
  description: string;
};

export type SimBarber = {
  id: string;
  name: string;
  firstName: string;
  role: string;
  thumb: string;
  /** False when the barber is off on the example day: shown, but cannot be picked. */
  working: boolean;
  appointments: SimAppointment[];
};

export type BookingSimulatorData = {
  open: number;
  close: number;
  step: number;
  services: SimService[];
  barbers: SimBarber[];
};

const londonMinute = (iso: string) => {
  const date = new Date(iso);
  return Number(formatInTimeZone(date, BLACKLINE_TZ, 'H')) * 60 + Number(formatInTimeZone(date, BLACKLINE_TZ, 'm'));
};

export function buildBookingSimulatorData(): BookingSimulatorData {
  const window = heritageTradingWindow(EXAMPLE_DAY_KEY);
  if (!window) throw new Error('Booking simulator: the example day is closed');
  const rows = getHeritageBookingsForDayKey(EXAMPLE_DAY_KEY, { now: EXAMPLE_CLOCK }).filter((row) => row.status === 'BOOKED');

  const barbers: SimBarber[] = HERITAGE_DEMO_BARBERS.map((barber) => ({
    id: barber.id,
    name: barber.name,
    firstName: barber.name.split(' ')[0] ?? barber.name,
    role: barber.specialisation,
    thumb: heritageBarberThumb(barber.slug),
    working: HERITAGE_BARBERS.some((entry) => entry.id === barber.id && barberWorksOn(entry, EXAMPLE_DAY_KEY)),
    appointments: rows
      .filter((row) => row.barberId === barber.id)
      .map((row) => ({
        start: londonMinute(row.startAt),
        end: londonMinute(row.endAt),
        service: row.serviceNameAtBooking ?? row.service.name,
      }))
      .sort((a, b) => a.start - b.start),
  }));

  const services: SimService[] = getHeritageFeaturedServices().map((service) => ({
    id: service.id,
    name: service.name,
    duration: service.durationMinutes,
    pricePence: service.pricePence,
    description: service.description ?? '',
  }));

  const working = barbers.filter((barber) => barber.working);
  if (services.length < 3 || working.length < 2 || working.some((barber) => barber.appointments.length === 0)) {
    throw new Error('Booking simulator: the example day needs services and a booked diary for every barber');
  }
  for (const barber of working) {
    if (services.every((service) => offeredStarts(barber.appointments, window.openMinute, window.closeMinute, service.duration).length === 0)) {
      throw new Error(`Booking simulator: ${barber.name} has no free time on the example day`);
    }
  }

  return {
    open: window.openMinute,
    close: window.closeMinute,
    step: EXAMPLE_SLOT_STEP_MINUTES,
    services,
    barbers,
  };
}

/** Services used by the diary scrubber: short to long, so the effect of length is easy to see. */
export function scrubberServices(): SimService[] {
  const slugs = ['beard-trim', 'skin-fade', 'haircut-beard', 'the-heritage'];
  const picked = slugs.flatMap((slug) => {
    const service = HERITAGE_DEMO_SERVICES.find((item) => item.slug === slug);
    return service
      ? [{ id: service.id, name: service.name, duration: service.durationMinutes, pricePence: service.pricePence, description: service.description ?? '' }]
      : [];
  });
  return picked.length >= 3 ? picked : getHeritageFeaturedServices().slice(0, 4).map((service) => ({
    id: service.id,
    name: service.name,
    duration: service.durationMinutes,
    pricePence: service.pricePence,
    description: service.description ?? '',
  }));
}
