import { prisma } from '@/lib/db/client';

export async function provisionShopForUser(input: {
  userId: string;
  name: string;
  email: string;
}): Promise<{ shopId: string }> {
  const existing = await prisma.shopSettings.findUnique({
    where: { ownerUserId: input.userId },
    select: { id: true },
  });
  if (existing) return { shopId: existing.id };

  const displayName = (input.name || input.email.split('@')[0] || 'My').trim();
  const shopName = displayName.toLowerCase().endsWith('shop')
    ? displayName
    : `${displayName}'s Barbershop`;

  const shop = await prisma.shopSettings.create({
    data: {
      name: shopName,
      timezone: 'Europe/London',
      ownerUserId: input.userId,
    },
    select: { id: true },
  });

  return { shopId: shop.id };
}

export async function getShopIdForUser(userId: string): Promise<string | null> {
  const shop = await prisma.shopSettings.findUnique({
    where: { ownerUserId: userId },
    select: { id: true },
  });
  if (shop) return shop.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) return null;

  const provisioned = await provisionShopForUser({
    userId,
    name: user.name,
    email: user.email,
  });
  return provisioned.shopId;
}
