import { BookingStatus, PrismaClient, type Service } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { generateSlots } from '../src/lib/booking/slots';
import { hasAnyOverlap, type Interval } from '../src/lib/booking/overlap';
import {
  addMinutes,
  londonDayOfWeekFromIsoDate,
  minutesInLondonDay,
  toUtcFromLondon
} from '../src/lib/booking/time';

const prisma = new PrismaClient();

const LONDON_TZ = 'Europe/London';
const BOOKING_ID_PREFIX = 'today-batch-bk-';
const DEFAULT_BOOKING_COUNT = 32;
const DEFAULT_WINDOW_START = '10:00';
const DEFAULT_WINDOW_END = '19:00';

function resolveBookingCount(): number {
  const raw = Number.parseInt(process.env.BOOKING_COUNT ?? String(DEFAULT_BOOKING_COUNT), 10);
  if (!Number.isFinite(raw) || raw < 1) {
    throw new Error('BOOKING_COUNT must be a positive integer.');
  }
  return raw;
}

const CLIENT_NAMES = [
  'Alex Morgan',
  'Jordan Blake',
  'Casey Riley',
  'Morgan Hayes',
  'Riley Brooks',
  'Jamie Fox',
  'Taylor Reid',
  'Sam Clarke',
  'Drew Palmer',
  'Ellis Gray',
  'Quinn Shaw',
  'Avery Lane',
  'Cameron Holt',
  'Reese Ward',
  'Skyler Dean',
  'Parker Mills',
  'Logan Price',
  'Hayden Cole',
  'Blake Fisher',
  'Rowan Kent',
  'Devon Nash',
  'Avery Stone',
  'Jordan Pike',
  'Connor Walsh',
  'Blake Sutton',
  'Rowan Ellis',
  'Sage Holloway',
  'Finley Marsh',
  'Indigo Price',
  'Marlowe Kent',
  'Remy Foster',
  'Arden Cole',
  'Blair Quinn'
];

type SlotCandidate = {
  barberId: string;
  barberName: string;
  service: Service;
  startAt: Date;
  endAt: Date;
  time: string;
};

function resolveBookingsDate(): string {
  const raw = (process.env.BOOKINGS_DATE ?? '').trim();
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return formatInTimeZone(new Date(), LONDON_TZ, 'yyyy-MM-dd');
}

function parseTimeToMinutes(time: string, label: string): number {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid ${label}: ${time}. Expected HH:mm format.`);
  }
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function resolveWindowStartMinutes(): number {
  const raw = (process.env.BOOKING_WINDOW_START ?? DEFAULT_WINDOW_START).trim();
  return parseTimeToMinutes(raw, 'BOOKING_WINDOW_START');
}

function resolveWindowEndMinutes(): number {
  const raw = (process.env.BOOKING_WINDOW_END ?? DEFAULT_WINDOW_END).trim();
  return parseTimeToMinutes(raw, 'BOOKING_WINDOW_END');
}

function bookingId(index: number): string {
  return `${BOOKING_ID_PREFIX}${String(index).padStart(2, '0')}`;
}

function clientEmail(index: number): string {
  return `today.batch.client${String(index).padStart(2, '0')}@example.com`;
}

function manageTokenHash(index: number): string {
  return `today-batch-manage-${String(index).padStart(2, '0')}`;
}

function ukPhone(index: number): string {
  return `07700 90${String(1000 + index).slice(-4)}`;
}

function serviceTotalDuration(service: Service, defaultBufferMinutes: number): number {
  return service.durationMinutes + (service.bufferMinutes || defaultBufferMinutes);
}

async function loadSlotCandidates(
  date: string,
  windowStartMinutes: number,
  windowEndMinutes: number
): Promise<{
  candidates: SlotCandidate[];
  barbers: { id: string; name: string }[];
}> {
  const settings = await prisma.shopSettings.findFirstOrThrow();
  const dayOfWeek = londonDayOfWeekFromIsoDate(date);
  if (dayOfWeek == null) {
    throw new Error(`Invalid booking date: ${date}`);
  }

  const dayStartUtc = toUtcFromLondon(date, 0);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);

  const barbers = await prisma.barber.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      barberServices: {
        select: {
          service: true
        }
      }
    }
  });

  if (barbers.length === 0) {
    throw new Error('No active barbers found. Add at least one active barber before seeding bookings.');
  }

  const hasActiveService = barbers.some((barber) =>
    barber.barberServices.some((link) => link.service.isActive)
  );
  if (!hasActiveService) {
    throw new Error('No active services linked to barbers. Configure services before seeding bookings.');
  }

  const timeBlockDelegate = (prisma as { timeBlock?: { findMany: typeof prisma.booking.findMany } }).timeBlock;
  const candidates: SlotCandidate[] = [];

  for (const barber of barbers) {
    const [rules, timeOff, timeBlocks] = await Promise.all([
      prisma.availabilityRule.findMany({
        where: { barberId: barber.id, active: true, dayOfWeek }
      }),
      prisma.barberTimeOff.findMany({
        where: {
          barberId: barber.id,
          startsAt: { lt: dayEndUtc },
          endsAt: { gt: dayStartUtc }
        },
        select: { startsAt: true, endsAt: true }
      }),
      timeBlockDelegate
        ? timeBlockDelegate.findMany({
            where: {
              shopId: settings.id,
              OR: [{ barberId: barber.id }, { barberId: null }],
              startAt: { lt: dayEndUtc },
              endAt: { gt: dayStartUtc }
            },
            select: { startAt: true, endAt: true }
          })
        : Promise.resolve([])
    ]);

    for (const link of barber.barberServices) {
      const service = link.service;
      if (!service.isActive) continue;

      const slots = generateSlots({
        date,
        service,
        rules,
        confirmedBookings: [],
        timeOff,
        timeBlocks,
        settings,
        now: toUtcFromLondon(date, 0)
      });

      const totalDuration = serviceTotalDuration(service, settings.defaultBufferMinutes);

      for (const time of slots) {
        const [hour, minute] = time.split(':').map(Number);
        const slotMinutes = hour * 60 + minute;
        if (slotMinutes < windowStartMinutes) continue;

        const startAt = toUtcFromLondon(date, slotMinutes);
        const endAt = addMinutes(startAt, totalDuration);
        const endMinutes = minutesInLondonDay(endAt);
        if (endMinutes > windowEndMinutes) continue;

        candidates.push({
          barberId: barber.id,
          barberName: barber.name,
          service,
          startAt,
          endAt,
          time
        });
      }
    }
  }

  const deduped = new Map<string, SlotCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.barberId}:${candidate.startAt.getTime()}`;
    const existing = deduped.get(key);
    if (!existing || candidate.service.durationMinutes < existing.service.durationMinutes) {
      deduped.set(key, candidate);
    }
  }

  const uniqueCandidates = [...deduped.values()];
  uniqueCandidates.sort((a, b) => {
    const byTime = a.startAt.getTime() - b.startAt.getTime();
    if (byTime !== 0) return byTime;
    return a.barberName.localeCompare(b.barberName);
  });

  return { candidates: uniqueCandidates, barbers: barbers.map(({ id, name }) => ({ id, name })) };
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function resolveShuffleSeed(): number | null {
  const raw = (process.env.SEED ?? '').trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error('SEED must be a finite integer when set.');
  }
  return parsed;
}

function shuffleInPlace<T>(items: T[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function pickBookings(candidates: SlotCandidate[], targetCount: number): SlotCandidate[] {
  const random = createRng(resolveShuffleSeed() ?? Date.now());
  const shuffled = [...candidates];
  shuffleInPlace(shuffled, random);

  const selected: SlotCandidate[] = [];
  const barberIntervals = new Map<string, Interval[]>();

  for (const candidate of shuffled) {
    if (selected.length >= targetCount) break;

    const intervals = barberIntervals.get(candidate.barberId) ?? [];
    if (hasAnyOverlap(candidate, intervals)) continue;

    selected.push(candidate);
    intervals.push({ startAt: candidate.startAt, endAt: candidate.endAt });
    barberIntervals.set(candidate.barberId, intervals);
  }

  selected.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return selected.slice(0, targetCount);
}

async function main() {
  const date = resolveBookingsDate();
  const windowStartMinutes = resolveWindowStartMinutes();
  const windowEndMinutes = resolveWindowEndMinutes();

  if (windowStartMinutes >= windowEndMinutes) {
    throw new Error('BOOKING_WINDOW_START must be before BOOKING_WINDOW_END.');
  }

  const dayStartUtc = toUtcFromLondon(date, 0);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);

  console.info(`[bookings-today-32] Target date (Europe/London): ${date}`);
  console.info(
    `[bookings-today-32] Window: ${process.env.BOOKING_WINDOW_START ?? DEFAULT_WINDOW_START}–${process.env.BOOKING_WINDOW_END ?? DEFAULT_WINDOW_END}`
  );

  const deleted = await prisma.booking.deleteMany({
    where: {
      startAt: { gte: dayStartUtc, lt: dayEndUtc }
    }
  });
  console.info(`[bookings-today-32] Removed ${deleted.count} existing booking(s) for ${date}.`);

  const { candidates, barbers } = await loadSlotCandidates(date, windowStartMinutes, windowEndMinutes);
  if (candidates.length === 0) {
    throw new Error(
      `No bookable slots found for ${date} in the configured window. Check barber availability rules and time off.`
    );
  }

  console.info(`[bookings-today-32] Active barbers: ${barbers.map((b) => b.name).join(', ')}`);

  const targetCount = resolveBookingCount();
  const picked = pickBookings(candidates, targetCount);
  if (picked.length < targetCount) {
    console.warn(
      `[bookings-today-32] Only ${picked.length}/${targetCount} non-overlapping slots available; inserting what fits.`
    );
  }

  for (let index = 0; index < picked.length; index += 1) {
    const row = picked[index];
    const bookingIndex = index + 1;

    await prisma.booking.create({
      data: {
        id: bookingId(bookingIndex),
        barberId: row.barberId,
        serviceId: row.service.id,
        fullName: CLIENT_NAMES[index] ?? `Today Client ${bookingIndex}`,
        email: clientEmail(bookingIndex),
        phone: ukPhone(bookingIndex),
        startAt: row.startAt,
        endAt: row.endAt,
        status: BookingStatus.BOOKED,
        manageTokenHash: manageTokenHash(bookingIndex),
        serviceNameAtBooking: row.service.name,
        servicePricePenceAtBooking: row.service.pricePence,
        serviceDurationMinutesAtBooking: row.service.durationMinutes,
        totalPricePence: row.service.pricePence
      }
    });
  }

  const perBarber = picked.reduce<Record<string, number>>((acc, row) => {
    acc[row.barberName] = (acc[row.barberName] ?? 0) + 1;
    return acc;
  }, {});

  console.info(`[bookings-today-32] Inserted ${picked.length} booking(s) for ${date}.`);
  console.info('[bookings-today-32] Distribution per barber:', perBarber);
  console.info('[bookings-today-32] Schedule:');
  for (const row of picked) {
    console.info(`  ${row.time} · ${row.barberName} · ${row.service.name}`);
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[bookings-today-32] Failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
