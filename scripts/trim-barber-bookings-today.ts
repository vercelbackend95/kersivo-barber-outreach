import { BookingStatus, PrismaClient } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes, toUtcFromLondon } from '../src/lib/booking/time';

const prisma = new PrismaClient();

const LONDON_TZ = 'Europe/London';

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

function formatLondonTime(date: Date): string {
  return formatInTimeZone(date, LONDON_TZ, 'HH:mm');
}

async function main() {
  const date = resolveBookingsDate();
  const barberName = resolveBarberName();

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

  console.info(`[trim-barber-today] Target date (Europe/London): ${date}`);
  console.info(`[trim-barber-today] Barber: ${barber.name}`);
  console.info(`[trim-barber-today] Found ${bookings.length} BOOKED booking(s) to remove.`);

  if (bookings.length > 0) {
    console.info('[trim-barber-today] Removing:');
    for (const booking of bookings) {
      const serviceLabel = booking.serviceNameAtBooking ?? booking.service?.name ?? '—';
      console.info(
        `  ${formatLondonTime(booking.startAt)}–${formatLondonTime(booking.endAt)} · ${serviceLabel} · ${booking.fullName} (${booking.id})`
      );
    }
  }

  const deleted = await prisma.booking.deleteMany({
    where: {
      id: { in: bookings.map((booking) => booking.id) },
    },
  });

  console.info(`[trim-barber-today] Deleted ${deleted.count} booking(s) for ${barber.name} on ${date}.`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[trim-barber-today] Failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
