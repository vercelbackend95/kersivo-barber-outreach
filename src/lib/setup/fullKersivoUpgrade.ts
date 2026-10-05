import { prisma } from '../db/client';
import { isDemoShopId } from '../shop/cardPaymentsGate';
import {
  resolveKersivoAccess,
  type KersivoAccessDb,
  type KersivoProductState,
} from '../shop/kersivoAccess';

export const BILLING_RECOVERY_REQUIRED = 'BILLING_RECOVERY_REQUIRED';

export type FullUpgradeEligibility =
  | { ok: true; state: Exclude<KersivoProductState, 'FULL_KERSIVO'> }
  | { ok: false; reason: 'not_purchasable' | 'shop_not_found' | 'already_full' | 'billing_recovery' | 'departure_in_progress' };

/**
 * Whether an existing shop may start a new Full KERSIVO subscription checkout. Decided from the
 * latest non-PENDING SaaS subscription + the central product-state resolver, never from the cached
 * shopPaidAt marker alone:
 * - PAST_DUE (in or after grace) / SUSPENDED → fix billing on the existing subscription instead;
 * - FULL_KERSIVO (ACTIVE, cancelAtPeriodEnd before period end, legacy paid) → already subscribed;
 * - a shop leaving KERSIVO (ShopDeparture) → no new checkout; reactivation goes through support;
 * - SETUP / KERSIVO Starter (incl. CANCELED or ended subscriptions) → may buy.
 * Open / expired PENDING attempts are handled by the shared checkout core.
 */
export async function resolveFullUpgradeEligibility(
  shopId: string,
  now: Date = new Date(),
  db: KersivoAccessDb = prisma,
): Promise<FullUpgradeEligibility> {
  const id = shopId.trim();
  if (!id || isDemoShopId(id)) return { ok: false, reason: 'not_purchasable' };

  const shop = await db.shopSettings.findUnique({
    where: { id },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      freeBookingActivatedAt: true,
      departure: { select: { status: true } },
    },
  });
  if (!shop) return { ok: false, reason: 'shop_not_found' };
  if (shop.departure) return { ok: false, reason: 'departure_in_progress' };

  const subscription = await db.saasSubscription.findFirst({
    where: { shopId: id, status: { not: 'PENDING' } },
    orderBy: { createdAt: 'desc' },
    select: {
      status: true,
      currentPeriodEnd: true,
      pastDueSince: true,
      cancelAtPeriodEnd: true,
      postFullPlan: true,
    },
  });

  const status = subscription ? String(subscription.status) : null;
  if (status === 'PAST_DUE' || status === 'SUSPENDED') {
    return { ok: false, reason: 'billing_recovery' };
  }

  const { state } = resolveKersivoAccess(shop, subscription, now);
  if (state === 'FULL_KERSIVO') return { ok: false, reason: 'already_full' };
  return { ok: true, state };
}
