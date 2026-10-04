import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('./stripe', () => ({
  retrieveCheckoutSession: vi.fn(),
}));

import {
  createBookingDepositCheckoutSession,
  createBookingPaymentCheckoutSession,
  createRetailCheckoutSession,
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

  it('creates retail checkout with N line items, shop_order metadata, and stable key', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cs_retail', url: 'https://checkout.stripe.test/retail' }),
    });

    const orderCreatedAt = new Date('2026-08-01T12:00:00.000Z');
    const result = await createRetailCheckoutSession({
      shopConnectAccountId: 'acct_shop',
      orderId: 'ord_9',
      shopId: 'shop_1',
      orderCreatedAt,
      successUrl: 'https://kersivo.test/shop/shop_1/success',
      cancelUrl: 'https://kersivo.test/shop/shop_1',
      lineItems: [
        { name: 'Clay', unitAmountPence: 1500, quantity: 2 },
        { name: 'Oil', unitAmountPence: 900, quantity: 1 },
      ],
    });

    expect(result.id).toBe('cs_retail');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/checkout/sessions');
    const headers = init.headers as Record<string, string>;
    expect(headers['Stripe-Account']).toBe('acct_shop');
    expect(headers['Idempotency-Key']).toBe('shop_order_checkout_ord_9');
    const body = String(init.body);
    expect(body).toContain('shop_order');
    expect(body).toContain('payment_intent_data%5Bapplication_fee_amount%5D=0');
    expect(body).not.toContain('transfer_data');
    expect(body).toContain('line_items%5B0%5D');
    expect(body).toContain('line_items%5B1%5D');
    expect(body).toContain('1500');
    expect(body).toContain('900');
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

  it('B: allowPlatformLegacyFallback=false fails closed on resource_missing — no platform request', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: 'No such payment_intent: pi_snap', code: 'resource_missing' },
      }),
    });

    await expect(
      refundPaymentIntent('pi_snap', {
        stripeAccount: 'acct_A',
        amount: 500,
        idempotencyKey: 'deposit_refund_book_1',
        allowPlatformLegacyFallback: false,
      }),
    ).rejects.toBeInstanceOf(StripeConnectApiError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['Stripe-Account']).toBe('acct_A');
    expect(headers['Idempotency-Key']).toBe('deposit_refund_book_1:direct');
  });

  it('allowPlatformLegacyFallback=true keeps the explicit legacy platform fallback', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'No such payment_intent', code: 'resource_missing' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 're_legacy', status: 'succeeded', amount: 500 }),
      });

    const result = await refundPaymentIntent('pi_legacy', {
      stripeAccount: 'acct_shop',
      allowPlatformLegacyFallback: true,
    });

    expect(result.mode).toBe('platform_legacy');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('A: allowPlatformLegacyFallback=false still returns a successful direct refund', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 're_direct', status: 'succeeded', amount: 500 }),
    });

    const result = await refundPaymentIntent('pi_snap', {
      stripeAccount: 'acct_A',
      allowPlatformLegacyFallback: false,
    });

    expect(result.mode).toBe('direct');
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it('R: refundApplicationFee sends refund_application_fee=true on the direct refund', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 're_fee', status: 'succeeded', amount: 500 }),
    });

    await refundPaymentIntent('pi_free', {
      stripeAccount: 'acct_shop',
      amount: 500,
      idempotencyKey: 'deposit_refund_book_1',
      refundApplicationFee: true,
    });

    const body = String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body);
    expect(body).toContain('refund_application_fee=true');
    expect(body).toContain('amount=500');
  });

  it('S: refund_application_fee is omitted unless explicitly requested', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 're_plain', status: 'succeeded', amount: 500 }),
    });

    await refundPaymentIntent('pi_full', { stripeAccount: 'acct_shop', amount: 500 });
    await refundPaymentIntent('pi_full', { stripeAccount: 'acct_shop', amount: 500, refundApplicationFee: false });

    for (const call of fetchMock.mock.calls) {
      expect(String((call as [string, RequestInit])[1].body)).not.toContain('refund_application_fee');
    }
  });
});

describe('createBookingPaymentCheckoutSession (generic booking payments)', () => {
  const prevKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    fetchMock.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_b05';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cs_generic', url: 'https://checkout.stripe.test/cs_generic' }),
    });
  });

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = prevKey;
  });

  function baseInput(overrides: Partial<Parameters<typeof createBookingPaymentCheckoutSession>[0]> = {}) {
    return {
      shopConnectAccountId: 'acct_shop',
      bookingId: 'book_1',
      shopId: 'shop_1',
      customerEmail: 'client@example.com',
      shopName: 'Test Shop',
      bookingPaymentType: 'DEPOSIT' as const,
      paymentAmountPence: 500,
      applicationFeePence: 5,
      bookingCreatedAt: BOOKING_CREATED_AT,
      holdExpiresAt: new Date(BOOKING_CREATED_AT.getTime() + 15 * 60 * 1000),
      successUrl: 'https://kersivo.test/success',
      cancelUrl: 'https://kersivo.test/cancel',
      ...overrides,
    };
  }

  function sentParams(index = 0): URLSearchParams {
    return new URLSearchParams(String((fetchMock.mock.calls[index] as [string, RequestInit])[1].body));
  }

  it('H: Free £5 deposit sends application_fee_amount=5 as a direct charge with generic metadata', async () => {
    const result = await createBookingPaymentCheckoutSession(baseInput());

    expect(result).toEqual({ id: 'cs_generic', url: 'https://checkout.stripe.test/cs_generic' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Stripe-Account']).toBe('acct_shop');
    expect(headers['Idempotency-Key']).toBe('booking_payment_checkout_book_1');

    const params = sentParams();
    expect(params.get('payment_intent_data[application_fee_amount]')).toBe('5');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('500');
    expect(params.get('line_items[0][price_data][currency]')).toBe('gbp');
    expect(params.get('metadata[type]')).toBe('booking_payment');
    expect(params.get('metadata[bookingId]')).toBe('book_1');
    expect(params.get('metadata[shopId]')).toBe('shop_1');
    expect(params.get('metadata[bookingPaymentType]')).toBe('DEPOSIT');
    expect(String(init.body)).not.toContain('transfer_data');
    // No money amounts in metadata.
    for (const [key] of params) {
      if (key.startsWith('metadata[')) expect(key).not.toMatch(/amount|fee/i);
    }
  });

  it('H: Free £3 deposit sends application_fee_amount=3', async () => {
    await createBookingPaymentCheckoutSession(baseInput({ paymentAmountPence: 300, applicationFeePence: 3 }));
    expect(sentParams().get('payment_intent_data[application_fee_amount]')).toBe('3');
    expect(sentParams().get('line_items[0][price_data][unit_amount]')).toBe('300');
  });

  it('4C-F: FULL £30 Free booking sends 3000p, a 30p application fee and bookingPaymentType=FULL metadata', async () => {
    await createBookingPaymentCheckoutSession(
      baseInput({ bookingPaymentType: 'FULL', paymentAmountPence: 3000, applicationFeePence: 30 }),
    );
    const params = sentParams();
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('3000');
    expect(params.get('payment_intent_data[application_fee_amount]')).toBe('30');
    expect(params.get('metadata[type]')).toBe('booking_payment');
    expect(params.get('metadata[bookingPaymentType]')).toBe('FULL');
  });

  it('I: Full (0% fee) omits application_fee_amount', async () => {
    await createBookingPaymentCheckoutSession(baseInput({ applicationFeePence: 0 }));
    expect(sentParams().has('payment_intent_data[application_fee_amount]')).toBe(false);
    expect(sentParams().get('metadata[type]')).toBe('booking_payment');
  });

  it('K: identical snapshot → identical request body + idempotency key on retry', async () => {
    await createBookingPaymentCheckoutSession(baseInput());
    await createBookingPaymentCheckoutSession(baseInput());
    const [first, second] = fetchMock.mock.calls as [string, RequestInit][];
    expect(String(second[1].body)).toBe(String(first[1].body));
    expect((second[1].headers as Record<string, string>)['Idempotency-Key']).toBe(
      (first[1].headers as Record<string, string>)['Idempotency-Key'],
    );
  });

  it('rejects invalid amounts and fees >= amount', async () => {
    await expect(createBookingPaymentCheckoutSession(baseInput({ paymentAmountPence: 0 }))).rejects.toThrow();
    await expect(createBookingPaymentCheckoutSession(baseInput({ applicationFeePence: -1 }))).rejects.toThrow();
    await expect(
      createBookingPaymentCheckoutSession(baseInput({ paymentAmountPence: 5, applicationFeePence: 5 })),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AD: legacy wrapper still produces booking_deposit metadata, legacy key and £0 fee', async () => {
    await createBookingDepositCheckoutSession({
      shopConnectAccountId: 'acct_shop',
      bookingId: 'book_1',
      shopId: 'shop_1',
      customerEmail: 'client@example.com',
      shopName: 'Test Shop',
      amountPence: 500,
      bookingCreatedAt: BOOKING_CREATED_AT,
      successUrl: 'https://kersivo.test/success',
      cancelUrl: 'https://kersivo.test/cancel',
    });
    const params = sentParams();
    expect(params.get('metadata[type]')).toBe('booking_deposit');
    expect(params.get('payment_intent_data[application_fee_amount]')).toBe('0');
    expect(params.has('metadata[bookingPaymentType]')).toBe(false);
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('booking_deposit_checkout_book_1');
  });
});
