import { prisma } from '../db/client';
import { DEMO_SHOP_ID } from '../db/shopScope';

export async function upsertShopClient(input: {
  email: string;
  fullName?: string | null;
  phone?: string | null;
  shopId?: string;
}) {
  const shopId =
    input.shopId ??
    (await prisma.shopSettings.findUnique({ where: { id: DEMO_SHOP_ID }, select: { id: true } }))?.id ??
    (await prisma.shopSettings.findFirstOrThrow({ select: { id: true } })).id;
  const email = input.email.trim();
  if (!email) {
    throw new Error('Email is required.');
  }

  return prisma.client.upsert({
    where: { shopId_email: { shopId, email } },
    update: {
      fullName: input.fullName ?? undefined,
      phone: input.phone ?? undefined,
    },
    create: {
      shopId,
      email,
      fullName: input.fullName ?? null,
      phone: input.phone ?? null,
    },
    select: { id: true },
  });
}
