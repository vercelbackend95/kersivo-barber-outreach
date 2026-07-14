import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_SHOP_ID = 'demo-shop';

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

  const barbers = await Promise.all(
    ['Jay', 'Mason', 'Luca'].map((name) =>
      prisma.barber.upsert({
        where: { id: `seed-${name.toLowerCase()}` },
        update: { name, active: true, shopId: DEMO_SHOP_ID },
        create: { id: `seed-${name.toLowerCase()}`, name, active: true, shopId: DEMO_SHOP_ID }
      })
    )
  );

  for (const barber of barbers) {
    await prisma.availabilityRule.deleteMany({ where: { barberId: barber.id } });
    for (let day = 0; day <= 6; day += 1) {
      await prisma.availabilityRule.create({
        data: {
          barberId: barber.id,
          dayOfWeek: day,
          startMinutes: 9 * 60,
          endMinutes: 20 * 60,
          breakStartMin: null,
          breakEndMin: null
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
