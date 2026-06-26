import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const START_MINUTES = 9 * 60;
const END_MINUTES = 20 * 60;

async function main() {
  const barbers = await prisma.barber.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true }
  });

  if (barbers.length === 0) {
    throw new Error('No active barbers found.');
  }

  console.info(`[set-hours-9-20] Updating ${barbers.length} barber(s): ${barbers.map((b) => b.name).join(', ')}`);

  for (const barber of barbers) {
    await prisma.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { barberId: barber.id } });
      await tx.availabilityRule.createMany({
        data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          barberId: barber.id,
          dayOfWeek,
          startMinutes: START_MINUTES,
          endMinutes: END_MINUTES,
          breakStartMin: null,
          breakEndMin: null,
          active: true
        }))
      });
    });
    console.info(`[set-hours-9-20] ${barber.name}: Mon–Sun 09:00–20:00 (no breaks)`);
  }

  console.info('[set-hours-9-20] Done.');
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[set-hours-9-20] Failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
