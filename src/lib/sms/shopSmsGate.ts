import { prisma } from '../db/client';

/** Flip on after paid SaaS subscription webhook; cron skips shops where false. */
export async function enableShopSmsReminders(shopId: string): Promise<void> {
  await prisma.shopSettings.update({
    where: { id: shopId },
    data: { smsRemindersEnabled: true },
  });
}

/**
 * Resolve shop by owner email (public checkout has no shopId in metadata),
 * then enable SMS reminders. Returns false if no matching shop.
 */
export async function enableShopSmsRemindersForOwnerEmail(email: string): Promise<boolean> {
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
  await enableShopSmsReminders(shop.id);
  return true;
}
