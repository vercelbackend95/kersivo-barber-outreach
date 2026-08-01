import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('./stripe', () => ({
  retrieveCheckoutSession: vi.fn(),
}));

import {
  createBookingDepositCheckoutSession,
  expireBookingDepositSession,
  refundPaymentIntent,
  resolveDepositSessionExpiresAt,
  STRIPE_SESSION_MIN_TTL_MS,
  StripeConnectApiError,
} from './stripeConnect';

const BOOKING_CREATED_AT = new Date('2026-08-01T12:00:00.000Z');

describe('stripeConnect direct charges', () => {
  const prevKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    fetchMock.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_b05';
  });

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = prevKey;
  });

  it('creates checkout as direct charge with Stripe-Account and no transfer_data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cs_direct', url: 'https://checkout.stripe.test/cs' }),
    });

    const result = await createBookingDepositCheckoutSession({
      shopConnectAccountId: 'acct_shop',
      bookingId: 'book_1',
      shopId: 'shop_1',
      customerEmail: 'client@example.com',
      shopName: 'Test Shop',
      amountPence: 300,
      bookingCreatedAt: BOOKING_CREATED_AT,
      holdExpiresAt: new Date(BOOKING_CREATED_AT.getTime() + 15 * 60 * 1000),
      successUrl: 'https://kersivo.test/success',
      cancelUrl: 'https://kersivo.test/cancel',
    });

    expect(result).toEqual({ id: 'cs_direct', url: 'https://checkout.stripe.test/cs' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/checkout/sessions');
    const headers = init.headers as Record<string, string>;
    expect(headers['Stripe-Account']).toBe('acct_shop');
    const body = String(init.body);
    expect(body).not.toContain('transfer_data');
    expect(body).toContain('payment_intent_data%5Bapplication_fee_amount%5D=0');
    expect(body).toContain('booking_deposit');
    expect(body).toContain('unit_amount');
    expect(body).toContain('300');
    expect(body).not.toContain('unit_amount%5D=500');
    expect(headers['Idempotency-Key']).toBe('booking_deposit_checkout_book_1');
    const expectedExpires = Math.floor(
      (BOOKING_CREATED_AT.getTime() + STRIPE_SESSION_MIN_TTL_MS) / 1000,
    );
    expect(body).toContain(`expires_at=${expectedExpires}`);
  });

  it('uses a stable Idempotency-Key derived from bookingId', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cs_idem', url: 'https://checkout.stripe.test/cs' }),
    });

    await createBookingDepositCheckoutSession({
      shopConnectAccountId: 'acct_shop',
      bookingId: 'book_42',
      shopId: 'shop_1',
      customerEmail: 'client@example.com',
      shopName: 'Test Shop',
      amountPence: 500,
      bookingCreatedAt: BOOKING_CREATED_AT,
      successUrl: 'https://kersivo.test/success',
      cancelUrl: 'https://kersivo.test/cancel',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('booking_deposit_checkout_book_42');
  });

  it('resolveDepositSessionExpiresAt is deterministic for the same anchor', () => {
    const a = resolveDepositSessionExpiresAt({
      anchor: BOOKING_CREATED_AT,
      holdExpiresAt: new Date(BOOKING_CREATED_AT.getTime() + 15 * 60 * 1000),
    });
    const b = resolveDepositSessionExpiresAt({
      anchor: BOOKING_CREATED_AT,
      holdExpiresAt: new Date(BOOKING_CREATED_AT.getTime() + 15 * 60 * 1000),
    });
    expect(a.getTime()).toBe(b.getTime());
    expect(a.getTime()).toBe(BOOKING_CREATED_AT.getTime() + STRIPE_SESSION_MIN_TTL_MS);
  });

  it('expireBookingDepositSession posts /expire with Stripe-Account', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cs_1', status: 'expired' }),
    });

    const outcome = await expireBookingDepositSession('cs_1', 'acct_shop');
    expect(outcome).toBe('expired');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/checkout/sessions/cs_1/expire');
    const headers = init.headers as Record<string, string>;
    expect(headers['Stripe-Account']).toBe('acct_shop');
    expect(headers['Idempotency-Key']).toBe('booking_deposit_expire_cs_1');
  });

  it('expireBookingDepositSession maps already-completed errors to outcome', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'This Checkout Session has already been completed.',
          code: 'session_already_completed',
        },
      }),
    });

    await expect(expireBookingDepositSession('cs_done', 'acct_shop')).resolves.toBe(
      'already_completed',
    );
  });

  it('refunds on connected account for direct charges', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 're_direct', status: 'succeeded', amount: 500 }),
    });

    const result = await refundPaymentIntent('pi_direct', {
      stripeAccount: 'acct_shop',
      idempotencyKey: 'refund_book_1',
    });
    expect(result).toEqual({
      id: 're_direct',
      mode: 'direct',
      status: 'succeeded',
      amount: 500,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Stripe-Account']).toBe('acct_shop');
    expect(headers['Idempotency-Key']).toBe('refund_book_1:direct');
    expect(String(init.body)).toContain('payment_intent=pi_direct');
    expect(String(init.body)).not.toContain('reverse_transfer');
  });

  it('falls back to platform refund with reverse_transfer for legacy destination PI', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'No such payment_intent: pi_legacy', code: 'resource_missing' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 're_legacy', status: 'succeeded', amount: 500 }),
      });

    const result = await refundPaymentIntent('pi_legacy', {
      stripeAccount: 'acct_shop',
      idempotencyKey: 'refund_book_legacy',
    });
    expect(result).toEqual({
      id: 're_legacy',
      mode: 'platform_legacy',
      status: 'succeeded',
      amount: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, legacyInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const headers = legacyInit.headers as Record<string, string>;
    expect(headers['Stripe-Account']).toBeUndefined();
    expect(headers['Idempotency-Key']).toBe('refund_book_legacy:legacy');
    expect(String(legacyInit.body)).toContain('reverse_transfer=true');
  });

  it('uses reverse_transfer when refunding without connected account', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 're_platform' }),
    });

    const result = await refundPaymentIntent('pi_platform');
    expect(result.mode).toBe('platform_legacy');
    expect(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).toContain(
      'reverse_transfer=true',
    );
  });

  it('surfaces StripeConnectApiError on non-missing failures', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: 'Insufficient funds', code: 'balance_insufficient' },
      }),
    });

    await expect(refundPaymentIntent('pi_x', { stripeAccount: 'acct_shop' })).rejects.toBeInstanceOf(
      StripeConnectApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
