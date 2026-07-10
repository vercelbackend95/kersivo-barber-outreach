import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CLIENT_EMAIL = 'oliver.reed@example.com';

function daysAgo(days: number, hour = 11, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

const NOTE_SEEDS = [
  {
    id: 'seed-note-oliver-01',
    body: 'Prefers skin fade, #2 on sides. Always asks for a sharp line-up around the temples.',
    createdAt: daysAgo(28, 10, 15),
    barberName: 'Jamie Reed',
  },
  {
    id: 'seed-note-oliver-02',
    body: 'Likes a bit of texture on top — matte clay works well. Skip heavy pomade.',
    createdAt: daysAgo(19, 16, 40),
    barberName: 'Alex Morgan',
  },
  {
    id: 'seed-note-oliver-03',
    body: 'Running 5 min late last visit but called ahead. Reliable regular — no issues.',
    createdAt: daysAgo(6, 9, 5),
    barberName: 'Jamie Reed',
  },
  {
    id: 'seed-note-oliver-04',
    body: 'Mentioned wedding in August — suggested booking a trial cut 2–3 weeks before.',
    createdAt: daysAgo(2, 14, 20),
    barberName: 'Marcus Bell',
  },
] as const;

async function main() {
  const shop = await prisma.shopSettings.findFirst({ select: { id: true } });
  if (!shop) throw new Error('No shop found. Run prisma seed first.');

  const client = await prisma.client.findFirst({
    where: { shopId: shop.id, email: CLIENT_EMAIL },
    select: { id: true, fullName: true },
  });

  if (!client) {
    throw new Error(`Client not found for ${CLIENT_EMAIL}. Create the client first.`);
  }

  const barbers = await prisma.barber.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  const barberByName = new Map(barbers.map((barber) => [barber.name, barber.id]));

  for (const note of NOTE_SEEDS) {
    const barberId = barberByName.get(note.barberName) ?? null;
    await prisma.clientNote.upsert({
      where: { id: note.id },
      update: {
        body: note.body,
        createdAt: note.createdAt,
        barberId,
      },
      create: {
        id: note.id,
        clientId: client.id,
        body: note.body,
        createdAt: note.createdAt,
        barberId,
      },
    });
  }

  console.log(`[seed] Added ${NOTE_SEEDS.length} notes for ${client.fullName ?? CLIENT_EMAIL}.`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
