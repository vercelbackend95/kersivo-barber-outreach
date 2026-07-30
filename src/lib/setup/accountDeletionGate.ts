import type { SaasSubscriptionStatus } from '@prisma/client';

export const ACCOUNT_DELETE_BLOCKED_CODE = 'SUBSCRIPTION_BLOCKS_DELETE' as const;

export type SubscriptionDeletionFields = {
  shopId: string | null;
  status: SaasSubscriptionStatus | string;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
};

export type BlockingShop = {
  shopId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
};

/**
 * Hard account delete is blocked while Stripe may still bill (or collect)
 * for a sole-owner shop.
 */
export function subscriptionBlocksAccountDeletion(
  sub: Pick<SubscriptionDeletionFields, 'status' | 'stripeSubscriptionId'>,
): boolean {
  const status = String(sub.status);
  if (status === 'ACTIVE' || status === 'PAST_DUE' || status === 'SUSPENDED') {
    return true;
  }
  if (status === 'PENDING' && Boolean(sub.stripeSubscriptionId?.trim())) {
    return true;
  }
  return false;
}

export function collectBlockingShops(
  subscriptions: SubscriptionDeletionFields[],
): BlockingShop[] {
  const blocked: BlockingShop[] = [];
  for (const sub of subscriptions) {
    const shopId = sub.shopId?.trim();
    if (!shopId) continue;
    if (!subscriptionBlocksAccountDeletion(sub)) continue;
    blocked.push({
      shopId,
      status: String(sub.status),
      cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      stripeSubscriptionId: sub.stripeSubscriptionId?.trim() || null,
    });
  }
  return blocked;
}

export type AccountDeletionGateResult =
  | { allowed: true }
  | { allowed: false; shops: BlockingShop[] };

export function assertAccountDeletionAllowed(
  subscriptions: SubscriptionDeletionFields[],
): AccountDeletionGateResult {
  const shops = collectBlockingShops(subscriptions);
  if (shops.length > 0) return { allowed: false, shops };
  return { allowed: true };
}
