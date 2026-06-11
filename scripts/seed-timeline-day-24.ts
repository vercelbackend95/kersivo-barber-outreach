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
const BOOKING_ID_PREFIX = 'timeline-mock-bk-';
const TARGET_BOOKING_COUNT = 24;
const WINDOW_START_MINUTES = 10 * 60;
const WINDOW_END_MINUTES = 18 * 60;

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
  'Blake Sutton',
  'Rowan Ellis',
  'Sage Holloway',
  'Finley Marsh',
  'Indigo Price',
  'Marlowe Kent',
  'Remy Foster',
  'Arden Cole',
  'Blair Quinn',
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

function timelineBookingId(index: number): string {
  return `${BOOKING_ID_PREFIX}${String(index).padStart(2, '0')}`;
}

function clientEmail(index: number): string {
  return `timeline.mock.client${String(index).padStart(2, '0')}@example.com`;
}

function manageTokenHash(index: number): string {
  return `timeline-mock-manage-${String(index).padStart(2, '0')}`;
}

function ukPhone(index: number): string {
  return `07700 90${String(1000 + index).slice(-4)}`;
}

function formatLondonTime(date: Date): string {
  return formatInTimeZone(date, LONDON_TZ, 'HH:mm');
}

function serviceTotalDuration(service: Service, defaultBufferMinutes: number): number {
  return service.durationMinutes + (service.bufferMinutes || defaultBufferMinutes);
}

function isWithinTimeWindow(candidate: SlotCandidate): boolean {
  const minute = minutesInLondonDay(candidate.startAt);
  return minute >= WINDOW_START_MINUTES && minute <= WINDOW_END_MINUTES;
}

function isSameSlot(a: SlotCandidate, b: SlotCandidate): boolean {
  return a.barberId === b.barberId && a.startAt.getTime() === b.startAt.getTime();
}

async function loadSlotCandidates(date: string): Promise<{
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
    where: {
      active: true,
      barberServices: { some: { service: { isActive: true } } }
    },
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
    throw new Error('No active barbers with active services found. Configure barbers before seeding timeline bookings.');
  }

  const existingBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.BOOKED,
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc },
      NOT: { id: { startsWith: BOOKING_ID_PREFIX } }
    },
    select: { barberId: true, startAt: true, endAt: true }
  });

  const bookingsByBarber = new Map<string, Interval[]>();
  for (const booking of existingBookings) {
    const list = bookingsByBarber.get(booking.barberId) ?? [];
    list.push({ startAt: booking.startAt, endAt: booking.endAt });
    bookingsByBarber.set(booking.barberId, list);
  }

  const timeBlockDelegate = (prisma as { timeBlock?: { findMany: typeof prisma.booking.findMany } }).timeBlock;
  const candidates: SlotCandidate[] = [];

  for (const barber of barbers) {
    const confirmedBookings = bookingsByBarber.get(barber.id) ?? [];

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
        confirmedBookings,
        timeOff,
        timeBlocks,
        settings,
        now: toUtcFromLondon(date, 0)
      });

      const totalDuration = serviceTotalDuration(service, settings.defaultBufferMinutes);

      for (const time of slots) {
        const [hour, minute] = time.split(':').map(Number);
        const startAt = toUtcFromLondon(date, hour * 60 + minute);
        const endAt = addMinutes(startAt, totalDuration);

        const candidate: SlotCandidate = {
          barberId: barber.id,
          barberName: barber.name,
          service,
          startAt,
          endAt,
          time
        };

        if (isWithinTimeWindow(candidate)) {
          candidates.push(candidate);
        }
      }
    }
  }

  candidates.sort((a, b) => {
    const byTime = a.startAt.getTime() - b.startAt.getTime();
    if (byTime !== 0) return byTime;
    return a.barberName.localeCompare(b.barberName);
  });

  return { candidates, barbers: barbers.map(({ id, name }) => ({ id, name })) };
}

function pickBookings(
  candidates: SlotCandidate[],
  barbers: { id: string; name: string }[],
  targetCount: number,
  initialIntervals: Map<string, Interval[]> = new Map()
): SlotCandidate[] {
  const selected: SlotCandidate[] = [];
  const barberIntervals = new Map<string, Interval[]>(
    [...initialIntervals.entries()].map(([barberId, intervals]) => [barberId, [...intervals]])
  );

  const uniqueMinutes = [...new Set(candidates.map((c) => minutesInLondonDay(c.startAt)))].sort((a, b) => a - b);

  let barberRound = 0;
  let serviceRound = 0;

  for (const minute of uniqueMinutes) {
    if (selected.length >= targetCount) break;

    for (let attempt = 0; attempt < barbers.length && selected.length < targetCount; attempt += 1) {
      const barber = barbers[(barberRound + attempt) % barbers.length];
      const barberCandidates = candidates.filter(
        (c) => c.barberId === barber.id && minutesInLondonDay(c.startAt) === minute
      );

      for (let serviceAttempt = 0; serviceAttempt < barberCandidates.length; serviceAttempt += 1) {
        const candidate = barberCandidates[(serviceRound + serviceAttempt) % barberCandidates.length];
        const intervals = barberIntervals.get(candidate.barberId) ?? [];

        if (hasAnyOverlap(candidate, intervals)) continue;
        if (selected.some((entry) => isSameSlot(entry, candidate))) continue;

        selected.push(candidate);
        intervals.push({ startAt: candidate.startAt, endAt: candidate.endAt });
        barberIntervals.set(candidate.barberId, intervals);
        barberRound = (barberRound + attempt + 1) % barbers.length;
        serviceRound = (serviceRound + 1) % Math.max(barberCandidates.length, 1);
        break;
      }

      if (
        selected.length > 0 &&
        selected[selected.length - 1].barberId === barber.id &&
        minutesInLondonDay(selected[selected.length - 1].startAt) === minute
      ) {
        break;
      }
    }
  }

  if (selected.length < targetCount) {
    for (const candidate of candidates) {
      if (selected.length >= targetCount) break;

      if (selected.some((entry) => isSameSlot(entry, candidate))) continue;

      const intervals = barberIntervals.get(candidate.barberId) ?? [];
      if (hasAnyOverlap(candidate, intervals)) continue;

      selected.push(candidate);
      intervals.push({ startAt: candidate.startAt, endAt: candidate.endAt });
      barberIntervals.set(candidate.barberId, intervals);
    }
  }

  selected.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return selected.slice(0, targetCount);
}

async function main() {
  const date = resolveBookingsDate();
  console.info(`[timeline-day-24] Target date (Europe/London): ${date}`);
  console.info(`[timeline-day-24] Window: 10:00–18:00, count: ${TARGET_BOOKING_COUNT}`);

  const deleted = await prisma.booking.deleteMany({
    where: { id: { startsWith: BOOKING_ID_PREFIX } }
  });
  if (deleted.count > 0) {
    console.info(`[timeline-day-24] Removed ${deleted.count} previous timeline mock booking(s).`);
  }

  const { candidates, barbers } = await loadSlotCandidates(date);
  console.info(`[timeline-day-24] Active barbers: ${barbers.map((b) => b.name).join(', ')}`);

  if (candidates.length === 0) {
    throw new Error(
      `No bookable slots found between 10:00 and 18:00 on ${date}. Check barber availability rules and time off.`
    );
  }

  const picked = pickBookings(candidates, barbers, TARGET_BOOKING_COUNT);

  if (picked.length < TARGET_BOOKING_COUNT) {
    console.warn(
      `[timeline-day-24] Only ${picked.length}/${TARGET_BOOKING_COUNT} non-overlapping slots available; inserting what fits.`
    );
  }

  for (let index = 0; index < picked.length; index += 1) {
    const row = picked[index];
    const bookingIndex = index + 1;

    await prisma.booking.create({
      data: {
        id: timelineBookingId(bookingIndex),
        barberId: row.barberId,
        serviceId: row.service.id,
        fullName: CLIENT_NAMES[index] ?? `Timeline Client ${bookingIndex}`,
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

  console.info(`[timeline-day-24] Inserted ${picked.length} booking(s) for ${date}.`);
  console.info('[timeline-day-24] Distribution per barber:', perBarber);
  console.info('[timeline-day-24] Schedule:');
  for (const row of picked) {
    console.info(
      `  ${formatLondonTime(row.startAt)}–${formatLondonTime(row.endAt)} · ${row.barberName} · ${row.service.name}`
    );
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[timeline-day-24] Failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
