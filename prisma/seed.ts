import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.shopSettings.upsert({
    where: { id: 'demo-shop' },
    update: { name: 'Demo Barbershop' },
    create: {
      id: 'demo-shop',
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
    { id: 'svc-haircut', name: 'Haircut', durationMinutes: 30 },
    { id: 'svc-skin-fade', name: 'Skin Fade', durationMinutes: 45 },
    { id: 'svc-beard-trim', name: 'Beard Trim', durationMinutes: 20 },
    { id: 'svc-haircut-beard', name: 'Haircut + Beard', durationMinutes: 50 }
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: service,
      create: service
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
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
