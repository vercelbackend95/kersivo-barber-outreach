/**
 * Landing "Inside the System" live timeline data.
 *
 * Believable, demo-only bookings anchored to *today* (Europe/London), so the
 * embedded admin timeline always shows a full, current-looking day with a
 * pulsing "now" line. Recomputed from the current date on every call, so the
 * schedule "repeats" every day without any backend.
 *
 * Shapes match the props of `TodayTimeline` (see src/components/admin/TodayTimeline.tsx).
 */
import { formatInTimeZone } from 'date-fns-tz';
import type { TimelineBooking } from '@/components/admin/TodayTimeline';
import {
  LANDING_DEMO_BARBER_AVATARS,
  landingDemoClientAvatarForSeed,
} from '@/lib/landing/landingDemoAssets';

const TZ = 'Europe/London';

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

const BARBERS: LandingBarber[] = [
  { id: 'live-barber-jamie', name: 'Jamie Reed', avatarUrl: LANDING_DEMO_BARBER_AVATARS.jamie },
  { id: 'live-barber-alex', name: 'Alex Morgan', avatarUrl: LANDING_DEMO_BARBER_AVATARS.alex },
  { id: 'live-barber-sam', name: 'Sam Doyle', avatarUrl: LANDING_DEMO_BARBER_AVATARS.sam },
  { id: 'live-barber-marcus', name: 'Marcus Bell', avatarUrl: LANDING_DEMO_BARBER_AVATARS.marcus },
];

function todayAt(hour: number, minute: number): string {
  const dateKey = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${dateKey}T${hh}:${mm}:00`).toISOString();
}

type Seed = {
  id: string;
  name: string;
  barberId: string;
  barberName: string;
  service: string;
  hour: number;
  minute: number;
  duration: number;
  pricePence: number;
  status?: string;
  tags?: string[];
};

const SEEDS: Seed[] = [
  { id: 'live-b01', name: 'Oliver Reed', barberId: 'live-barber-jamie', barberName: 'Jamie Reed', service: 'Skin fade with haircut', hour: 9, minute: 0, duration: 45, pricePence: 4000, status: 'COMPLETED' },
  { id: 'live-b02', name: 'Harry Watson', barberId: 'live-barber-alex', barberName: 'Alex Morgan', service: 'Quality haircut', hour: 9, minute: 15, duration: 30, pricePence: 3500, status: 'COMPLETED', tags: ['Regular'] },
  { id: 'live-b03', name: 'Daniel Price', barberId: 'live-barber-sam', barberName: 'Sam Doyle', service: 'Quality beard trim', hour: 9, minute: 30, duration: 15, pricePence: 1500, status: 'COMPLETED' },
  { id: 'live-b04', name: 'Amelia Clarke', barberId: 'live-barber-jamie', barberName: 'Jamie Reed', service: 'Premium haircut', hour: 10, minute: 0, duration: 45, pricePence: 4500, status: 'COMPLETED' },
  { id: 'live-b05', name: 'Noah Bennett', barberId: 'live-barber-marcus', barberName: 'Marcus Bell', service: 'Skin fade with haircut', hour: 10, minute: 15, duration: 45, pricePence: 4000, status: 'COMPLETED', tags: ['VIP'] },
  { id: 'live-b06', name: 'Isla Morgan', barberId: 'live-barber-alex', barberName: 'Alex Morgan', service: 'Quality beard trim', hour: 10, minute: 30, duration: 15, pricePence: 1500, status: 'COMPLETED' },
  { id: 'live-b07', name: 'Ethan Walsh', barberId: 'live-barber-sam', barberName: 'Sam Doyle', service: 'Skin fade with haircut', hour: 11, minute: 0, duration: 45, pricePence: 4000, status: 'COMPLETED' },
  { id: 'live-b08', name: 'Leo Carter', barberId: 'live-barber-jamie', barberName: 'Jamie Reed', service: 'Skin fade with haircut', hour: 11, minute: 15, duration: 45, pricePence: 4000, status: 'COMPLETED' },
  { id: 'live-b09', name: 'Freya Hughes', barberId: 'live-barber-marcus', barberName: 'Marcus Bell', service: 'Quality haircut', hour: 11, minute: 45, duration: 30, pricePence: 3500, status: 'COMPLETED', tags: ['New'] },
  { id: 'live-b10', name: 'Jack Turner', barberId: 'live-barber-alex', barberName: 'Alex Morgan', service: 'Skin fade with haircut', hour: 12, minute: 0, duration: 45, pricePence: 4000, status: 'COMPLETED' },
  { id: 'live-b11', name: 'Maya Brooks', barberId: 'live-barber-sam', barberName: 'Sam Doyle', service: 'Quality haircut', hour: 12, minute: 30, duration: 30, pricePence: 3500 },
  { id: 'live-b12', name: 'Theo Hughes', barberId: 'live-barber-jamie', barberName: 'Jamie Reed', service: 'Quality beard trim', hour: 13, minute: 0, duration: 15, pricePence: 1500 },
  { id: 'live-b13', name: 'Grace Turner', barberId: 'live-barber-marcus', barberName: 'Marcus Bell', service: 'Skin fade with haircut', hour: 13, minute: 15, duration: 45, pricePence: 4000, tags: ['VIP'] },
  { id: 'live-b14', name: 'Charlie Evans', barberId: 'live-barber-alex', barberName: 'Alex Morgan', service: 'Premium haircut', hour: 13, minute: 45, duration: 45, pricePence: 4500 },
  { id: 'live-b15', name: 'Sophie Lane', barberId: 'live-barber-sam', barberName: 'Sam Doyle', service: 'Premium beard trim', hour: 14, minute: 15, duration: 25, pricePence: 3000 },
  { id: 'live-b16', name: 'James Foster', barberId: 'live-barber-jamie', barberName: 'Jamie Reed', service: 'Skin fade with haircut', hour: 14, minute: 30, duration: 45, pricePence: 4000, tags: ['Regular'] },
  { id: 'live-b17', name: 'Ruby Shaw', barberId: 'live-barber-marcus', barberName: 'Marcus Bell', service: 'Quality haircut', hour: 15, minute: 0, duration: 30, pricePence: 3500 },
  { id: 'live-b18', name: 'Louis Grant', barberId: 'live-barber-alex', barberName: 'Alex Morgan', service: 'Luxury wet shave', hour: 15, minute: 30, duration: 40, pricePence: 4000 },
  { id: 'live-b19', name: 'Nathan Cole', barberId: 'live-barber-sam', barberName: 'Sam Doyle', service: 'Longer haircut', hour: 16, minute: 0, duration: 60, pricePence: 6500 },
  { id: 'live-b20', name: 'Alex Morgan', barberId: 'live-barber-jamie', barberName: 'Jamie Reed', service: 'Quality haircut', hour: 16, minute: 30, duration: 30, pricePence: 3500, tags: ['VIP'] },
  { id: 'live-b21', name: 'Dylan Reid', barberId: 'live-barber-marcus', barberName: 'Marcus Bell', service: 'Quality beard trim', hour: 16, minute: 45, duration: 15, pricePence: 1500 },
  { id: 'live-b22', name: 'Aaron Webb', barberId: 'live-barber-alex', barberName: 'Alex Morgan', service: 'Skin fade with haircut', hour: 17, minute: 15, duration: 45, pricePence: 4000 },
  { id: 'live-b23', name: 'Connor Walsh', barberId: 'live-barber-sam', barberName: 'Sam Doyle', service: 'Friction', hour: 17, minute: 45, duration: 15, pricePence: 1500, status: 'CANCELLED' },
  { id: 'live-b24', name: 'Mason Field', barberId: 'live-barber-jamie', barberName: 'Jamie Reed', service: 'Quality haircut', hour: 18, minute: 15, duration: 30, pricePence: 3500 },
  { id: 'live-b25', name: 'Rory Ellis', barberId: 'live-barber-marcus', barberName: 'Marcus Bell', service: 'Express shave', hour: 18, minute: 45, duration: 20, pricePence: 2500, tags: ['New'] },
];

function toBooking(seed: Seed, barber: LandingBarber): TimelineBooking {
  const startAt = todayAt(seed.hour, seed.minute);
  const end = new Date(startAt);
  end.setMinutes(end.getMinutes() + seed.duration);
  const email = `${seed.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`;
  return {
    id: seed.id,
    fullName: seed.name,
    email,
    phone: null,
    clientId: null,
    clientAvatarUrl: landingDemoClientAvatarForSeed(seed.id),
    clientTags: seed.tags ?? [],
    status: seed.status ?? 'BOOKED',
    startAt,
    endAt: end.toISOString(),
    barberId: barber.id,
    notes: null,
    rescheduledAt: null,
    paymentRequired: false,
    depositAmountPence: null,
    paymentStatus: 'NOT_REQUIRED',
    totalPricePence: seed.pricePence,
    servicePricePenceAtBooking: seed.pricePence,
    barber: { name: barber.name },
    service: { name: seed.service },
  };
}

/**
 * Map the distinct seed barber keys (in first-seen order) onto the provided real
 * barbers, cycling if there are fewer real barbers than seed keys. Falls back to
 * the built-in demo barbers when no real ones are supplied.
 */
function resolveBarberAssignment(realBarbers?: LandingBarber[]): {
  barbers: LandingBarber[];
  bySeedKey: Map<string, LandingBarber>;
} {
  const pool = realBarbers && realBarbers.length > 0 ? realBarbers : BARBERS;
  const seedKeys = Array.from(new Set(SEEDS.map((seed) => seed.barberId)));
  const bySeedKey = new Map<string, LandingBarber>();
  seedKeys.forEach((key, index) => {
    bySeedKey.set(key, pool[index % pool.length]);
  });
  const usedIds = new Set(seedKeys.map((key) => bySeedKey.get(key)!.id));
  return {
    barbers: pool.filter((barber) => usedIds.has(barber.id)),
    bySeedKey,
  };
}

export function getLandingTimelineData(realBarbers?: LandingBarber[]): {
  barbers: LandingBarber[];
  bookings: TimelineBooking[];
  timeBlocks: LandingTimeBlock[];
  selectedDate: string;
} {
  const { barbers, bySeedKey } = resolveBarberAssignment(realBarbers);
  return {
    barbers,
    bookings: SEEDS.map((seed) => toBooking(seed, bySeedKey.get(seed.barberId)!)),
    timeBlocks: [],
    selectedDate: formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'),
  };
}
