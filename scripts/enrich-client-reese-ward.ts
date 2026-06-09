import { BookingStatus, PrismaClient, type Service } from '@prisma/client';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  computeClientStats,
  computeReliabilityScore,
} from '../src/pages/api/admin/clients/[clientId]/index';
import { addMinutes, toUtcFromLondon } from '../src/lib/booking/time';

const prisma = new PrismaClient();

const LONDON_TZ = 'Europe/London';
const HISTORY_ID_PREFIX = 'reese-history-bk-';
const TARGET_BOOKING_ID = 'timeline-mock-bk-14';
const CLIENT_FULL_NAME = 'Reese Ward';
const CLIENT_EMAIL = 'reese.ward@gmail.com';
const CLIENT_PHONE = '07792 448103';
const HISTORY_VISIT_COUNT = 20;
const DAYS_BETWEEN_VISITS = 21;

const CLIENT_TAGS = ['VIP', 'Regular', 'Skin fade', 'Prefers Mason', 'Hot towel'];

const CLIENT_NOTES = [
  'Prefers Mason for skin fades — books him whenever possible.',
  'Usually books Tuesday/Thursday afternoons around 14:00–16:30.',
  'Loyal regular since early 2024; always on time, never missed an appointment.',
  'Sensitive skin — check product choice before hot towel treatments.',
].join('\n');

/** Start times on the 15-minute booking grid. */
const VISIT_START_TIMES = ['14:00', '14:15', '16:15', '16:30'] as const;

/** Service names weighted toward Skin Fade as favourite. */
const VISIT_SERVICE_NAMES: string[] = [
  'Skin Fade',
  'Skin Fade',
  'Haircut',
  'Skin Fade',
  'Hot towel shave',
  'Skin Fade',
  'Haircut + Beard',
  'Skin Fade',
  'Beard Trim',
  'Skin Fade',
  'Haircut',
  'Skin Fade',
  'Hot towel shave',
  'Haircut + Beard',
  'Skin Fade',
  'Haircut',
  'Hot towel shave',
  'Beard Trim',
  'Haircut + Beard',
  'Haircut',
];

/** ~70% Mason, rest split between Theo and Leo. */
const VISIT_BARBER_NAMES: string[] = [
  'Mason',
  'Mason',
  'Mason',
  'Theo',
  'Mason',
  'Mason',
  'Leo',
  'Mason',
  'Mason',
  'Mason',
  'Theo',
  'Mason',
  'Mason',
  'Leo',
  'Mason',
  'Mason',
  'Theo',
  'Mason',
  'Mason',
  'Leo',
];

function resolveBookingsDate(): string {
  const raw = (process.env.BOOKINGS_DATE ?? '').trim();
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return formatInTimeZone(new Date(), LONDON_TZ, 'yyyy-MM-dd');
}

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function formatLondonTime(date: Date): string {
  return formatInTimeZone(date, LONDON_TZ, 'HH:mm');
}

function formatLondonDate(date: Date): string {
  return formatInTimeZone(date, LONDON_TZ, 'yyyy-MM-dd');
}

function serviceTotalDuration(service: Service, defaultBufferMinutes: number): number {
  return service.durationMinutes + (service.bufferMinutes || defaultBufferMinutes);
}

function historyBookingId(index: number): string {
  return `${HISTORY_ID_PREFIX}${String(index).padStart(2, '0')}`;
}

function historyManageToken(index: number): string {
  return `reese-history-manage-${String(index).padStart(2, '0')}`;
}

async function findTargetBooking(date: string) {
  const dayStartUtc = toUtcFromLondon(date, 0);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);

  const byName = await prisma.booking.findMany({
    where: {
      fullName: CLIENT_FULL_NAME,
      startAt: { gte: dayStartUtc, lt: dayEndUtc },
    },
    include: { barber: { select: { name: true } }, service: true },
  });

  const at1615 = byName.find((row) => formatLondonTime(row.startAt) === '16:15');
  if (at1615) return at1615;

  const fallback = await prisma.booking.findUnique({
    where: { id: TARGET_BOOKING_ID },
    include: { barber: { select: { name: true } }, service: true },
  });

  if (fallback && fallback.fullName === CLIENT_FULL_NAME) return fallback;

  throw new Error(
    `Could not find Reese Ward booking at 16:15 on ${date}. Run seed:timeline-today first.`,
  );
}

async function loadServiceByName(name: string, services: Service[]): Promise<Service> {
  const exact = services.find((service) => service.name.toLowerCase() === name.toLowerCase());
  if (exact) return exact;

  const partial = services.find((service) =>
    service.name.toLowerCase().includes(name.toLowerCase()),
  );
  if (partial) return partial;

  const skinFade = services.find((service) => service.name.toLowerCase().includes('skin fade'));
  if (skinFade) return skinFade;

  throw new Error(`No active service found matching "${name}".`);
}

async function loadBarberByName(name: string) {
  const barber = await prisma.barber.findFirst({
    where: { name, active: true },
    select: { id: true, name: true },
  });
  if (!barber) {
    throw new Error(`Active barber "${name}" not found.`);
  }
  return barber;
}

async function main() {
  const date = resolveBookingsDate();
  console.info(`[enrich-reese-ward] Target date (Europe/London): ${date}`);

  const settings = await prisma.shopSettings.findFirstOrThrow();
  const targetBooking = await findTargetBooking(date);
  console.info(
    `[enrich-reese-ward] Found booking ${targetBooking.id} at ${formatLondonTime(targetBooking.startAt)} · ${targetBooking.barber.name}`,
  );

  const deletedHistory = await prisma.booking.deleteMany({
    where: { id: { startsWith: HISTORY_ID_PREFIX } },
  });
  if (deletedHistory.count > 0) {
    console.info(`[enrich-reese-ward] Removed ${deletedHistory.count} previous history booking(s).`);
  }

  const client = await prisma.client.upsert({
    where: { shopId_email: { shopId: settings.id, email: CLIENT_EMAIL } },
    update: {
      fullName: CLIENT_FULL_NAME,
      phone: CLIENT_PHONE,
      tags: CLIENT_TAGS,
      notes: CLIENT_NOTES,
    },
    create: {
      shopId: settings.id,
      email: CLIENT_EMAIL,
      fullName: CLIENT_FULL_NAME,
      phone: CLIENT_PHONE,
      tags: CLIENT_TAGS,
      notes: CLIENT_NOTES,
    },
  });

  const oldEmail = targetBooking.email.trim().toLowerCase();
  if (oldEmail !== CLIENT_EMAIL.toLowerCase()) {
    const orphan = await prisma.client.findFirst({
      where: { shopId: settings.id, email: targetBooking.email },
      select: { id: true },
    });
    if (orphan && orphan.id !== client.id) {
      const linkedCount = await prisma.booking.count({ where: { clientId: orphan.id } });
      if (linkedCount === 0) {
        await prisma.client.delete({ where: { id: orphan.id } });
        console.info(`[enrich-reese-ward] Removed orphan client record for ${targetBooking.email}.`);
      }
    }
  }

  const activeServices = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });
  if (activeServices.length === 0) {
    throw new Error('No active services found.');
  }

  const targetDayUtc = toUtcFromLondon(date, parseTimeToMinutes('12:00'));

  for (let i = 0; i < HISTORY_VISIT_COUNT; i += 1) {
    const visitIndex = i + 1;
    const daysBack = DAYS_BETWEEN_VISITS * (HISTORY_VISIT_COUNT - i);
    const visitDay = subDays(targetDayUtc, daysBack);
    const visitDate = formatLondonDate(visitDay);
    const startTime = VISIT_START_TIMES[i % VISIT_START_TIMES.length];
    const service = await loadServiceByName(VISIT_SERVICE_NAMES[i], activeServices);
    const barber = await loadBarberByName(VISIT_BARBER_NAMES[i]);
    const startAt = toUtcFromLondon(visitDate, parseTimeToMinutes(startTime));
    const endAt = addMinutes(startAt, serviceTotalDuration(service, settings.defaultBufferMinutes));

    await prisma.booking.create({
      data: {
        id: historyBookingId(visitIndex),
        barberId: barber.id,
        serviceId: service.id,
        clientId: client.id,
        fullName: CLIENT_FULL_NAME,
        email: CLIENT_EMAIL,
        phone: CLIENT_PHONE,
        startAt,
        endAt,
        status: BookingStatus.BOOKED,
        manageTokenHash: historyManageToken(visitIndex),
        serviceNameAtBooking: service.name,
        servicePricePenceAtBooking: service.pricePence,
        serviceDurationMinutesAtBooking: service.durationMinutes,
        totalPricePence: service.pricePence,
      },
    });
  }

  await prisma.booking.update({
    where: { id: targetBooking.id },
    data: {
      clientId: client.id,
      email: CLIENT_EMAIL,
      phone: CLIENT_PHONE,
    },
  });

  const allBookings = await prisma.booking.findMany({
    where: { clientId: client.id },
    orderBy: { startAt: 'desc' },
    select: {
      status: true,
      startAt: true,
      endAt: true,
      updatedAt: true,
      paymentRequired: true,
      paymentStatus: true,
      totalPricePence: true,
      serviceNameAtBooking: true,
      service: { select: { name: true } },
    },
  });

  const nowMs = Date.now();
  const stats = computeClientStats(allBookings, nowMs);
  const reliabilityScore = computeReliabilityScore(allBookings, nowMs);

  console.info(`[enrich-reese-ward] Client: ${CLIENT_FULL_NAME} <${CLIENT_EMAIL}>`);
  console.info(`[enrich-reese-ward] Tags: ${CLIENT_TAGS.join(', ')}`);
  console.info('[enrich-reese-ward] Stats:');
  console.info(`  Total bookings: ${stats.totalBookings}`);
  console.info(`  Completed: ${stats.completedCount}`);
  console.info(`  No-shows: ${stats.noShowCount}`);
  console.info(`  Total spent: £${(stats.totalSpentPence / 100).toFixed(2)}`);
  console.info(`  Avg per visit: £${(stats.avgSpendPence / 100).toFixed(2)}`);
  console.info(`  Favourite service: ${stats.favouriteService ?? '—'}`);
  console.info(`  Reliability score: ${reliabilityScore} / 100`);
  console.info('[enrich-reese-ward] Recent history:');
  for (const row of allBookings.slice(1, 6)) {
    console.info(
      `  ${formatLondonDate(row.startAt)} ${formatLondonTime(row.startAt)} · ${row.serviceNameAtBooking ?? row.service?.name}`,
    );
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[enrich-reese-ward] Failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
