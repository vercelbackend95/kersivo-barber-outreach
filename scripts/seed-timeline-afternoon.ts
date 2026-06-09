import { BookingStatus, PrismaClient, type Service } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { generateSlots } from '../src/lib/booking/slots';
import { hasAnyOverlap, type Interval } from '../src/lib/booking/overlap';
import {
  addMinutes,
  londonDayOfWeekFromIsoDate,
  minutesInLondonDay,
  roundMinutesUpToInterval,
  toUtcFromLondon
} from '../src/lib/booking/time';

const prisma = new PrismaClient();

const LONDON_TZ = 'Europe/London';
const BOOKING_ID_PREFIX = 'timeline-mock-bk-';

const CLIENT_NAMES = [
  'Connor Walsh',
  'Blake Sutton',
  'Rowan Ellis',
  'Sage Holloway',
  'Finley Marsh',
  'Indigo Price',
  'Marlowe Kent',
  'Remy Foster',
  'Arden Cole',
  'Lennox Shaw'
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

function resolveStartTime(): string {
  const raw = (process.env.BOOKING_START_TIME ?? '16:45').trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throw new Error(`Invalid BOOKING_START_TIME: ${raw}. Expected HH:mm format.`);
  }
  return raw;
}

function resolveBookingCount(): number {
  const raw = Number.parseInt(process.env.BOOKING_COUNT ?? '10', 10);
  if (!Number.isFinite(raw) || raw < 1) {
    throw new Error('BOOKING_COUNT must be a positive integer.');
  }
  return raw;
}

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function formatMinutesAsTime(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatLondonTime(date: Date): string {
  return formatInTimeZone(date, LONDON_TZ, 'HH:mm');
}

function serviceTotalDuration(service: Service, defaultBufferMinutes: number): number {
  return service.durationMinutes + (service.bufferMinutes || defaultBufferMinutes);
}

async function resolveNextBookingId(): Promise<string> {
  const existing = await prisma.booking.findMany({
    where: { id: { startsWith: BOOKING_ID_PREFIX } },
    select: { id: true }
  });

  let maxIndex = 0;
  for (const row of existing) {
    const suffix = row.id.slice(BOOKING_ID_PREFIX.length);
    const index = Number.parseInt(suffix, 10);
    if (Number.isFinite(index) && index > maxIndex) {
      maxIndex = index;
    }
  }

  return `${BOOKING_ID_PREFIX}${String(maxIndex + 1).padStart(2, '0')}`;
}

async function loadSlotCandidates(
  date: string,
  minStartMinutes: number
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
        select: { service: true }
      }
    }
  });

  const barbersWithServices = barbers.filter((barber) =>
    barber.barberServices.some((link) => link.service.isActive)
  );

  if (barbersWithServices.length === 0) {
    throw new Error('No active barbers with active services found.');
  }

  const existingBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.BOOKED,
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc }
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

  for (const barber of barbersWithServices) {
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
        const slotMinutes = hour * 60 + minute;
        if (slotMinutes < minStartMinutes) continue;

        const startAt = toUtcFromLondon(date, slotMinutes);
        const endAt = addMinutes(startAt, totalDuration);

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

  candidates.sort((a, b) => {
    const byTime = a.startAt.getTime() - b.startAt.getTime();
    if (byTime !== 0) return byTime;
    return a.barberName.localeCompare(b.barberName);
  });

  return { candidates, barbers: barbersWithServices.map(({ id, name }) => ({ id, name })) };
}

function pickBookings(
  candidates: SlotCandidate[],
  barbers: { id: string; name: string }[],
  targetCount: number
): SlotCandidate[] {
  const selected: SlotCandidate[] = [];
  const barberIntervals = new Map<string, Interval[]>();

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
        if (
          selected.some(
            (entry) =>
              entry.barberId === candidate.barberId && entry.startAt.getTime() === candidate.startAt.getTime()
          )
        ) {
          continue;
        }

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

      const alreadySelected = selected.some(
        (entry) => entry.barberId === candidate.barberId && entry.startAt.getTime() === candidate.startAt.getTime()
      );
      if (alreadySelected) continue;

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
  const startTime = resolveStartTime();
  const count = resolveBookingCount();

  const settings = await prisma.shopSettings.findFirstOrThrow();
  const requestedStartMinutes = parseTimeToMinutes(startTime);
  const minStartMinutes = roundMinutesUpToInterval(requestedStartMinutes, settings.slotIntervalMinutes);
  const effectiveStartTime = formatMinutesAsTime(minStartMinutes);

  console.info(`[timeline-afternoon] Target date (Europe/London): ${date}`);
  console.info(`[timeline-afternoon] Start time: ${effectiveStartTime}, count: ${count}`);
  if (minStartMinutes !== requestedStartMinutes) {
    console.info(
      `[timeline-afternoon] Snapped ${startTime} → ${effectiveStartTime} to match ${settings.slotIntervalMinutes}-minute slot grid.`
    );
  }

  const deleted = await prisma.booking.deleteMany({
    where: { manageTokenHash: { startsWith: 'timeline-mock-manage-afternoon-' } }
  });
  if (deleted.count > 0) {
    console.info(`[timeline-afternoon] Removed ${deleted.count} previous afternoon mock booking(s).`);
  }

  const { candidates, barbers } = await loadSlotCandidates(date, minStartMinutes);
  console.info(`[timeline-afternoon] Active barbers: ${barbers.map((b) => b.name).join(', ')}`);

  if (candidates.length === 0) {
    throw new Error(
      `No bookable slots found from ${effectiveStartTime} on ${date}. Check barber availability and existing bookings.`
    );
  }

  const picked = pickBookings(candidates, barbers, count);
  if (picked.length < count) {
    console.warn(
      `[timeline-afternoon] Only ${picked.length}/${count} non-overlapping slots available; inserting what fits.`
    );
  }

  if (picked.length === 0) {
    throw new Error('No bookings could be placed — all slots conflict with existing bookings.');
  }

  const clientBaseIndex = 21;

  for (let i = 0; i < picked.length; i += 1) {
    const row = picked[i];
    const clientIndex = clientBaseIndex + i;
    const bookingId = await resolveNextBookingId();

    await prisma.booking.create({
      data: {
        id: bookingId,
        barberId: row.barberId,
        serviceId: row.service.id,
        fullName: CLIENT_NAMES[i] ?? `Afternoon Client ${clientIndex}`,
        email: `timeline.mock.afternoon${String(clientIndex).padStart(2, '0')}@example.com`,
        phone: `07700 91${String(2000 + clientIndex).slice(-4)}`,
        startAt: row.startAt,
        endAt: row.endAt,
        status: BookingStatus.BOOKED,
        manageTokenHash: `timeline-mock-manage-afternoon-${String(clientIndex).padStart(2, '0')}`,
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

  console.info(`[timeline-afternoon] Inserted ${picked.length} booking(s) for ${date}.`);
  console.info('[timeline-afternoon] Distribution per barber:', perBarber);
  console.info('[timeline-afternoon] Schedule:');
  for (const row of picked) {
    console.info(
      `  ${formatLondonTime(row.startAt)}–${formatLondonTime(row.endAt)} · ${row.barberName} · ${row.service.name}`
    );
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[timeline-afternoon] Failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
