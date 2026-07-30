import { DEMO_SHOP_ID } from '../db/shopScope';
import { isPaidShop, type PaidShopFields } from '../shop/paidShop';

/** Cap for online booking deposit (WP-B / H04). Actual charge = min(service price, this). */
export const BOOKING_DEPOSIT_PENCE = 500;
export const BOOKING_DEPOSIT_METADATA_TYPE = 'booking_deposit';

/**
 * Deposit to collect for a service price snapshot.
 * Below £5 → full service value; at/above £5 → £5; £0 → 0 (skip Checkout).
 */
export function resolveBookingDepositPence(servicePricePence: number): number {
  const price = Math.max(0, Math.trunc(servicePricePence));
  return Math.min(price, BOOKING_DEPOSIT_PENCE);
}

export type DepositShopFields = PaidShopFields & {
  depositsEnabled: boolean;
  stripeConnectAccountId: string | null;
  stripeConnectChargesEnabled: boolean;
};

export function isDemoShopId(shopId: string): boolean {
  return shopId === DEMO_SHOP_ID;
}

/**
 * Whether online booking must collect the £5 deposit for this shop.
 * Hard-off for demo / unpaid / toggle off / Connect not ready.
 */
export function canCollectBookingDeposit(shop: DepositShopFields): boolean {
  if (isDemoShopId(shop.id)) return false;
  if (!isPaidShop(shop)) return false;
  if (!shop.depositsEnabled) return false;
  if (!shop.stripeConnectAccountId?.trim()) return false;
  if (!shop.stripeConnectChargesEnabled) return false;
  return true;
}

export type DepositGateReason =
  | 'ok'
  | 'demo_shop'
  | 'unpaid_shop'
  | 'deposits_disabled'
  | 'connect_missing'
  | 'connect_not_ready';

export function evaluateDepositCollection(shop: DepositShopFields): {
  ok: boolean;
  reason: DepositGateReason;
} {
  if (isDemoShopId(shop.id)) return { ok: false, reason: 'demo_shop' };
  if (!isPaidShop(shop)) return { ok: false, reason: 'unpaid_shop' };
  if (!shop.depositsEnabled) return { ok: false, reason: 'deposits_disabled' };
  if (!shop.stripeConnectAccountId?.trim()) return { ok: false, reason: 'connect_missing' };
  if (!shop.stripeConnectChargesEnabled) return { ok: false, reason: 'connect_not_ready' };
  return { ok: true, reason: 'ok' };
}
