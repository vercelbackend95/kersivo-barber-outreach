import type { PrismaClient } from '@prisma/client';
import {
  isPrismaDatabaseUnavailableError,
  isPrismaQuotaExceededError,
  logPrismaQuotaFallback,
} from '@/lib/db/resilience';
import type { CarouselProduct } from '@/lib/shop/carouselProducts';
import {
  BLACKLINE_SHOP_ID,
  DEMO_PRODUCTS,
  mergeBlacklineProductRow,
  resolveBlacklineSeedImageUrl,
  type DemoProduct,
} from './products';

/** Map BLACKLINE retail products onto the shared ProductRail product shape. */
export function toBlacklineCarouselProducts(products: readonly DemoProduct[]): CarouselProduct[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    pricePence: product.pricePence,
    imageUrl: product.image.src?.trim() ? product.image.src : null,
    available: true,
    requiresOptions: false,
  }));
}

const DEFAULT_LANDING_RAIL_COUNT = 10;

/** Featured first, then remaining catalogue order; unique IDs; capped for the landing rail. */
export function selectBlacklineLandingRailProducts(
  products: readonly DemoProduct[],
  limit = DEFAULT_LANDING_RAIL_COUNT,
): DemoProduct[] {
  const featured = products.filter((product) => product.featured);
  const rest = products.filter((product) => !product.featured);
  const seen = new Set<string>();
  const ordered: DemoProduct[] = [];

  for (const product of [...featured, ...rest]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    ordered.push(product);
    if (ordered.length >= limit) break;
  }

  return ordered;
}

type ProductClient = {
  shopSettings: PrismaClient['shopSettings'];
  product: {
    findUnique: PrismaClient['product']['findUnique'];
    upsert: PrismaClient['product']['upsert'];
  };
};

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
    const existing = await client.product.findUnique({
      where: { id: product.id },
      select: { imageUrl: true },
    });
    const imageUrl = resolveBlacklineSeedImageUrl(existing?.imageUrl, product.image.src);

    await client.product.upsert({
      where: { id: product.id },
      update: {
        shopId: BLACKLINE_SHOP_ID,
        name: product.name,
        description: product.description,
        pricePence: product.pricePence,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
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
        imageUrl,
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

type BlacklineProductRow = {
  id: string;
  name: string;
  description: string | null;
  pricePence: number;
  imageUrl: string | null;
  active: boolean;
  featured: boolean;
  category: DemoProduct['category'];
  sortOrder: number;
};

/** Fixture is canonical. Prisma only overlays matching ids (uploaded images). Incomplete DB never shrinks the list. */
export function overlayBlacklineRetailProducts(rows: readonly BlacklineProductRow[]): DemoProduct[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return DEMO_PRODUCTS.filter((product) => product.active)
    .map((product) => {
      const row = byId.get(product.id);
      const merged = row ? mergeBlacklineProductRow(row) ?? product : product;
      return { ...merged, active: product.active };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getBlacklineRetailProducts(): Promise<DemoProduct[]> {
  try {
    const { prisma } = await import('@/lib/db/client');
    await ensureBlacklineDemoCatalog(prisma);
    const rows = await prisma.product.findMany({
      where: { shopId: BLACKLINE_SHOP_ID },
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
    return overlayBlacklineRetailProducts(rows);
  } catch (error) {
    if (isPrismaQuotaExceededError(error) || isPrismaDatabaseUnavailableError(error)) {
      logPrismaQuotaFallback('getBlacklineRetailProducts', error);
    }
  }

  return overlayBlacklineRetailProducts([]);
}

export async function getBlacklineRetailProductById(id: string): Promise<DemoProduct | null> {
  const products = await getBlacklineRetailProducts();
  return products.find((product) => product.id === id) ?? null;
}
