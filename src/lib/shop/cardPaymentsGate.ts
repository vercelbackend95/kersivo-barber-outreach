import { BLACKLINE_SHOP_ID } from '../demo/products';
import { DEMO_SHOP_ID } from '../db/shopScope';
import { isPaidShop, type PaidShopFields } from './paidShop';

export type CardPaymentsShopFields = PaidShopFields & {
  stripeConnectAccountId: string | null;
  stripeConnectChargesEnabled: boolean;
};

export type CardPaymentsGateReason =
  | 'ok'
  | 'demo_shop'
  | 'unpaid_shop'
  | 'connect_missing'
  | 'connect_not_ready';

export function isDemoShopId(shopId: string): boolean {
  return shopId === DEMO_SHOP_ID || shopId === BLACKLINE_SHOP_ID;
}

/**
 * Shared "can this shop take card money via Stripe Connect" predicate.
 * Feature toggles (deposits / retail) compose on top.
 */
export function evaluateCardPayments(shop: CardPaymentsShopFields): {
  ok: boolean;
  reason: CardPaymentsGateReason;
} {
  if (isDemoShopId(shop.id)) return { ok: false, reason: 'demo_shop' };
  if (!isPaidShop(shop)) return { ok: false, reason: 'unpaid_shop' };
  if (!shop.stripeConnectAccountId?.trim()) return { ok: false, reason: 'connect_missing' };
  if (!shop.stripeConnectChargesEnabled) return { ok: false, reason: 'connect_not_ready' };
  return { ok: true, reason: 'ok' };
}

export function canShopTakeCardPayments(shop: CardPaymentsShopFields): boolean {
  return evaluateCardPayments(shop).ok;
}

export type RetailShopFields = CardPaymentsShopFields & {
  retailEnabled: boolean;
};

export type RetailGateReason =
  | CardPaymentsGateReason
  | 'retail_disabled';

export function evaluateRetailSelling(shop: RetailShopFields): {
  ok: boolean;
  reason: RetailGateReason;
} {
  const base = evaluateCardPayments(shop);
  if (!base.ok) return base;
  if (!shop.retailEnabled) return { ok: false, reason: 'retail_disabled' };
  return { ok: true, reason: 'ok' };
}

export function canSellRetail(shop: RetailShopFields): boolean {
  return evaluateRetailSelling(shop).ok;
}

export const SHOP_ORDER_METADATA_TYPE = 'shop_order';
