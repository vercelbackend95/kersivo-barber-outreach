import { BookingStatus, PrismaClient } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { hasAnyOverlap } from '../src/lib/booking/overlap';
import { addMinutes, toUtcFromLondon } from '../src/lib/booking/time';

const prisma = new PrismaClient();

const LONDON_TZ = 'Europe/London';
const BOOKING_ID_PREFIX = 'timeline-mock-bk-';

function resolveBookingsDate(): string {
  const raw = (process.env.BOOKINGS_DATE ?? '').trim();
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return formatInTimeZone(new Date(), LONDON_TZ, 'yyyy-MM-dd');
}

function resolveBookingTime(): string {
  const raw = (process.env.BOOKING_TIME ?? '11:30').trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throw new Error(`Invalid BOOKING_TIME: ${raw}. Expected HH:mm format.`);
  }
  return raw;
}

function resolveBookingService(): string {
  return (process.env.BOOKING_SERVICE ?? 'Skin Fade').trim();
}

function resolveBarberNames(): string[] {
  const raw = (process.env.BOOKING_BARBERS ?? 'Mason,Theo,Leo').trim();
  const names = raw.split(',').map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) {
    throw new Error('BOOKING_BARBERS must list at least one barber name.');
  }
  return names;
}

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function formatLondonTime(date: Date): string {
  return formatInTimeZone(date, LONDON_TZ, 'HH:mm');
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

async function main() {
  const date = resolveBookingsDate();
  const time = resolveBookingTime();
  const serviceNameQuery = resolveBookingService();
  const barberNames = resolveBarberNames();

  console.info(`[timeline-booking] Target date (Europe/London): ${date}`);
  console.info(`[timeline-booking] Time: ${time}, service: ${serviceNameQuery}`);
  console.info(`[timeline-booking] Barber priority: ${barberNames.join(' → ')}`);

  const service = await prisma.service.findFirst({
    where: {
      isActive: true,
      name: { contains: serviceNameQuery, mode: 'insensitive' }
    }
  });
  if (!service) {
    throw new Error(`No active service matching "${serviceNameQuery}" found.`);
  }

  const settings = await prisma.shopSettings.findFirstOrThrow();
  const startMinutes = parseTimeToMinutes(time);
  const startAt = toUtcFromLondon(date, startMinutes);
  const endAt = addMinutes(
    startAt,
    service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes)
  );

  const dayStartUtc = toUtcFromLondon(date, 0);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);

  const barbers = await prisma.barber.findMany({
    where: { active: true, name: { in: barberNames } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      barberServices: {
        where: { serviceId: service.id },
        select: { serviceId: true }
      }
    }
  });

  const barberByName = new Map(barbers.map((barber) => [barber.name, barber]));
  const orderedBarbers = barberNames
    .map((name) => barberByName.get(name))
    .filter((barber): barber is NonNullable<typeof barber> => barber != null);

  if (orderedBarbers.length === 0) {
    throw new Error(`No active barbers found for: ${barberNames.join(', ')}`);
  }

  const existingBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.BOOKED,
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc },
      barberId: { in: orderedBarbers.map((barber) => barber.id) }
    },
    select: { barberId: true, startAt: true, endAt: true }
  });

  const bookingsByBarber = new Map<string, { startAt: Date; endAt: Date }[]>();
  for (const booking of existingBookings) {
    const list = bookingsByBarber.get(booking.barberId) ?? [];
    list.push({ startAt: booking.startAt, endAt: booking.endAt });
    bookingsByBarber.set(booking.barberId, list);
  }

  const slot = { startAt, endAt };
  let selectedBarber: (typeof orderedBarbers)[number] | null = null;

  for (const barber of orderedBarbers) {
    if (barber.barberServices.length === 0) continue;

    const intervals = bookingsByBarber.get(barber.id) ?? [];
    if (hasAnyOverlap(slot, intervals)) continue;

    selectedBarber = barber;
    break;
  }

  if (!selectedBarber) {
    throw new Error(
      `No available barber for ${service.name} at ${time} on ${date}. All candidates are busy or do not offer this service.`
    );
  }

  const bookingId = await resolveNextBookingId();

  await prisma.booking.create({
    data: {
      id: bookingId,
      barberId: selectedBarber.id,
      serviceId: service.id,
      fullName: 'Jordan Pike',
      email: 'timeline.mock.extra@example.com',
      phone: '07700 901116',
      startAt,
      endAt,
      status: BookingStatus.BOOKED,
      manageTokenHash: 'timeline-mock-manage-extra',
      serviceNameAtBooking: service.name,
      servicePricePenceAtBooking: service.pricePence,
      serviceDurationMinutesAtBooking: service.durationMinutes,
      totalPricePence: service.pricePence
    }
  });

  console.info(`[timeline-booking] Inserted ${bookingId} for ${date}.`);
  console.info(
    `[timeline-booking] ${time}–${formatLondonTime(endAt)} ${selectedBarber.name} · ${service.name}`
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[timeline-booking] Failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
