/**
 * Shared static demo day schedule — single source of truth for:
 * - `/admin-demo` bookings timeline
 * - Landing `InsideSystemLiveWidget`
 *
 * 35 BOOKED appointments, 09:00–19:00 Europe/London, re-anchored to "today"
 * every call. No Neon/Prisma.
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { LANDING_DEMO_BARBER_AVATARS } from '@/lib/landing/landingDemoAssets';
import { DEMO_BARBER_IDS, DEMO_SERVICE_IDS } from './ids';

export const DEMO_DAY_TZ = 'Europe/London' as const;

export type DemoDayBarber = {
  id: string;
  name: string;
  avatarUrl: string;
};

export type DemoDaySeed = {
  id: string;
  fullName: string;
  email: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  hour: number;
  minute: number;
  durationMin: number;
  pricePence: number;
  tags?: string[];
};

export type DemoDayBookingStatus =
  | 'BOOKED'
  | 'COMPLETED'
  | 'CANCELLED_BY_CLIENT'
  | 'CANCELLED_BY_SHOP'
  | 'NO_SHOW';

export type DemoDayBooking = {
  id: string;
  serviceId: string;
  barberId: string;
  fullName: string;
  email: string;
  phone: null;
  clientId: string | null;
  startAt: string;
  endAt: string;
  status: DemoDayBookingStatus;
  notes: null;
  rescheduledAt: null;
  paymentRequired: boolean;
  depositAmountPence: number | null;
  paymentStatus: 'NOT_REQUIRED' | 'UNPAID' | 'PAID';
  totalPricePence: number;
  serviceNameAtBooking: string;
  servicePricePenceAtBooking: number;
  barber: { name: string };
  service: { id: string; name: string };
  clientTags: string[];
};

export const DEMO_DAY_BARBERS: DemoDayBarber[] = [
  { id: DEMO_BARBER_IDS.jamie, name: 'Jamie Reed', avatarUrl: LANDING_DEMO_BARBER_AVATARS.jamie },
  { id: DEMO_BARBER_IDS.alex, name: 'Alex Morgan', avatarUrl: LANDING_DEMO_BARBER_AVATARS.alex },
  { id: DEMO_BARBER_IDS.sam, name: 'Sam Brooks', avatarUrl: LANDING_DEMO_BARBER_AVATARS.sam },
  { id: DEMO_BARBER_IDS.marcus, name: 'Marcus Bell', avatarUrl: LANDING_DEMO_BARBER_AVATARS.marcus },
];

const J = DEMO_BARBER_IDS.jamie;
const A = DEMO_BARBER_IDS.alex;
const S = DEMO_BARBER_IDS.sam;
const M = DEMO_BARBER_IDS.marcus;

/**
 * Exactly 35 seeds. All BOOKED. No same-barber overlaps.
 * Window: starts from 09:00, last slots finish by 19:00 Europe/London.
 * Jamie 9 · Alex 9 · Sam 9 · Marcus 8.
 */
export const DEMO_DAY_SEEDS: DemoDaySeed[] = [
  // Jamie Reed (9)
  { id: 'demo-day-01', fullName: 'Oliver Reed', email: 'oliver.reed@example.com', barberId: J, barberName: 'Jamie Reed', serviceId: DEMO_SERVICE_IDS.skinFadeWithHaircut, serviceName: 'Skin fade with haircut', hour: 9, minute: 0, durationMin: 45, pricePence: 4000, tags: ['Regular'] },
  { id: 'demo-day-02', fullName: 'Miles Clarke', email: 'miles.clarke@example.com', barberId: J, barberName: 'Jamie Reed', serviceId: DEMO_SERVICE_IDS.premiumHaircut, serviceName: 'Premium haircut', hour: 10, minute: 0, durationMin: 45, pricePence: 4500 },
  { id: 'demo-day-03', fullName: 'Leo Carter', email: 'leo.carter@example.com', barberId: J, barberName: 'Jamie Reed', serviceId: DEMO_SERVICE_IDS.qualityHaircut, serviceName: 'Quality haircut', hour: 11, minute: 0, durationMin: 30, pricePence: 3500 },
  { id: 'demo-day-04', fullName: 'Harry Watson', email: 'harry.watson@example.com', barberId: J, barberName: 'Jamie Reed', serviceId: DEMO_SERVICE_IDS.shortBackAndSides, serviceName: 'Short back and sides clipper', hour: 11, minute: 45, durationMin: 25, pricePence: 3000 },
  { id: 'demo-day-05', fullName: 'James Foster', email: 'james.foster@example.com', barberId: J, barberName: 'Jamie Reed', serviceId: DEMO_SERVICE_IDS.skinFadeWithHaircut, serviceName: 'Skin fade with haircut', hour: 12, minute: 30, durationMin: 45, pricePence: 4000, tags: ['VIP'] },
  { id: 'demo-day-06', fullName: 'Theo Hughes', email: 'theo.hughes@example.com', barberId: J, barberName: 'Jamie Reed', serviceId: DEMO_SERVICE_IDS.expressShave, serviceName: 'Express shave', hour: 13, minute: 30, durationMin: 20, pricePence: 2500 },
  { id: 'demo-day-07', fullName: 'Mason Field', email: 'mason.field@example.com', barberId: J, barberName: 'Jamie Reed', serviceId: DEMO_SERVICE_IDS.skinFadeBackSides, serviceName: 'Skin fade back n sides only', hour: 14, minute: 15, durationMin: 25, pricePence: 3000 },
  { id: 'demo-day-08', fullName: 'Aaron Webb', email: 'aaron.webb@example.com', barberId: J, barberName: 'Jamie Reed', serviceId: DEMO_SERVICE_IDS.qualityHaircut, serviceName: 'Quality haircut', hour: 15, minute: 0, durationMin: 30, pricePence: 3500 },
  { id: 'demo-day-09', fullName: 'Callum Price', email: 'callum.price@example.com', barberId: J, barberName: 'Jamie Reed', serviceId: DEMO_SERVICE_IDS.skinFadeWithHaircut, serviceName: 'Skin fade with haircut', hour: 17, minute: 30, durationMin: 45, pricePence: 4000 },
  // Alex Morgan (9)
  { id: 'demo-day-10', fullName: 'Noah Bennett', email: 'noah.bennett@example.com', barberId: A, barberName: 'Alex Morgan', serviceId: DEMO_SERVICE_IDS.qualityHaircut, serviceName: 'Quality haircut', hour: 9, minute: 0, durationMin: 30, pricePence: 3500 },
  { id: 'demo-day-11', fullName: 'Isaac Morgan', email: 'isaac.morgan@example.com', barberId: A, barberName: 'Alex Morgan', serviceId: DEMO_SERVICE_IDS.qualityBeardTrim, serviceName: 'Quality beard trim', hour: 9, minute: 45, durationMin: 15, pricePence: 1500 },
  { id: 'demo-day-12', fullName: 'Charlie Evans', email: 'charlie.evans@example.com', barberId: A, barberName: 'Alex Morgan', serviceId: DEMO_SERVICE_IDS.premiumHaircut, serviceName: 'Premium haircut', hour: 10, minute: 15, durationMin: 45, pricePence: 4500, tags: ['New'] },
  { id: 'demo-day-13', fullName: 'Jack Turner', email: 'jack.turner@example.com', barberId: A, barberName: 'Alex Morgan', serviceId: DEMO_SERVICE_IDS.skinFadeWithHaircut, serviceName: 'Skin fade with haircut', hour: 11, minute: 15, durationMin: 45, pricePence: 4000 },
  { id: 'demo-day-14', fullName: 'Louis Grant', email: 'louis.grant@example.com', barberId: A, barberName: 'Alex Morgan', serviceId: DEMO_SERVICE_IDS.luxuryWetShave, serviceName: 'Luxury wet shave', hour: 12, minute: 15, durationMin: 40, pricePence: 4000 },
  { id: 'demo-day-15', fullName: 'Ryan Shaw', email: 'ryan.shaw@example.com', barberId: A, barberName: 'Alex Morgan', serviceId: DEMO_SERVICE_IDS.premiumBeardTrim, serviceName: 'Premium beard trim', hour: 13, minute: 15, durationMin: 25, pricePence: 3000 },
  { id: 'demo-day-16', fullName: 'Dylan Reid', email: 'dylan.reid@example.com', barberId: A, barberName: 'Alex Morgan', serviceId: DEMO_SERVICE_IDS.skinFadeWithHaircut, serviceName: 'Skin fade with haircut', hour: 14, minute: 0, durationMin: 45, pricePence: 4000, tags: ['Regular'] },
  { id: 'demo-day-17', fullName: 'Ethan Walsh', email: 'ethan.walsh@example.com', barberId: A, barberName: 'Alex Morgan', serviceId: DEMO_SERVICE_IDS.headShave, serviceName: 'Head shave', hour: 15, minute: 0, durationMin: 20, pricePence: 2500 },
  { id: 'demo-day-18', fullName: 'Gabriel Turner', email: 'gabriel.turner@example.com', barberId: A, barberName: 'Alex Morgan', serviceId: DEMO_SERVICE_IDS.longerBeardTrim, serviceName: 'Longer beard trim', hour: 17, minute: 45, durationMin: 35, pricePence: 4000 },
  // Sam Brooks (9)
  { id: 'demo-day-19', fullName: 'Daniel Price', email: 'daniel.price@example.com', barberId: S, barberName: 'Sam Brooks', serviceId: DEMO_SERVICE_IDS.clippersOnly, serviceName: 'Clippers only', hour: 9, minute: 0, durationMin: 15, pricePence: 1500 },
  { id: 'demo-day-20', fullName: 'Max Brooks', email: 'max.brooks@example.com', barberId: S, barberName: 'Sam Brooks', serviceId: DEMO_SERVICE_IDS.qualityHaircut, serviceName: 'Quality haircut', hour: 9, minute: 30, durationMin: 30, pricePence: 3500 },
  { id: 'demo-day-21', fullName: 'Felix Hughes', email: 'felix.hughes@example.com', barberId: S, barberName: 'Sam Brooks', serviceId: DEMO_SERVICE_IDS.longerHaircut, serviceName: 'Longer haircut', hour: 10, minute: 15, durationMin: 60, pricePence: 6500, tags: ['VIP'] },
  { id: 'demo-day-22', fullName: 'Seth Lane', email: 'seth.lane@example.com', barberId: S, barberName: 'Sam Brooks', serviceId: DEMO_SERVICE_IDS.premiumBeardTrim, serviceName: 'Premium beard trim', hour: 11, minute: 30, durationMin: 25, pricePence: 3000 },
  { id: 'demo-day-23', fullName: 'Connor Walsh', email: 'connor.walsh@example.com', barberId: S, barberName: 'Sam Brooks', serviceId: DEMO_SERVICE_IDS.qualityHaircut, serviceName: 'Quality haircut', hour: 12, minute: 15, durationMin: 30, pricePence: 3500 },
  { id: 'demo-day-24', fullName: 'Nathan Cole', email: 'nathan.cole@example.com', barberId: S, barberName: 'Sam Brooks', serviceId: DEMO_SERVICE_IDS.friction, serviceName: 'Friction', hour: 13, minute: 0, durationMin: 15, pricePence: 1500 },
  { id: 'demo-day-25', fullName: 'Rory Ellis', email: 'rory.ellis@example.com', barberId: S, barberName: 'Sam Brooks', serviceId: DEMO_SERVICE_IDS.longerHaircut, serviceName: 'Longer haircut', hour: 13, minute: 30, durationMin: 60, pricePence: 6500 },
  { id: 'demo-day-26', fullName: 'Ben Archer', email: 'ben.archer@example.com', barberId: S, barberName: 'Sam Brooks', serviceId: DEMO_SERVICE_IDS.clippersOnly, serviceName: 'Clippers only', hour: 15, minute: 0, durationMin: 15, pricePence: 1500 },
  { id: 'demo-day-27', fullName: 'Oscar Miles', email: 'oscar.miles@example.com', barberId: S, barberName: 'Sam Brooks', serviceId: DEMO_SERVICE_IDS.qualityHaircut, serviceName: 'Quality haircut', hour: 17, minute: 30, durationMin: 30, pricePence: 3500, tags: ['New'] },
  // Marcus Bell (8)
  { id: 'demo-day-28', fullName: 'Lucas Hart', email: 'lucas.hart@example.com', barberId: M, barberName: 'Marcus Bell', serviceId: DEMO_SERVICE_IDS.qualityBeardTrim, serviceName: 'Quality beard trim', hour: 9, minute: 0, durationMin: 15, pricePence: 1500 },
  { id: 'demo-day-29', fullName: 'Imran Patel', email: 'imran.patel@example.com', barberId: M, barberName: 'Marcus Bell', serviceId: DEMO_SERVICE_IDS.shortBackAndSides, serviceName: 'Short back and sides clipper', hour: 9, minute: 30, durationMin: 25, pricePence: 3000 },
  { id: 'demo-day-30', fullName: 'Finn ONeill', email: 'finn.oneill@example.com', barberId: M, barberName: 'Marcus Bell', serviceId: DEMO_SERVICE_IDS.longerHaircut, serviceName: 'Longer haircut', hour: 10, minute: 15, durationMin: 60, pricePence: 6500, tags: ['VIP'] },
  { id: 'demo-day-31', fullName: 'Zach Quinn', email: 'zach.quinn@example.com', barberId: M, barberName: 'Marcus Bell', serviceId: DEMO_SERVICE_IDS.headShave, serviceName: 'Head shave', hour: 11, minute: 30, durationMin: 20, pricePence: 2500 },
  { id: 'demo-day-32', fullName: 'George Blake', email: 'george.blake@example.com', barberId: M, barberName: 'Marcus Bell', serviceId: DEMO_SERVICE_IDS.luxuryWetShave, serviceName: 'Luxury wet shave', hour: 12, minute: 15, durationMin: 40, pricePence: 4000 },
  { id: 'demo-day-33', fullName: 'Elliot Shaw', email: 'elliot.shaw@example.com', barberId: M, barberName: 'Marcus Bell', serviceId: DEMO_SERVICE_IDS.longerBeardTrim, serviceName: 'Longer beard trim', hour: 13, minute: 15, durationMin: 35, pricePence: 4000 },
  { id: 'demo-day-34', fullName: 'Arthur Lane', email: 'arthur.lane@example.com', barberId: M, barberName: 'Marcus Bell', serviceId: DEMO_SERVICE_IDS.clippersOnly, serviceName: 'Clippers only', hour: 15, minute: 30, durationMin: 15, pricePence: 1500 },
  { id: 'demo-day-35', fullName: 'Henry Cole', email: 'henry.cole@example.com', barberId: M, barberName: 'Marcus Bell', serviceId: DEMO_SERVICE_IDS.expressShave, serviceName: 'Express shave', hour: 18, minute: 30, durationMin: 20, pricePence: 2500, tags: ['Regular'] },
];

export function demoDaySelectedDate(now = new Date()): string {
  return formatInTimeZone(now, DEMO_DAY_TZ, 'yyyy-MM-dd');
}

export function demoDayTodayAt(hour: number, minute: number, now = new Date()): string {
  const dateKey = demoDaySelectedDate(now);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return fromZonedTime(`${dateKey}T${hh}:${mm}:00`, DEMO_DAY_TZ).toISOString();
}

function seedToBooking(seed: DemoDaySeed, now = new Date()): DemoDayBooking {
  const startAt = demoDayTodayAt(seed.hour, seed.minute, now);
  const end = new Date(startAt);
  end.setMinutes(end.getMinutes() + seed.durationMin);
  return {
    id: seed.id,
    serviceId: seed.serviceId,
    barberId: seed.barberId,
    fullName: seed.fullName,
    email: seed.email,
    phone: null,
    clientId: null,
    startAt,
    endAt: end.toISOString(),
    status: 'BOOKED',
    notes: null,
    rescheduledAt: null,
    paymentRequired: false,
    depositAmountPence: null,
    paymentStatus: 'NOT_REQUIRED',
    totalPricePence: seed.pricePence,
    serviceNameAtBooking: seed.serviceName,
    servicePricePenceAtBooking: seed.pricePence,
    barber: { name: seed.barberName },
    service: { id: seed.serviceId, name: seed.serviceName },
    clientTags: seed.tags ?? [],
  };
}

/** @internal static 35-slot map with no day-cycle variance (tests / baselines). */
export function getLegacyStaticDemoDayBookings(now = new Date()): DemoDayBooking[] {
  if (DEMO_DAY_SEEDS.length !== 35) {
    throw new Error(`Demo day schedule must have exactly 35 seeds (got ${DEMO_DAY_SEEDS.length})`);
  }
  return DEMO_DAY_SEEDS.map((seed) => seedToBooking(seed, now));
}
