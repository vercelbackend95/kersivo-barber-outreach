import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CatalogService = {
  id: string;
  name: string;
  category: string;
  pricePence: number;
  durationMinutes: number;
  displayOrder: number;
};

function gbp(pounds: number): number {
  return Math.round(pounds * 100);
}

const CATALOG_SERVICES: CatalogService[] = [
  {
    id: 'svc-quality-haircut',
    name: 'Quality haircut',
    category: 'featured',
    pricePence: gbp(35),
    durationMinutes: 30,
    displayOrder: 1
  },
  {
    id: 'svc-premium-haircut',
    name: 'Premium haircut',
    category: 'featured',
    pricePence: gbp(45),
    durationMinutes: 45,
    displayOrder: 2
  },
  {
    id: 'svc-quality-beard-trim',
    name: 'Quality beard trim',
    category: 'featured',
    pricePence: gbp(15),
    durationMinutes: 15,
    displayOrder: 3
  },
  {
    id: 'svc-skin-fade-with-haircut',
    name: 'Skin fade with haircut',
    category: 'featured',
    pricePence: gbp(40),
    durationMinutes: 45,
    displayOrder: 4
  },
  {
    id: 'svc-clippers-only',
    name: 'Clippers only',
    category: 'featured',
    pricePence: gbp(15),
    durationMinutes: 15,
    displayOrder: 5
  },
  {
    id: 'svc-short-back-and-sides-clipper',
    name: 'Short back and sides clipper',
    category: 'featured',
    pricePence: gbp(30),
    durationMinutes: 25,
    displayOrder: 6
  },
  {
    id: 'svc-longer-haircut',
    name: 'Longer haircut',
    category: 'styling',
    pricePence: gbp(65),
    durationMinutes: 60,
    displayOrder: 7
  },
  {
    id: 'svc-skin-fade-back-sides-only',
    name: 'Skin fade back n sides only',
    category: 'styling',
    pricePence: gbp(30),
    durationMinutes: 25,
    displayOrder: 8
  },
  {
    id: 'svc-head-shave',
    name: 'Head shave',
    category: 'styling',
    pricePence: gbp(25),
    durationMinutes: 20,
    displayOrder: 9
  },
  {
    id: 'svc-hair-wash',
    name: 'Hair wash',
    category: 'styling',
    pricePence: gbp(10),
    durationMinutes: 10,
    displayOrder: 10
  },
  {
    id: 'svc-premium-beard-trim',
    name: 'Premium beard trim',
    category: 'beard styling',
    pricePence: gbp(30),
    durationMinutes: 25,
    displayOrder: 11
  },
  {
    id: 'svc-longer-beard-trim',
    name: 'Longer beard trim',
    category: 'beard styling',
    pricePence: gbp(40),
    durationMinutes: 35,
    displayOrder: 12
  },
  {
    id: 'svc-luxury-wet-shave',
    name: 'Luxury wet shave',
    category: 'shaving',
    pricePence: gbp(40),
    durationMinutes: 40,
    displayOrder: 13
  },
  {
    id: 'svc-express-shave',
    name: 'Express shave',
    category: 'shaving',
    pricePence: gbp(25),
    durationMinutes: 20,
    displayOrder: 14
  },
  {
    id: 'svc-friction',
    name: 'Friction',
    category: 'wellbeing',
    pricePence: gbp(15),
    durationMinutes: 15,
    displayOrder: 15
  },
  {
    id: 'svc-friction-10-min',
    name: 'Friction 10 min',
    category: 'wellbeing',
    pricePence: gbp(10),
    durationMinutes: 10,
    displayOrder: 16
  }
];

async function main() {
  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });

  const barbers = await prisma.barber.findMany({
    where: { active: true, shopId: shop.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true }
  });

  if (barbers.length === 0) {
    throw new Error('No active barbers found. Add barbers before seeding the service catalog.');
  }

  const serviceIds = CATALOG_SERVICES.map((service) => service.id);

  for (const service of CATALOG_SERVICES) {
    await prisma.service.upsert({
      where: { id: service.id },
      create: {
        id: service.id,
        shopId: shop.id,
        name: service.name,
        category: service.category,
        pricePence: service.pricePence,
        durationMinutes: service.durationMinutes,
        displayOrder: service.displayOrder,
        bufferMinutes: 0,
        isActive: true
      },
      update: {
        name: service.name,
        category: service.category,
        pricePence: service.pricePence,
        durationMinutes: service.durationMinutes,
        displayOrder: service.displayOrder,
        bufferMinutes: 0,
        isActive: true
      }
    });
  }

  await prisma.barberService.deleteMany({
    where: { serviceId: { in: serviceIds } }
  });

  const links = barbers.flatMap((barber) =>
    serviceIds.map((serviceId) => ({
      barberId: barber.id,
      serviceId
    }))
  );

  const linked = await prisma.barberService.createMany({
    data: links,
    skipDuplicates: true
  });

  console.info(`[catalog-services] Upserted ${CATALOG_SERVICES.length} service(s).`);
  console.info(`[catalog-services] Active barbers: ${barbers.map((barber) => barber.name).join(', ')}`);
  console.info(`[catalog-services] Barber-service links created: ${linked.count}`);
  console.info('[catalog-services] Sample:');
  for (const service of CATALOG_SERVICES.slice(0, 3)) {
    console.info(
      `  ${service.displayOrder}. ${service.name} · ${service.category} · £${(service.pricePence / 100).toFixed(0)} · ${service.durationMinutes} min`
    );
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[catalog-services] Failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
