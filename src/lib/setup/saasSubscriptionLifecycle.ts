import type { SaasSubscription, SaasSubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { markShopPaid, markShopUnpaid } from '@/lib/shop/markShopPaid';
import type { StripeSubscription } from '@/lib/shop/stripe';
import {
  ACCOUNT_LIFECYCLE_ACTIONS,
  recordAccountLifecycleEvent,
} from '@/lib/setup/accountLifecycleAudit';
import { purgeShopData } from '@/lib/setup/purgeShopData';
import {
  mapStripeSubscriptionStatus,
  periodEndFromUnixSeconds,
  retentionEndsAtFrom,
  saasSubscriptionGrantsAccess,
  SAAS_GRACE_DAYS,
} from '@/lib/setup/saasEntitlement';

export type SaasLifecycleSyncResult = {
  record: SaasSubscription | null;
  grantedAccess: boolean;
  shopId: string | null;
};

export async function findSaasSubscriptionForLifecycle(input: {
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
}): Promise<SaasSubscription | null> {
  const subscriptionId = input.stripeSubscriptionId?.trim();
  if (subscriptionId) {
    const bySub = await prisma.saasSubscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      orderBy: { createdAt: 'desc' },
    });
    if (bySub) return bySub;
  }

  const customerId = input.stripeCustomerId?.trim();
  if (customerId) {
    return prisma.saasSubscription.findFirst({
      where: { stripeCustomerId: customerId, status: { not: 'PENDING' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  return null;
}

export async function applyShopAccessFromSubscription(
  shopId: string | null | undefined,
  record: Pick<SaasSubscription, 'status' | 'currentPeriodEnd' | 'pastDueSince' | 'activatedAt'>,
  now: Date = new Date(),
): Promise<boolean> {
  const id = shopId?.trim();
  if (!id) return false;
  const granted = saasSubscriptionGrantsAccess(record, now);
  if (granted) {
    await markShopPaid(id, record.activatedAt ?? now);
  } else {
    await markShopUnpaid(id);
  }
  return granted;
}

export async function applyStripeSubscriptionToSaasRecord(
  stripeSub: StripeSubscription,
  options: { forceCanceled?: boolean } = {},
): Promise<SaasLifecycleSyncResult> {
  const customerId =
    typeof stripeSub.customer === 'string'
      ? stripeSub.customer
      : stripeSub.customer?.id?.trim() || null;

  const existing = await findSaasSubscriptionForLifecycle({
    stripeSubscriptionId: stripeSub.id,
    stripeCustomerId: customerId,
  });

  if (!existing) {
    return { record: null, grantedAccess: false, shopId: null };
  }

  let status: SaasSubscriptionStatus = options.forceCanceled
    ? 'CANCELED'
    : mapStripeSubscriptionStatus(stripeSub.status);

  // Keep local SUSPENDED if Stripe still reports past_due (cron owns day-8 transition).
  if (!options.forceCanceled && status === 'PAST_DUE' && existing.status === 'SUSPENDED') {
    status = 'SUSPENDED';
  }

  const currentPeriodEnd = periodEndFromUnixSeconds(stripeSub.current_period_end ?? null);
  const canceledAt = options.forceCanceled
    ? periodEndFromUnixSeconds(stripeSub.canceled_at ?? null) ?? new Date()
    : status === 'CANCELED'
      ? periodEndFromUnixSeconds(stripeSub.canceled_at ?? null) ?? existing.canceledAt ?? new Date()
      : null;

  const metadataShopId = stripeSub.metadata?.shopId?.trim() || null;
  const retentionEndsAt =
    status === 'CANCELED' && canceledAt
      ? existing.retentionEndsAt ?? retentionEndsAtFrom(canceledAt)
      : existing.retentionEndsAt;

  const record = await prisma.saasSubscription.update({
    where: { id: existing.id },
    data: {
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId: customerId || existing.stripeCustomerId,
      shopId: existing.shopId || metadataShopId,
      status,
      cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
      currentPeriodEnd: currentPeriodEnd ?? existing.currentPeriodEnd,
      canceledAt,
      retentionEndsAt,
      pastDueSince:
        status === 'PAST_DUE' || status === 'SUSPENDED'
          ? existing.pastDueSince
          : status === 'ACTIVE'
            ? null
            : existing.pastDueSince,
      suspendedAt: status === 'SUSPENDED' ? existing.suspendedAt : status === 'ACTIVE' ? null : existing.suspendedAt,
    },
  });

  const shopId = record.shopId?.trim() || null;
  const grantedAccess = await applyShopAccessFromSubscription(shopId, record);

  return { record, grantedAccess, shopId };
}

export async function applyInvoicePaymentFailed(input: {
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  now?: Date;
}): Promise<SaasLifecycleSyncResult> {
  const now = input.now ?? new Date();
  const existing = await findSaasSubscriptionForLifecycle(input);
  if (!existing) return { record: null, grantedAccess: false, shopId: null };

  if (existing.status === 'CANCELED') {
    return {
      record: existing,
      grantedAccess: saasSubscriptionGrantsAccess(existing, now),
      shopId: existing.shopId,
    };
  }

  const record = await prisma.saasSubscription.update({
    where: { id: existing.id },
    data: {
      status: existing.status === 'SUSPENDED' ? 'SUSPENDED' : 'PAST_DUE',
      pastDueSince: existing.pastDueSince ?? now,
    },
  });

  const shopId = record.shopId?.trim() || null;
  const grantedAccess = await applyShopAccessFromSubscription(shopId, record, now);

  return { record, grantedAccess, shopId };
}

export async function applyInvoicePaid(input: {
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  currentPeriodEnd?: Date | null;
}): Promise<SaasLifecycleSyncResult> {
  const existing = await findSaasSubscriptionForLifecycle(input);
  if (!existing) return { record: null, grantedAccess: false, shopId: null };

  if (existing.status === 'CANCELED') {
    return {
      record: existing,
      grantedAccess: false,
      shopId: existing.shopId,
    };
  }

  const record = await prisma.saasSubscription.update({
    where: { id: existing.id },
    data: {
      status: 'ACTIVE',
      currentPeriodEnd: input.currentPeriodEnd ?? existing.currentPeriodEnd,
      pastDueSince: null,
      suspendedAt: null,
      canceledAt: null,
    },
  });

  const shopId = record.shopId?.trim() || null;
  const grantedAccess = await applyShopAccessFromSubscription(shopId, record);

  return { record, grantedAccess, shopId };
}

/** Cron: PAST_DUE past grace Ôćĺ SUSPENDED + unpaid. */
export async function suspendPastDueSubscriptionsPastGrace(now: Date = new Date()): Promise<{
  suspended: number;
}> {
  const graceCutoff = new Date(now.getTime() - SAAS_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.saasSubscription.findMany({
    where: {
      status: 'PAST_DUE',
      pastDueSince: { lte: graceCutoff },
    },
    select: { id: true, shopId: true, activatedAt: true, currentPeriodEnd: true, pastDueSince: true },
  });

  let suspended = 0;
  for (const row of candidates) {
    const record = await prisma.saasSubscription.update({
      where: { id: row.id },
      data: {
        status: 'SUSPENDED',
        suspendedAt: now,
      },
    });
    await applyShopAccessFromSubscription(record.shopId, record, now);
    suspended += 1;
  }

  return { suspended };
}

export async function purgeShopsAfterRetentionEnds(now: Date = new Date()): Promise<{
  purged: number;
}> {
  const candidates = await prisma.saasSubscription.findMany({
    where: {
      status: 'CANCELED',
      retentionEndsAt: { lte: now },
      shopId: { not: null },
    },
    select: {
      id: true,
      shopId: true,
      customerEmail: true,
      retentionEndsAt: true,
    },
  });

  let purged = 0;
  for (const row of candidates) {
    const shopId = row.shopId?.trim();
    if (!shopId) continue;

    const shop = await prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: { id: true },
    });
    if (!shop) {
      await prisma.saasSubscription.update({
        where: { id: row.id },
        data: { shopId: null },
      });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await purgeShopData(tx, shopId);
        await tx.saasSubscription.update({
          where: { id: row.id },
          data: { shopId: null },
        });
      });
      await recordAccountLifecycleEvent({
        action: ACCOUNT_LIFECYCLE_ACTIONS.SHOP_PURGED_AFTER_RETENTION,
        email: row.customerEmail,
        shopId,
        meta: {
          saasSubscriptionId: row.id,
          retentionEndsAt: row.retentionEndsAt?.toISOString() ?? null,
        },
      });
      purged += 1;
    } catch (error) {
      console.error(`[saas-lifecycle] purge failed for shop ${shopId}`, error);
    }
  }

  return { purged };
}

export async function runSaasLifecycleCron(now: Date = new Date()): Promise<{
  suspended: number;
  purged: number;
}> {
  const suspended = await suspendPastDueSubscriptionsPastGrace(now);
  const purged = await purgeShopsAfterRetentionEnds(now);
  return { suspended: suspended.suspended, purged: purged.purged };
}
