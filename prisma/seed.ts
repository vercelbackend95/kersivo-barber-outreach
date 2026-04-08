import { BookingStatus, PrismaClient } from '@prisma/client';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();

const DEMO_SHOP_ID = 'demo-shop';
const LONDON_TZ = 'Europe/London';

function resolveDemoBookingsDate(): string {
  const raw = (process.env.DEMO_BOOKINGS_DATE ?? '').trim();
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return formatInTimeZone(new Date(), LONDON_TZ, 'yyyy-MM-dd');
}

function londonInstant(ymd: string, hour: number, minute: number): Date {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return fromZonedTime(`${ymd}T${h}:${m}:00.000`, LONDON_TZ);
}

type DemoBookingSeed = {
  id: string;
  barberId: string;
  serviceId: string;
  fullName: string;
  email: string;
  phone?: string;
  start: Date;
  end: Date;
  status: BookingStatus;
  serviceNameAtBooking: string;
  servicePricePenceAtBooking: number;
  serviceDurationMinutesAtBooking: number;
  totalPricePence: number;
};

async function seedDemoBookingsForDay(ymd: string, barbers: { id: string }[]) {
  const barberIds = barbers.map((b) => b.id);
  const dayStart = fromZonedTime(`${ymd}T00:00:00.000`, LONDON_TZ);
  const dayEnd = fromZonedTime(`${ymd}T23:59:59.999`, LONDON_TZ);

  await prisma.booking.deleteMany({
    where: {
      barberId: { in: barberIds },
      startAt: { gte: dayStart, lte: dayEnd },
    },
  });

  const rows: DemoBookingSeed[] = [
    {
      id: 'seed-demo-bk-jay-1',
      barberId: 'seed-jay',
      serviceId: 'svc-haircut',
      fullName: 'Oliver Thompson',
      email: 'oliver.thompson@example.com',
      phone: '07700 900123',
      start: londonInstant(ymd, 9, 0),
      end: londonInstant(ymd, 9, 30),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Haircut',
      servicePricePenceAtBooking: 2800,
      serviceDurationMinutesAtBooking: 30,
      totalPricePence: 2800,
    },
    {
      id: 'seed-demo-bk-jay-2',
      barberId: 'seed-jay',
      serviceId: 'svc-beard-trim',
      fullName: 'Harry Mitchell',
      email: 'harry.mitchell@example.com',
      start: londonInstant(ymd, 9, 45),
      end: londonInstant(ymd, 10, 5),
      status: BookingStatus.PENDING_CONFIRMATION,
      serviceNameAtBooking: 'Beard Trim',
      servicePricePenceAtBooking: 1800,
      serviceDurationMinutesAtBooking: 20,
      totalPricePence: 1800,
    },
    {
      id: 'seed-demo-bk-jay-3',
      barberId: 'seed-jay',
      serviceId: 'svc-skin-fade',
      fullName: 'James Davies',
      email: 'james.davies@example.com',
      start: londonInstant(ymd, 10, 35),
      end: londonInstant(ymd, 11, 20),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Skin Fade',
      servicePricePenceAtBooking: 3400,
      serviceDurationMinutesAtBooking: 45,
      totalPricePence: 3400,
    },
    {
      id: 'seed-demo-bk-jay-4',
      barberId: 'seed-jay',
      serviceId: 'svc-haircut-beard',
      fullName: 'Charlotte Wright',
      email: 'charlotte.wright@example.com',
      start: londonInstant(ymd, 12, 5),
      end: londonInstant(ymd, 12, 55),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Haircut + Beard',
      servicePricePenceAtBooking: 4200,
      serviceDurationMinutesAtBooking: 50,
      totalPricePence: 4200,
    },
    {
      id: 'seed-demo-bk-jay-5',
      barberId: 'seed-jay',
      serviceId: 'svc-haircut',
      fullName: 'George Hughes',
      email: 'george.hughes@example.com',
      start: londonInstant(ymd, 15, 10),
      end: londonInstant(ymd, 15, 40),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Haircut',
      servicePricePenceAtBooking: 2650,
      serviceDurationMinutesAtBooking: 30,
      totalPricePence: 2650,
    },
    {
      id: 'seed-demo-bk-mason-1',
      barberId: 'seed-mason',
      serviceId: 'svc-beard-trim',
      fullName: 'William Parker',
      email: 'william.parker@example.com',
      start: londonInstant(ymd, 9, 15),
      end: londonInstant(ymd, 9, 35),
      status: BookingStatus.PENDING_CONFIRMATION,
      serviceNameAtBooking: 'Beard Trim',
      servicePricePenceAtBooking: 1800,
      serviceDurationMinutesAtBooking: 20,
      totalPricePence: 1800,
    },
    {
      id: 'seed-demo-bk-mason-2',
      barberId: 'seed-mason',
      serviceId: 'svc-skin-fade',
      fullName: 'Emily Clarke',
      email: 'emily.clarke@example.com',
      start: londonInstant(ymd, 10, 0),
      end: londonInstant(ymd, 10, 45),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Skin Fade',
      servicePricePenceAtBooking: 3500,
      serviceDurationMinutesAtBooking: 45,
      totalPricePence: 3500,
    },
    {
      id: 'seed-demo-bk-mason-3',
      barberId: 'seed-mason',
      serviceId: 'svc-haircut',
      fullName: 'Jack Bennett',
      email: 'jack.bennett@example.com',
      start: londonInstant(ymd, 11, 25),
      end: londonInstant(ymd, 11, 55),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Haircut',
      servicePricePenceAtBooking: 2800,
      serviceDurationMinutesAtBooking: 30,
      totalPricePence: 2800,
    },
    {
      id: 'seed-demo-bk-mason-4',
      barberId: 'seed-mason',
      serviceId: 'svc-beard-trim',
      fullName: 'Sophie Morgan',
      email: 'sophie.morgan@example.com',
      start: londonInstant(ymd, 14, 0),
      end: londonInstant(ymd, 14, 20),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Beard Trim',
      servicePricePenceAtBooking: 1750,
      serviceDurationMinutesAtBooking: 20,
      totalPricePence: 1750,
    },
    {
      id: 'seed-demo-bk-luca-1',
      barberId: 'seed-luca',
      serviceId: 'svc-haircut',
      fullName: 'Thomas Reed',
      email: 'thomas.reed@example.com',
      start: londonInstant(ymd, 9, 30),
      end: londonInstant(ymd, 10, 0),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Haircut',
      servicePricePenceAtBooking: 2800,
      serviceDurationMinutesAtBooking: 30,
      totalPricePence: 2800,
    },
    {
      id: 'seed-demo-bk-luca-2',
      barberId: 'seed-luca',
      serviceId: 'svc-skin-fade',
      fullName: 'Amelia Foster',
      email: 'amelia.foster@example.com',
      start: londonInstant(ymd, 11, 0),
      end: londonInstant(ymd, 11, 45),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Skin Fade',
      servicePricePenceAtBooking: 3400,
      serviceDurationMinutesAtBooking: 45,
      totalPricePence: 3400,
    },
    {
      id: 'seed-demo-bk-luca-3',
      barberId: 'seed-luca',
      serviceId: 'svc-haircut-beard',
      fullName: 'Benjamin Cole',
      email: 'benjamin.cole@example.com',
      start: londonInstant(ymd, 13, 15),
      end: londonInstant(ymd, 14, 5),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Haircut + Beard',
      servicePricePenceAtBooking: 4300,
      serviceDurationMinutesAtBooking: 50,
      totalPricePence: 4300,
    },
    {
      id: 'seed-demo-bk-luca-4',
      barberId: 'seed-luca',
      serviceId: 'svc-haircut',
      fullName: 'Isla Turner',
      email: 'isla.turner@example.com',
      start: londonInstant(ymd, 16, 0),
      end: londonInstant(ymd, 16, 30),
      status: BookingStatus.CONFIRMED,
      serviceNameAtBooking: 'Haircut',
      servicePricePenceAtBooking: 2900,
      serviceDurationMinutesAtBooking: 30,
      totalPricePence: 2900,
    },
  ];

  for (const row of rows) {
    await prisma.booking.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        barberId: row.barberId,
        serviceId: row.serviceId,
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        startAt: row.start,
        endAt: row.end,
        status: row.status,
        serviceNameAtBooking: row.serviceNameAtBooking,
        servicePricePenceAtBooking: row.servicePricePenceAtBooking,
        serviceDurationMinutesAtBooking: row.serviceDurationMinutesAtBooking,
        totalPricePence: row.totalPricePence,
      },
      update: {
        barberId: row.barberId,
        serviceId: row.serviceId,
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        startAt: row.start,
        endAt: row.end,
        status: row.status,
        serviceNameAtBooking: row.serviceNameAtBooking,
        servicePricePenceAtBooking: row.servicePricePenceAtBooking,
        serviceDurationMinutesAtBooking: row.serviceDurationMinutesAtBooking,
        totalPricePence: row.totalPricePence,
      },
    });
  }
}

async function main() {
  await prisma.shopSettings.upsert({
    where: { id: DEMO_SHOP_ID },
    update: {
      name: 'Demo Barbershop',
      timezone: 'Europe/London',
      cancellationWindowHours: 2,
      rescheduleWindowHours: 2,
      pendingConfirmationMins: 15,
      slotIntervalMinutes: 15,
      defaultBufferMinutes: 0
    },
    create: {
      id: DEMO_SHOP_ID,
      name: 'Demo Barbershop',
      timezone: 'Europe/London',
      cancellationWindowHours: 2,
      rescheduleWindowHours: 2,
      pendingConfirmationMins: 15,
      slotIntervalMinutes: 15,
      defaultBufferMinutes: 0
    }
  });

  const barbers = await Promise.all(['Jay', 'Mason', 'Luca'].map((name) => prisma.barber.upsert({
    where: { id: `seed-${name.toLowerCase()}` },
    update: { name, active: true },
    create: { id: `seed-${name.toLowerCase()}`, name, active: true }
  })));

  const services = [
    { id: 'svc-haircut', name: 'Haircut', durationMinutes: 30, pricePence: 2800, displayOrder: 1, category: 'Hair' },
    { id: 'svc-skin-fade', name: 'Skin Fade', durationMinutes: 45, pricePence: 3400, displayOrder: 2, category: 'Hair' },
    { id: 'svc-beard-trim', name: 'Beard Trim', durationMinutes: 20, pricePence: 1800, displayOrder: 3, category: 'Beard' },
    { id: 'svc-haircut-beard', name: 'Haircut + Beard', durationMinutes: 50, pricePence: 4200, displayOrder: 4, category: 'Packages' }

  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: service,
      create: service
    });
  }

  await prisma.barberService.deleteMany({ where: { barberId: { in: barbers.map((barber) => barber.id) } } });
  for (const barber of barbers) {
    await prisma.barberService.createMany({
      data: services.map((service) => ({ barberId: barber.id, serviceId: service.id })),
      skipDuplicates: true
    });
  }



  for (const barber of barbers) {
    await prisma.availabilityRule.deleteMany({ where: { barberId: barber.id } });
    for (let day = 1; day <= 6; day += 1) {
      await prisma.availabilityRule.create({
        data: {
          barberId: barber.id,
          dayOfWeek: day,
          startMinutes: 10 * 60,
          endMinutes: 18 * 60,
          breakStartMin: 13 * 60,
          breakEndMin: 13 * 60 + 30
        }
      });
    }
  }

  const demoBookingsYmd = resolveDemoBookingsDate();
  await seedDemoBookingsForDay(demoBookingsYmd, barbers);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
