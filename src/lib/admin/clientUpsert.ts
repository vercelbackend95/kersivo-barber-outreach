import { prisma } from '../db/client';

export async function upsertShopClient(input: {
  email: string;
  fullName?: string | null;
  phone?: string | null;
}) {
  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  const email = input.email.trim();
  if (!email) {
    throw new Error('Email is required.');
  }

  return prisma.client.upsert({
    where: { shopId_email: { shopId: shop.id, email } },
    update: {
      fullName: input.fullName ?? undefined,
      phone: input.phone ?? undefined,
    },
    create: {
      shopId: shop.id,
      email,
      fullName: input.fullName ?? null,
      phone: input.phone ?? null,
    },
    select: { id: true },
  });
}
