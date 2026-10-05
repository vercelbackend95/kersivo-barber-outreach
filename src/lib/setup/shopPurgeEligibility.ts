import { prisma } from '../db/client';
import { isDemoShopId } from '../shop/cardPaymentsGate';
import { resolveKersivoProductState, type KersivoAccessDb } from '../shop/kersivoAccess';
import { countFutureOperationalBookings } from '../shop/shopDeparture';

export type ShopPurgeBlockReason =
  /** ShopSettings row no longer exists (already purged / deleted). */
  | 'shop_not_found'
  /** Demo / BLACKLINE showcase shops are never purged. */
  | 'protected_shop'
  /** No ShopDeparture: a canceled subscription or an old retention date is never purge authority. */
  | 'no_departure'
  /** Departure still winding down existing appointments. */
  | 'winding_down'
  /** Departure retention period has not ended yet. */
  | 'retention_open'
  /** A PENDING / ACTIVE / PAST_DUE / SUSPENDED subscription exists for the shop. */
  | 'open_subscription'
  /** The shop currently has active KERSIVO service (Starter or Full). */
  | 'active_service'
  /** Upcoming / in-flight bookings still need handling. */
  | 'future_bookings';

export type ShopPurgeEligibility = { ok: true } | { ok: false; reason: ShopPurgeBlockReason };

/**
 * Whether the WHOLE shop may be purged right now. Fails closed unless the shop has genuinely
 * left KERSIVO through the departure lifecycle:
 * - a ShopDeparture in RETENTION whose retentionEndsAt has passed;
 * - no open SaaS subscription and no active service (neither Starter nor Full);
 * - no future operational bookings.
 * Pass a transaction client to re-check inside the purge transaction.
 */
export async function resolveShopPurgeEligibility(input: {
  shopId: string;
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
      departure: { select: { status: true, retentionEndsAt: true } },
    },
  });
  if (!shop) return { ok: false, reason: 'shop_not_found' };

  const departure = shop.departure;
  if (!departure) return { ok: false, reason: 'no_departure' };
  if (String(departure.status) !== 'RETENTION') return { ok: false, reason: 'winding_down' };
  if (!departure.retentionEndsAt || departure.retentionEndsAt.getTime() > now.getTime()) {
    return { ok: false, reason: 'retention_open' };
  }

  const openSubscriptions = await db.saasSubscription.count({
    where: { shopId, status: { in: ['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] } },
  });
  if (openSubscriptions > 0) return { ok: false, reason: 'open_subscription' };

  const latest = await db.saasSubscription.findFirst({
    where: { shopId, status: { not: 'PENDING' } },
    orderBy: { createdAt: 'desc' },
    select: {
      status: true,
      currentPeriodEnd: true,
      pastDueSince: true,
      cancelAtPeriodEnd: true,
      postFullPlan: true,
    },
  });
  if (resolveKersivoProductState(shop, latest, now) !== 'SETUP') {
    return { ok: false, reason: 'active_service' };
  }

  if ((await countFutureOperationalBookings(shopId, now, db)) > 0) {
    return { ok: false, reason: 'future_bookings' };
  }
  return { ok: true };
}
