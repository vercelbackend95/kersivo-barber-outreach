import { DEMO_SHOP_ID } from '../db/shopScope';

export type PaidShopFields = {
  id: string;
  shopPaidAt: Date | null;
  smsRemindersEnabled?: boolean;
};

/** Paying KERSIVO tenant (SaaS webhook). Demo shop is never paid. */
export function isPaidShop(shop: PaidShopFields): boolean {
  if (shop.id === DEMO_SHOP_ID) return false;
  if (shop.shopPaidAt != null) return true;
  // Legacy back-compat until all paid shops have shopPaidAt.
  return shop.smsRemindersEnabled === true;
}
