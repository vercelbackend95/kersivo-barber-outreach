import { prisma } from '../db/client';
import { enableShopSmsReminders } from '../sms/shopSmsGate';

/** Mark shop as a paying KERSIVO tenant (SMS + deposits eligibility). */
export async function markShopPaid(shopId: string, paidAt: Date = new Date()): Promise<void> {
  await prisma.shopSettings.update({
    where: { id: shopId },
    data: {
      shopPaidAt: paidAt,
      smsRemindersEnabled: true,
    },
  });
}

/** Clear paid-tenant marker after subscription entitlement ends. */
export async function markShopUnpaid(shopId: string): Promise<void> {
  await prisma.shopSettings.update({
    where: { id: shopId },
    data: {
      shopPaidAt: null,
      smsRemindersEnabled: false,
    },
  });
}

export async function markShopPaidForOwnerEmail(
  email: string,
  paidAt: Date = new Date(),
): Promise<boolean> {
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
  await markShopPaid(shop.id, paidAt);
  return true;
}

/** @deprecated Prefer markShopPaid — kept for SMS webhook call sites during transition. */
export async function enableShopSmsRemindersAndPaid(shopId: string): Promise<void> {
  await markShopPaid(shopId);
  await enableShopSmsReminders(shopId);
}
