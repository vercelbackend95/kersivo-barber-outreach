import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deletedBookings = await prisma.booking.deleteMany({});
  console.info(`[clear-services] Removed ${deletedBookings.count} booking(s).`);

  const deletedLinks = await prisma.barberService.deleteMany({});
  console.info(`[clear-services] Removed ${deletedLinks.count} barber-service link(s).`);

  const deletedServices = await prisma.service.deleteMany({});
  console.info(`[clear-services] Removed ${deletedServices.count} service(s).`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[clear-services] Failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
