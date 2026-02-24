import { prisma } from './client';

export const DEMO_SHOP_ID = 'demo-shop';

export async function resolveShopId(): Promise<string> {
  const demoShop = await prisma.shopSettings.findUnique({
    where: { id: DEMO_SHOP_ID },
    select: { id: true }
  });

  if (demoShop) return demoShop.id;

  const fallback = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  return fallback.id;
}
