import type { PrismaClient } from '@prisma/client';
import {
  isPrismaDatabaseUnavailableError,
  isPrismaQuotaExceededError,
  logPrismaQuotaFallback,
} from '@/lib/db/resilience';
import {
  BLACKLINE_SHOP_ID,
  DEMO_PRODUCTS,
  mergeBlacklineProductRow,
  type DemoProduct,
} from './products';

type ProductClient = Pick<PrismaClient, 'shopSettings' | 'product'>;

export async function seedBlacklineDemoCatalog(client: ProductClient): Promise<void> {
  await client.shopSettings.upsert({
    where: { id: BLACKLINE_SHOP_ID },
    update: {
      name: 'Blackline Barbers',
      timezone: 'Europe/London',
      retailEnabled: false,
      smsRemindersEnabled: false,
      shopPaidAt: null,
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
    },
    create: {
      id: BLACKLINE_SHOP_ID,
      name: 'Blackline Barbers',
      timezone: 'Europe/London',
      cancellationWindowHours: 2,
      rescheduleWindowHours: 2,
      pendingConfirmationMins: 15,
      slotIntervalMinutes: 15,
      defaultBufferMinutes: 0,
      retailEnabled: false,
      smsRemindersEnabled: false,
    },
  });

  for (const product of DEMO_PRODUCTS) {
    await client.product.upsert({
      where: { id: product.id },
      update: {
        shopId: BLACKLINE_SHOP_ID,
        name: product.name,
        description: product.description,
        pricePence: product.pricePence,
        imageUrl: product.image.src,
        active: product.active,
        featured: product.featured,
        category: product.category,
        sortOrder: product.sortOrder,
      },
      create: {
        id: product.id,
        shopId: BLACKLINE_SHOP_ID,
        name: product.name,
        description: product.description,
        pricePence: product.pricePence,
        imageUrl: product.image.src,
        active: product.active,
        featured: product.featured,
        category: product.category,
        sortOrder: product.sortOrder,
      },
    });
  }
}

export async function ensureBlacklineDemoCatalog(client: ProductClient): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  await seedBlacklineDemoCatalog(client);
}

function toDemoProducts(
  rows: Array<{
    id: string;
    name: string;
    description: string | null;
    pricePence: number;
    imageUrl: string | null;
    active: boolean;
    featured: boolean;
    category: DemoProduct['category'];
    sortOrder: number;
  }>,
): DemoProduct[] {
  return rows
    .map((row) => mergeBlacklineProductRow(row))
    .filter((product): product is DemoProduct => Boolean(product))
    .filter((product) => product.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getBlacklineRetailProducts(): Promise<DemoProduct[]> {
  try {
    const { prisma } = await import('@/lib/db/client');
    await ensureBlacklineDemoCatalog(prisma);
    const rows = await prisma.product.findMany({
      where: { shopId: BLACKLINE_SHOP_ID, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        pricePence: true,
        imageUrl: true,
        active: true,
        featured: true,
        category: true,
        sortOrder: true,
      },
    });
    const products = toDemoProducts(rows);
    if (products.length >= 3) return products;
  } catch (error) {
    if (isPrismaQuotaExceededError(error) || isPrismaDatabaseUnavailableError(error)) {
      logPrismaQuotaFallback('getBlacklineRetailProducts', error);
    }
  }

  return DEMO_PRODUCTS.filter((product) => product.active);
}

export async function getBlacklineRetailProductById(id: string): Promise<DemoProduct | null> {
  const products = await getBlacklineRetailProducts();
  return products.find((product) => product.id === id) ?? null;
}
