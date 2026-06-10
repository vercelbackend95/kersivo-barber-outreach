import { BookingStatus, PrismaClient } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { generateSlots } from '../src/lib/booking/slots';
import { addMinutes, londonDayOfWeekFromIsoDate, toUtcFromLondon } from '../src/lib/booking/time';

const prisma = new PrismaClient();

const LONDON_TZ = 'Europe/London';

type BookingRow = {
  id: string;
  fullName: string;
  startAt: Date;
  endAt: Date;
  serviceNameAtBooking: string | null;
  service: { name: string } | null;
};

function resolveBookingsDate(): string {
  const raw = (process.env.BOOKINGS_DATE ?? '').trim();
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return formatInTimeZone(new Date(), LONDON_TZ, 'yyyy-MM-dd');
}

function resolveBarberName(): string {
  const raw = (process.env.BARBER_NAME ?? 'Theo').trim();
  if (!raw) {
    throw new Error('BARBER_NAME must be a non-empty barber name.');
  }
  return raw;
}

function resolveTrimFraction(): number {
  const raw = (process.env.TRIM_FRACTION ?? '1').trim();
  const fraction = Number.parseFloat(raw);
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
    throw new Error('TRIM_FRACTION must be a number in (0, 1], e.g. 0.5 or 1.');
  }
  return fraction;
}

function formatLondonTime(date: Date): string {
  return formatInTimeZone(date, LONDON_TZ, 'HH:mm');
}

function selectBookingsToRemove(bookings: BookingRow[], trimFraction: number): BookingRow[] {
  if (trimFraction >= 1) {
    return bookings;
  }

  if (trimFraction === 0.5) {
    return bookings.filter((_, index) => index % 2 === 1);
  }

  const removeCount = Math.floor(bookings.length * trimFraction);
  return bookings.slice(bookings.length - removeCount);
}

async function logFreeSlotEstimate(barberId: string, date: string) {
  const settings = await prisma.shopSettings.findFirstOrThrow();
  const dayOfWeek = londonDayOfWeekFromIsoDate(date);
  if (dayOfWeek == null) return;

  const dayStartUtc = toUtcFromLondon(date, 0);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);

  const confirmedBookings = await prisma.booking.findMany({
    where: {
      barberId,
      status: BookingStatus.BOOKED,
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc },
    },
    select: { startAt: true, endAt: true },
  });

  const rules = await prisma.availabilityRule.findMany({
    where: { barberId, active: true, dayOfWeek },
  });

  const service =
    (await prisma.service.findFirst({
      where: { isActive: true, name: { equals: 'Skin Fade', mode: 'insensitive' } },
    })) ??
    (await prisma.service.findFirst({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }));

  if (!service) return;

  const slots = generateSlots({
    date,
    service,
    rules,
    confirmedBookings,
    timeOff: [],
    timeBlocks: [],
    settings,
  });

  console.info(`[trim-barber-today] Estimated free slots (${service.name}): ${slots.length}`);
}

async function main() {
  const date = resolveBookingsDate();
  const barberName = resolveBarberName();
  const trimFraction = resolveTrimFraction();

  const barber = await prisma.barber.findFirst({
    where: { name: barberName, active: true },
    select: { id: true, name: true },
  });

  if (!barber) {
    throw new Error(`Active barber "${barberName}" not found.`);
  }

  const dayStartUtc = toUtcFromLondon(date, 0);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);

  const bookings = await prisma.booking.findMany({
    where: {
      barberId: barber.id,
      status: BookingStatus.BOOKED,
      startAt: { gte: dayStartUtc, lt: dayEndUtc },
    },
    orderBy: { startAt: 'asc' },
    select: {
      id: true,
      fullName: true,
      startAt: true,
      endAt: true,
      serviceNameAtBooking: true,
      service: { select: { name: true } },
    },
  });

  const toRemove = selectBookingsToRemove(bookings, trimFraction);
  const remainingCount = bookings.length - toRemove.length;

  console.info(`[trim-barber-today] Target date (Europe/London): ${date}`);
  console.info(`[trim-barber-today] Barber: ${barber.name}`);
  console.info(`[trim-barber-today] TRIM_FRACTION: ${trimFraction}`);
  console.info(
    `[trim-barber-today] Found ${bookings.length} BOOKED booking(s); removing ${toRemove.length}, keeping ${remainingCount}.`
  );

  if (toRemove.length > 0) {
    console.info('[trim-barber-today] Removing:');
    for (const booking of toRemove) {
      const serviceLabel = booking.serviceNameAtBooking ?? booking.service?.name ?? '—';
      console.info(
        `  ${formatLondonTime(booking.startAt)}–${formatLondonTime(booking.endAt)} · ${serviceLabel} · ${booking.fullName} (${booking.id})`
      );
    }
  }

  if (remainingCount > 0) {
    console.info('[trim-barber-today] Keeping:');
    for (const booking of bookings.filter((row) => !toRemove.some((removed) => removed.id === row.id))) {
      const serviceLabel = booking.serviceNameAtBooking ?? booking.service?.name ?? '—';
      console.info(
        `  ${formatLondonTime(booking.startAt)}–${formatLondonTime(booking.endAt)} · ${serviceLabel} · ${booking.fullName} (${booking.id})`
      );
    }
  }

  const deleted =
    toRemove.length > 0
      ? await prisma.booking.deleteMany({
          where: {
            id: { in: toRemove.map((booking) => booking.id) },
          },
        })
      : { count: 0 };

  console.info(`[trim-barber-today] Deleted ${deleted.count} booking(s) for ${barber.name} on ${date}.`);
  await logFreeSlotEstimate(barber.id, date);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[trim-barber-today] Failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
