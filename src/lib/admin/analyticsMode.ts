import { prisma } from '../db/client';

export async function shouldIncludeTestActivityInAnalytics(shopId: string): Promise<boolean> {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: { analyticsIncludeTestActivity: true },
  });

  return shop?.analyticsIncludeTestActivity ?? true;
}

export async function setShopAnalyticsLive(shopId: string): Promise<void> {
  await prisma.shopSettings.update({
    where: { id: shopId },
    data: { analyticsIncludeTestActivity: false },
  });
}

export async function setShopAnalyticsLiveForOwnerEmail(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  const shop = await prisma.shopSettings.findFirst({
    where: {
      owner: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    },
    select: { id: true },
  });

  if (!shop) return false;
  await setShopAnalyticsLive(shop.id);
  return true;
}
