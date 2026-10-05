import { prisma } from '../db/client';
import { isDemoShopId } from '../shop/cardPaymentsGate';
import { resolveKersivoProductState, type KersivoAccessDb } from '../shop/kersivoAccess';

export type ShopPurgeBlockReason =
  /** ShopSettings row no longer exists (already purged / deleted). */
  | 'shop_not_found'
  /** Demo / BLACKLINE showcase shops are never purged. */
  | 'protected_shop'
  /** A PENDING / ACTIVE / PAST_DUE / SUSPENDED subscription exists for the shop. */
  | 'open_subscription'
  /** The canceled row is not the shop's latest subscription (a newer one exists). */
  | 'newer_subscription'
  /** The candidate row is not CANCELED anymore. */
  | 'not_canceled'
  /** The shop currently has active KERSIVO service (Starter or Full). */
  | 'active_service'
  /** Previously-Starter shop whose Full ended with no recorded plan choice — keep its data. */
  | 'awaiting_plan_choice';

export type ShopPurgeEligibility = { ok: true } | { ok: false; reason: ShopPurgeBlockReason };

/**
 * Whether an expired CANCELED SaaS subscription row is authority to purge the WHOLE shop right now.
 * A historical canceled row alone never is: the shop's current authoritative product state must be
 * "no active service", the row must be the shop's latest subscription with nothing open, and the
 * departure must be genuine:
 * - postFullPlan = LEAVE (explicit departure) → purge;
 * - undecided / CHOICE_REQUIRED for a shop that never activated Starter (SETUP → Full → canceled)
 *   → purge per the existing retention policy;
 * - undecided / CHOICE_REQUIRED for a shop that used Starter before Full → fail closed (kept until
 *   the owner chooses Starter or Leave).
 * Pass a transaction client to re-check inside the purge transaction.
 */
export async function resolveShopPurgeEligibility(input: {
  shopId: string;
  saasSubscriptionId: string;
  now?: Date;
  db?: KersivoAccessDb;
}): Promise<ShopPurgeEligibility> {
  const db = input.db ?? prisma;
  const now = input.now ?? new Date();
  const shopId = input.shopId.trim();
  if (!shopId) return { ok: false, reason: 'shop_not_found' };
  if (isDemoShopId(shopId)) return { ok: false, reason: 'protected_shop' };

  const shop = await db.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      freeBookingActivatedAt: true,
    },
  });
  if (!shop) return { ok: false, reason: 'shop_not_found' };

  const openSubscriptions = await db.saasSubscription.count({
    where: { shopId, status: { in: ['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] } },
  });
  if (openSubscriptions > 0) return { ok: false, reason: 'open_subscription' };

  const latest = await db.saasSubscription.findFirst({
    where: { shopId, status: { not: 'PENDING' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      currentPeriodEnd: true,
      pastDueSince: true,
      cancelAtPeriodEnd: true,
      postFullPlan: true,
    },
  });
  if (!latest || latest.id !== input.saasSubscriptionId) {
    return { ok: false, reason: 'newer_subscription' };
  }
  if (String(latest.status) !== 'CANCELED') return { ok: false, reason: 'not_canceled' };

  if (resolveKersivoProductState(shop, latest, now) !== 'SETUP') {
    return { ok: false, reason: 'active_service' };
  }

  const plan = String(latest.postFullPlan ?? 'UNDECIDED');
  if (plan === 'LEAVE') return { ok: true };
  if (shop.freeBookingActivatedAt != null) return { ok: false, reason: 'awaiting_plan_choice' };
  return { ok: true };
}
