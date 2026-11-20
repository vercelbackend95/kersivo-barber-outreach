import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import type { CartItem } from './cartStore';

export type StorefrontLivePaymentMode = 'FULL_UPFRONT' | 'PAY_AT_COLLECTION';

export type StorefrontCheckoutConfig =
  | { type: 'href'; href: string }
  /** paymentMode is the shop's retail setting when the page knows it; the API is the source of truth. */
  | { type: 'live'; paymentMode?: StorefrontLivePaymentMode }
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

export type ReservationCustomer = {
  name: string;
  email: string;
  phone?: string;
};

export type ReservationResult = {
  orderId: string;
  reference: string;
  totalPence: number;
  customerEmail: string;
  items: Array<{ name: string; quantity: number; lineTotalPence: number }>;
};

/** The shop takes payment at collection, so the reservation needs the client's details first. */
export class ReservationDetailsRequiredError extends Error {
  readonly field: string | null;
  constructor(message: string, field: string | null) {
    super(message);
    this.name = 'ReservationDetailsRequiredError';
    this.field = field;
  }
}

export type StorefrontCheckoutSuccess =
  | { kind: 'redirect'; url: string }
  | { kind: 'reserved'; reservation: ReservationResult }
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
  /** Pay-at-collection reservations only. */
  customer?: ReservationCustomer;
}): Promise<StorefrontCheckoutSuccess> {
  const { checkout, shopId, items, subtotalPence, formatPrice, idempotencyKey, customer } = options;

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
      ...(customer
        ? {
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone ?? '',
          }
        : {}),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    if (payload?.code === 'customer_details_required') {
      throw new ReservationDetailsRequiredError(
        payload.error || 'Add your details to reserve this order.',
        typeof payload.field === 'string' ? payload.field : null,
      );
    }
    throw new Error(payload.error || 'Unable to start checkout.');
  }
  if (payload.kind === 'reserved') {
    if (!payload.orderId || !payload.reference) {
      throw new Error('Reservation response was incomplete.');
    }
    return {
      kind: 'reserved',
      reservation: {
        orderId: String(payload.orderId),
        reference: String(payload.reference),
        totalPence: Number(payload.totalPence) || subtotalPence,
        customerEmail: String(payload.customerEmail ?? customer?.email ?? ''),
        items: Array.isArray(payload.items) ? payload.items : [],
      },
    };
  }
  if (!payload.url || typeof payload.url !== 'string') {
    throw new Error('Stripe checkout URL is missing.');
  }
  return { kind: 'redirect', url: payload.url };
}
