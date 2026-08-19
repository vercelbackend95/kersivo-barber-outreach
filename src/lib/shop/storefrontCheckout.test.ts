/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { submitStorefrontCheckout } from './storefrontCheckout';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

import { trackConsentedEvent } from '@/lib/consent/events';

const trackSpy = vi.mocked(trackConsentedEvent);

const items = [
  { productId: 'prod-1', name: 'Matte Pomade', pricePence: 1800, quantity: 1 },
];

describe('submitStorefrontCheckout', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    trackSpy.mockClear();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('completes public demo locally without fetch', async () => {
    const result = await submitStorefrontCheckout({
      checkout: { type: 'publicDemo' },
      shopId: '',
      items,
      subtotalPence: 1800,
      formatPrice: (pence) => `£${(pence / 100).toFixed(2)}`,
    });

    expect(result).toEqual({
      kind: 'publicDemo',
      snapshot: {
        totalPence: 1800,
        totalFormatted: '£18.00',
        items: [{ name: 'Matte Pomade', quantity: 1, lineTotalFormatted: '£18.00' }],
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.public_shop_demo_completed,
      undefined,
      'analytics',
    );
  });

  it('posts live checkout to the public Connect endpoint', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test' }),
    });

    const result = await submitStorefrontCheckout({
      checkout: { type: 'live' },
      shopId: 'shop-live-1',
      items,
      subtotalPence: 1800,
      formatPrice: () => '£18.00',
    });

    expect(result).toEqual({ kind: 'redirect', url: 'https://checkout.stripe.com/c/pay/cs_test' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/public/shop/shop-live-1/checkout');
    expect(init.method).toBe('POST');
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('posts test orders to the admin test-order API', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        order: {
          id: 'order-test-1',
          status: 'READY_FOR_PICKUP',
          totalPence: 1800,
          totalFormatted: '£18.00',
          items: [{ name: 'Matte Pomade', quantity: 1, lineTotalFormatted: '£18.00' }],
        },
      }),
    });

    const result = await submitStorefrontCheckout({
      checkout: { type: 'testOrder' },
      shopId: '',
      items,
      subtotalPence: 1800,
      formatPrice: () => '£18.00',
      idempotencyKey: 'idem-1',
    });

    expect(result.kind).toBe('testOrder');
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe('/api/admin/shop/test-order');
  });
});
