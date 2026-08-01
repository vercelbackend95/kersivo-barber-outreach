import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

import { createBookingDepositCheckoutSession } from './stripeConnect';

describe('createBookingDepositCheckoutSession amountPence (H04)', () => {
  const prevKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    fetchMock.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_h04';
  });

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = prevKey;
  });

  it('uses snapshot amountPence for unit_amount (not hardcoded £5)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cs_h04', url: 'https://checkout.stripe.test/cs' }),
    });

    await createBookingDepositCheckoutSession({
      shopConnectAccountId: 'acct_shop',
      bookingId: 'book_1',
      shopId: 'shop_1',
      customerEmail: 'client@example.com',
      shopName: 'Test Shop',
      amountPence: 300,
      bookingCreatedAt: new Date('2026-08-01T12:00:00.000Z'),
      successUrl: 'https://kersivo.test/success',
      cancelUrl: 'https://kersivo.test/cancel',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = String(init.body);
    expect(body).toContain('unit_amount');
    expect(body).toContain('300');
    expect(body).not.toContain('unit_amount%5D=500');
  });

  it('rejects non-positive amountPence', async () => {
    await expect(
      createBookingDepositCheckoutSession({
        shopConnectAccountId: 'acct_shop',
        bookingId: 'book_1',
        shopId: 'shop_1',
        customerEmail: 'client@example.com',
        shopName: 'Test Shop',
        amountPence: 0,
        bookingCreatedAt: new Date('2026-08-01T12:00:00.000Z'),
        successUrl: 'https://kersivo.test/success',
        cancelUrl: 'https://kersivo.test/cancel',
      }),
    ).rejects.toThrow(/amountPence/);
  });
});
