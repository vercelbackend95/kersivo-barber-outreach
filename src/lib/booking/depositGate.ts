import type { PaidShopFields } from '../shop/paidShop';
import {
  canShopTakeCardPayments,
  evaluateCardPayments,
  isDemoShopId,
  type CardPaymentsShopFields,
} from '../shop/cardPaymentsGate';

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

export type DepositShopFields = PaidShopFields &
  CardPaymentsShopFields & {
    depositsEnabled: boolean;
  };

export { isDemoShopId };

/**
 * Whether online booking must collect the £5 deposit for this shop.
 * Hard-off for demo / unpaid / toggle off / Connect not ready.
 */
export function canCollectBookingDeposit(shop: DepositShopFields): boolean {
  if (!canShopTakeCardPayments(shop)) return false;
  if (!shop.depositsEnabled) return false;
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
  const base = evaluateCardPayments(shop);
  if (!base.ok) return base;
  if (!shop.depositsEnabled) return { ok: false, reason: 'deposits_disabled' };
  return { ok: true, reason: 'ok' };
}
