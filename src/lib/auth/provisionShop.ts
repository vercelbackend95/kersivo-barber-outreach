import { prisma } from '@/lib/db/client';

export async function provisionShopForUser(input: {
  userId: string;
  name: string;
  email: string;
}): Promise<{ shopId: string | null }> {
  const existingMember = await prisma.shopMember.findFirst({
    where: { userId: input.userId },
    select: { shopId: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (existingMember) return { shopId: existingMember.shopId };

  const existingOwned = await prisma.shopSettings.findUnique({
    where: { ownerUserId: input.userId },
    select: { id: true },
  });
  if (existingOwned) {
    await ensureOwnerMembership(existingOwned.id, input.userId);
    return { shopId: existingOwned.id };
  }

  // Invitees should join via accept — do not auto-create an Owner preview shop.
  const email = input.email.trim().toLowerCase();
  const openInvite = await prisma.shopInvite.findFirst({
    where: {
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (openInvite) {
    return { shopId: null };
  }

  const displayName = (input.name || input.email.split('@')[0] || 'My').trim();
  const shopName = displayName.toLowerCase().endsWith('shop')
    ? displayName
    : `${displayName}'s Barbershop`;

  const shop = await prisma.shopSettings.create({
    data: {
      name: shopName,
      timezone: 'Europe/London',
      ownerUserId: input.userId,
      onboardingCompleted: false,
      onboardingCurrentStep: 0,
      onboardingCompletedAt: null,
      members: {
        create: {
          userId: input.userId,
          role: 'OWNER',
        },
      },
    },
    select: { id: true },
  });

  return { shopId: shop.id };
}

export async function ensureOwnerMembership(shopId: string, userId: string): Promise<void> {
  await prisma.shopMember.upsert({
    where: { shopId_userId: { shopId, userId } },
    create: { shopId, userId, role: 'OWNER' },
    update: {},
  });
}

export async function getShopIdForUser(userId: string): Promise<string | null> {
  const member = await prisma.shopMember.findFirst({
    where: { userId },
    select: { shopId: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (member) return member.shopId;

  const shop = await prisma.shopSettings.findUnique({
    where: { ownerUserId: userId },
    select: { id: true },
  });
  if (shop) {
    await ensureOwnerMembership(shop.id, userId);
    return shop.id;
  }

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

export async function getMembershipForUser(userId: string, shopId?: string) {
  if (shopId) {
    return prisma.shopMember.findUnique({
      where: { shopId_userId: { shopId, userId } },
      select: {
        id: true,
        shopId: true,
        role: true,
        barberId: true,
      },
    });
  }

  return prisma.shopMember.findFirst({
    where: { userId },
    select: {
      id: true,
      shopId: true,
      role: true,
      barberId: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}
