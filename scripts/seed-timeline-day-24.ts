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
const REMAINING_AFTER_CONNOR = TARGET_BOOKING_COUNT - 1;
const TARGET_BARBERS = ['Mason', 'Theo', 'Leo'] as const;
const WINDOW_START_MINUTES = 11 * 60;
const WINDOW_END_MINUTES = 18 * 60;
const CONNOR_PINNED_TIME = '13:45';
const CONNOR_BARBER_PREFERENCE = ['Leo', 'Mason', 'Theo'] as const;

const CONNOR_FULL_NAME = 'Connor Walsh';
const CONNOR_EMAIL = 'connor.walsh@gmail.com';
const CONNOR_PHONE = '07841 293756';
const CONNOR_TAGS = ['VIP', 'Regular', 'Haircut + Beard', 'Prefers Leo', 'Beard care'];
const CONNOR_NOTES = [
  'Prefers Leo for haircut + beard combos — books him whenever possible.',
  'Usually books Friday afternoons around 14:00–17:00.',
  'Loyal regular since early 2024; always on time, never missed an appointment.',
  'Sensitive skin under the beard — go easy with straight razor on the neck line.',
].join('\n');

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
    where: { active: true, name: { in: [...TARGET_BARBERS] } },
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

  const foundNames = new Set(barbers.map((b) => b.name));
  const missing = TARGET_BARBERS.filter((name) => !foundNames.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Missing active barber(s): ${missing.join(', ')}. Expected Mason, Theo and Leo to be active in the database.`
    );
  }

  const hasActiveService = barbers.some((barber) =>
    barber.barberServices.some((link) => link.service.isActive)
  );
  if (!hasActiveService) {
    throw new Error('No active services linked to barbers. Configure services before seeding timeline bookings.');
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
        settings
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

async function buildConnorPinnedSlot(date: string): Promise<SlotCandidate> {
  const settings = await prisma.shopSettings.findFirstOrThrow();
  const dayStartUtc = toUtcFromLondon(date, 0);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);
  const [hour, minute] = CONNOR_PINNED_TIME.split(':').map(Number);
  const startMinutes = hour * 60 + minute;
  const startAt = toUtcFromLondon(date, startMinutes);

  const service =
    (await prisma.service.findFirst({
      where: { isActive: true, name: { equals: 'Haircut + Beard', mode: 'insensitive' } },
    })) ??
    (await prisma.service.findFirst({
      where: { isActive: true, name: { contains: 'Haircut', mode: 'insensitive' } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }));

  if (!service) {
    throw new Error('No active service found for Connor Walsh pinned booking.');
  }

  const endAt = addMinutes(
    startAt,
    serviceTotalDuration(service, settings.defaultBufferMinutes)
  );

  const barbers = await prisma.barber.findMany({
    where: { active: true, name: { in: [...CONNOR_BARBER_PREFERENCE] } },
    select: {
      id: true,
      name: true,
      barberServices: {
        where: { serviceId: service.id },
        select: { serviceId: true },
      },
    },
  });

  const barberByName = new Map(barbers.map((barber) => [barber.name, barber]));
  const orderedBarbers = CONNOR_BARBER_PREFERENCE.map((name) => barberByName.get(name)).filter(
    (barber): barber is NonNullable<typeof barber> => barber != null
  );

  if (orderedBarbers.length === 0) {
    throw new Error('No active barbers found for Connor Walsh pinned booking.');
  }

  const existingBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.BOOKED,
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc },
      barberId: { in: orderedBarbers.map((barber) => barber.id) },
      NOT: { id: { startsWith: BOOKING_ID_PREFIX } },
    },
    select: { barberId: true, startAt: true, endAt: true },
  });

  const bookingsByBarber = new Map<string, Interval[]>();
  for (const booking of existingBookings) {
    const list = bookingsByBarber.get(booking.barberId) ?? [];
    list.push({ startAt: booking.startAt, endAt: booking.endAt });
    bookingsByBarber.set(booking.barberId, list);
  }

  const slot = { startAt, endAt };
  for (const barber of orderedBarbers) {
    if (barber.barberServices.length === 0) continue;
    const intervals = bookingsByBarber.get(barber.id) ?? [];
    if (hasAnyOverlap(slot, intervals)) continue;

    return {
      barberId: barber.id,
      barberName: barber.name,
      service,
      startAt,
      endAt,
      time: CONNOR_PINNED_TIME,
    };
  }

  throw new Error(
    `No available barber for Connor Walsh at ${CONNOR_PINNED_TIME} on ${date}. All preferred barbers are busy.`
  );
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

async function resolveConnorClient(shopId: string) {
  return prisma.client.upsert({
    where: { shopId_email: { shopId, email: CONNOR_EMAIL } },
    update: {
      fullName: CONNOR_FULL_NAME,
      phone: CONNOR_PHONE,
      tags: CONNOR_TAGS,
      notes: CONNOR_NOTES,
    },
    create: {
      shopId,
      email: CONNOR_EMAIL,
      fullName: CONNOR_FULL_NAME,
      phone: CONNOR_PHONE,
      tags: CONNOR_TAGS,
      notes: CONNOR_NOTES,
    },
  });
}

async function main() {
  const date = resolveBookingsDate();
  console.info(`[timeline-day-24] Target date (Europe/London): ${date}`);
  console.info(`[timeline-day-24] Window: 11:00–18:00, count: ${TARGET_BOOKING_COUNT}`);
  console.info(`[timeline-day-24] Barbers: ${TARGET_BARBERS.join(', ')}`);

  const deleted = await prisma.booking.deleteMany({
    where: { id: { startsWith: BOOKING_ID_PREFIX } }
  });
  if (deleted.count > 0) {
    console.info(`[timeline-day-24] Removed ${deleted.count} previous timeline mock booking(s).`);
  }

  const settings = await prisma.shopSettings.findFirstOrThrow();
  const connorClient = await resolveConnorClient(settings.id);

  const { candidates, barbers } = await loadSlotCandidates(date);
  if (candidates.length === 0) {
    throw new Error(
      `No bookable slots found between 11:00 and 18:00 on ${date}. Check barber availability rules and time off.`
    );
  }

  const connorSlot = await buildConnorPinnedSlot(date);
  const remainingCandidates = candidates.filter(
    (candidate) => candidate.time !== CONNOR_PINNED_TIME
  );

  const connorIntervals = new Map<string, Interval[]>([
    [connorSlot.barberId, [{ startAt: connorSlot.startAt, endAt: connorSlot.endAt }]],
  ]);

  const pickedRest = pickBookings(remainingCandidates, barbers, REMAINING_AFTER_CONNOR, connorIntervals);
  const picked = [connorSlot, ...pickedRest].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  if (picked.length < TARGET_BOOKING_COUNT) {
    console.warn(
      `[timeline-day-24] Only ${picked.length}/${TARGET_BOOKING_COUNT} non-overlapping slots available; inserting what fits.`
    );
  }

  let mockClientIndex = 0;

  for (let index = 0; index < picked.length; index += 1) {
    const row = picked[index];
    const bookingIndex = index + 1;
    const isConnor = isSameSlot(row, connorSlot);

    await prisma.booking.create({
      data: {
        id: timelineBookingId(bookingIndex),
        barberId: row.barberId,
        serviceId: row.service.id,
        clientId: isConnor ? connorClient.id : undefined,
        fullName: isConnor ? CONNOR_FULL_NAME : (CLIENT_NAMES[mockClientIndex] ?? `Timeline Client ${bookingIndex}`),
        email: isConnor ? CONNOR_EMAIL : clientEmail(mockClientIndex + 1),
        phone: isConnor ? CONNOR_PHONE : ukPhone(mockClientIndex + 1),
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

    if (!isConnor) {
      mockClientIndex += 1;
    }
  }

  const perBarber = picked.reduce<Record<string, number>>((acc, row) => {
    acc[row.barberName] = (acc[row.barberName] ?? 0) + 1;
    return acc;
  }, {});

  console.info(`[timeline-day-24] Inserted ${picked.length} booking(s) for ${date}.`);
  console.info('[timeline-day-24] Distribution per barber:', perBarber);
  console.info(
    `[timeline-day-24] Connor Walsh pinned: ${CONNOR_PINNED_TIME} · ${connorSlot.barberName} · ${connorSlot.service.name} (clientId: ${connorClient.id})`
  );
  console.info('[timeline-day-24] Schedule:');
  for (const row of picked) {
    const clientLabel = isSameSlot(row, connorSlot) ? CONNOR_FULL_NAME : 'mock client';
    console.info(
      `  ${formatLondonTime(row.startAt)}–${formatLondonTime(row.endAt)} · ${row.barberName} · ${row.service.name} · ${clientLabel}`
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
