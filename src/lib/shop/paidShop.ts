import { DEMO_SHOP_ID } from '../db/shopScope';
import {
  saasSubscriptionGrantsAccess,
  type SaasSubscriptionAccessFields,
} from '../setup/saasEntitlement';

export type PaidShopFields = {
  id: string;
  shopPaidAt: Date | null;
  smsRemindersEnabled?: boolean;
};

/**
 * Paying KERSIVO tenant gate.
 * When a non-PENDING SaaS subscription row is provided, that entitlement wins.
 * Otherwise falls back to shopPaidAt / smsRemindersEnabled (legacy / webhook cache).
 * Demo shop is never paid.
 */
export function isPaidShop(
  shop: PaidShopFields,
  subscription?: SaasSubscriptionAccessFields | null,
  now: Date = new Date(),
): boolean {
  if (shop.id === DEMO_SHOP_ID) return false;
  if (subscription && String(subscription.status) !== 'PENDING') {
    return saasSubscriptionGrantsAccess(subscription, now);
  }
  if (shop.shopPaidAt != null) return true;
  return shop.smsRemindersEnabled === true;
}
