import { prisma } from './client';
import {
  PUBLIC_FALLBACK_SHOP_SETTINGS,
  isPrismaDatabaseUnavailableError,
  isPrismaQuotaExceededError,
  logPrismaQuotaFallback
} from './resilience';
export const DEMO_SHOP_ID = 'demo-shop';

const SHOP_SETTINGS_MISSING_MESSAGE =
  'ShopSettings is missing. Run `npx prisma db seed` to create demo shop settings (id: demo-shop).';

export async function resolveShopId(): Promise<string> {
  try {
    const demoShop = await prisma.shopSettings.findUnique({

      where: { id: DEMO_SHOP_ID },

      select: { id: true }
    });
    if (demoShop) return demoShop.id;

    if (process.env.NODE_ENV !== 'production') {
      const createdDemoShop = await prisma.shopSettings.upsert({
        where: { id: DEMO_SHOP_ID },
        update: {},
        create: {
          ...PUBLIC_FALLBACK_SHOP_SETTINGS
        },
        select: { id: true }
      });

      return createdDemoShop.id;
    }
  } catch (error) {
    if (!isPrismaQuotaExceededError(error) && !isPrismaDatabaseUnavailableError(error)) {
      throw error;
    }

    logPrismaQuotaFallback('resolveShopId', error);
    return DEMO_SHOP_ID;

  }

  throw new Error(SHOP_SETTINGS_MISSING_MESSAGE);
}
