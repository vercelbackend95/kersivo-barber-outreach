import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import type { CartItem } from './cartStore';

export type StorefrontCheckoutConfig =
  | { type: 'href'; href: string }
  | { type: 'live' }
  | { type: 'publicDemo' }
  | { type: 'testOrder' };

export type TestOrderResult = {
  id: string;
  status: string;
  totalPence: number;
  totalFormatted: string;
  items: Array<{
    name: string;
    quantity: number;
    lineTotalFormatted: string;
  }>;
};

export type DemoOrderSnapshot = {
  totalPence: number;
  totalFormatted: string;
  items: Array<{
    name: string;
    quantity: number;
    lineTotalFormatted: string;
  }>;
};

export type StorefrontCheckoutSuccess =
  | { kind: 'redirect'; url: string }
  | { kind: 'publicDemo'; snapshot: DemoOrderSnapshot }
  | { kind: 'testOrder'; order: TestOrderResult };

export function isHrefCheckout(
  checkout: StorefrontCheckoutConfig,
): checkout is { type: 'href'; href: string } {
  return checkout.type === 'href';
}

export function makeCheckoutIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `test-order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function emptyBagCheckoutMessage(checkout: StorefrontCheckoutConfig) {
  if (checkout.type === 'publicDemo') {
    return 'Your bag is empty. Add products before completing the demo.';
  }
  return 'Your bag is empty. Add products before checkout.';
}

function snapshotFromItems(
  items: CartItem[],
  subtotalPence: number,
  formatPrice: (pence: number) => string,
): DemoOrderSnapshot {
  return {
    totalPence: subtotalPence,
    totalFormatted: formatPrice(subtotalPence),
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      lineTotalFormatted: formatPrice(item.pricePence * item.quantity),
    })),
  };
}

export async function submitStorefrontCheckout(options: {
  checkout: Exclude<StorefrontCheckoutConfig, { type: 'href' }>;
  shopId: string;
  items: CartItem[];
  subtotalPence: number;
  formatPrice: (pence: number) => string;
  idempotencyKey?: string;
}): Promise<StorefrontCheckoutSuccess> {
  const { checkout, shopId, items, subtotalPence, formatPrice, idempotencyKey } = options;

  if (items.length === 0) {
    throw new Error(emptyBagCheckoutMessage(checkout));
  }

  if (checkout.type === 'publicDemo') {
    trackConsentedEvent(FUNNEL_EVENTS.public_shop_demo_completed, undefined, 'analytics');
    return {
      kind: 'publicDemo',
      snapshot: snapshotFromItems(items, subtotalPence, formatPrice),
    };
  }

  if (checkout.type === 'testOrder') {
    const key = idempotencyKey || makeCheckoutIdempotencyKey();
    const response = await fetch('/api/admin/shop/test-order', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        idempotencyKey: key,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to create test order.');
    }
    const order = payload.order as TestOrderResult | undefined;
    if (!order?.id) {
      throw new Error('Test order response was incomplete.');
    }
    return { kind: 'testOrder', order };
  }

  const liveShopId = shopId.trim();
  if (!liveShopId) {
    throw new Error('Live retail checkout is only available on a shop page.');
  }

  const response = await fetch(`/api/public/shop/${encodeURIComponent(liveShopId)}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Unable to start checkout.');
  }
  if (!payload.url || typeof payload.url !== 'string') {
    throw new Error('Stripe checkout URL is missing.');
  }
  return { kind: 'redirect', url: payload.url };
}
