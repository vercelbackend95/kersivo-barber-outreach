import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

const createInstantBooking = vi.fn();
const createBookingPaymentCheckoutSession = vi.fn();
const createBookingDepositCheckoutSession = vi.fn();
const retrieveBookingDepositSession = vi.fn();
const updateBooking = vi.fn();
const findUniqueShop = vi.fn();
const shopAcceptsPublicBookings = vi.fn();
const checkBookingRateLimit = vi.fn();
const captureOpsException = vi.fn();

vi.mock('@/lib/ops/sentry', () => ({
  captureOpsException: (...args: unknown[]) => captureOpsException(...args),
  captureOpsMessage: vi.fn(),
}));

vi.mock('@/lib/booking/service', () => ({
  BookingActionError: class BookingActionError extends Error {
    statusCode: number;
    code?: string;
    constructor(message: string, statusCode = 400, code?: string) {
      super(message);
      this.statusCode = statusCode;
      if (code) this.code = code;
    }
  },
  createInstantBooking: (...args: unknown[]) => createInstantBooking(...args),
}));

vi.mock('@/lib/shop/stripeConnect', () => ({
  createBookingPaymentCheckoutSession: (...args: unknown[]) =>
    createBookingPaymentCheckoutSession(...args),
  createBookingDepositCheckoutSession: (...args: unknown[]) =>
    createBookingDepositCheckoutSession(...args),
  retrieveBookingDepositSession: (...args: unknown[]) => retrieveBookingDepositSession(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
    },
    booking: {
      update: (...args: unknown[]) => updateBooking(...args),
    },
  },
}));

vi.mock('@/lib/setup/shopPublicBookingGate', () => ({
  shopAcceptsPublicBookings: (...args: unknown[]) => shopAcceptsPublicBookings(...args),
}));

vi.mock('@/lib/rate-limit/bookingRateLimit', () => ({
  checkBookingRateLimit: (...args: unknown[]) => checkBookingRateLimit(...args),
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.co.uk',
}));

vi.mock('@/lib/db/shopScope', () => ({
  DEMO_SHOP_ID: 'demo',
}));

vi.mock('@/lib/booking/schemas', () => ({
  bookingCreateSchema: {
    safeParse: (payload: unknown) => ({
      success: true as const,
      data: payload as Record<string, unknown>,
    }),
  },
}));

import { BookingActionError } from '@/lib/booking/service';
import { POST } from './create';

function requestCtx(body: Record<string, unknown>, headers?: Record<string, string>) {
  return {
    params: { shopId: 'shop_1' },
    request: new Request('https://kersivo.co.uk/api/public/bookings/shop_1/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      },
      body: JSON.stringify(body),
    }),
  };
}

const bookingBody = {
  serviceId: 'svc_1',
  barberId: 'barber_1',
  fullName: 'Client',
  email: 'client@example.com',
  startAt: '2026-08-10T10:00:00.000Z',
  idempotencyKey: 'idem-key-abcdef12',
};

function pendingCreated(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date();
  return {
    id: 'book_1',
    status: BookingStatus.PENDING_PAYMENT,
    email: 'client@example.com',
    depositRequired: true,
    depositAmountPence: 500,
    bookingPaymentType: 'DEPOSIT',
    paymentAmountPence: 500,
    kersivoPlatformFeeBps: 0,
    kersivoPlatformFeePence: 0,
    stripeConnectAccountIdAtPayment: 'acct_shop',
    shopName: 'Test Shop',
    stripeCheckoutSessionId: null,
    replayed: false,
    service: { name: 'Fade' },
    barber: { name: 'Alex' },
    serviceNameAtBooking: 'Fade',
    startAt: new Date(),
    createdAt,
    paymentExpiresAt: new Date(createdAt.getTime() + 15 * 60 * 1000),
    ...overrides,
  };
}

describe('public booking create — booking payment checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueShop.mockResolvedValue({
      id: 'shop_1',
      name: 'Test Shop',
      shopPaidAt: new Date(),
      smsRemindersEnabled: true,
      depositsEnabled: true,
      stripeConnectAccountId: 'acct_shop',
      stripeConnectChargesEnabled: true,
      publicActivityPaused: false,
    });
    shopAcceptsPublicBookings.mockResolvedValue(true);
    checkBookingRateLimit.mockResolvedValue({ ok: true });
    updateBooking.mockResolvedValue({});
    createBookingPaymentCheckoutSession.mockResolvedValue({
      id: 'cs_new',
      url: 'https://checkout.stripe.test/cs_new',
    });
  });

  it('reuses an open Checkout Session on retry instead of creating another', async () => {
    createInstantBooking.mockResolvedValue(
      pendingCreated({ stripeCheckoutSessionId: 'cs_existing', replayed: true }),
    );
    retrieveBookingDepositSession.mockResolvedValue({
      id: 'cs_existing',
      status: 'open',
      url: 'https://checkout.stripe.test/cs_existing',
      amount_total: 500,
      currency: 'gbp',
    });

    const res = await POST(
      requestCtx(bookingBody, { 'Idempotency-Key': 'idem-key-abcdef12' }) as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.checkoutUrl).toBe('https://checkout.stripe.test/cs_existing');
    expect(retrieveBookingDepositSession).toHaveBeenCalledWith('cs_existing', 'acct_shop');
    expect(createBookingPaymentCheckoutSession).not.toHaveBeenCalled();
    expect(createBookingDepositCheckoutSession).not.toHaveBeenCalled();
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it('creates a new generic session when the existing one is no longer open', async () => {
    createInstantBooking.mockResolvedValue(
      pendingCreated({ stripeCheckoutSessionId: 'cs_expired', replayed: true }),
    );
    retrieveBookingDepositSession.mockResolvedValue({
      id: 'cs_expired',
      status: 'expired',
      url: null,
      amount_total: 500,
      currency: 'gbp',
    });

    const res = await POST(requestCtx(bookingBody) as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.checkoutUrl).toBe('https://checkout.stripe.test/cs_new');
    expect(createBookingPaymentCheckoutSession).toHaveBeenCalledTimes(1);
    expect(createBookingDepositCheckoutSession).not.toHaveBeenCalled();
    expect(updateBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'book_1' },
        data: { stripeCheckoutSessionId: 'cs_new' },
      }),
    );
  });

  it('H0: new Starter booking snapshot (500p, 0% fee) reaches checkout with no KERSIVO application fee', async () => {
    createInstantBooking.mockResolvedValue(
      pendingCreated({ kersivoPlatformFeeBps: 0, kersivoPlatformFeePence: 0 }),
    );

    const res = await POST(requestCtx(bookingBody) as never);

    expect(res.status).toBe(200);
    expect(createBookingPaymentCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ paymentAmountPence: 500, applicationFeePence: 0 }),
    );
  });

  it('H: a historical 1% snapshot (500p, 5p fee) is still honoured as the application fee', async () => {
    createInstantBooking.mockResolvedValue(
      pendingCreated({ kersivoPlatformFeeBps: 100, kersivoPlatformFeePence: 5 }),
    );

    const res = await POST(requestCtx(bookingBody) as never);

    expect(res.status).toBe(200);
    expect(createBookingPaymentCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'book_1',
        shopId: 'shop_1',
        shopConnectAccountId: 'acct_shop',
        bookingPaymentType: 'DEPOSIT',
        paymentAmountPence: 500,
        applicationFeePence: 5,
      }),
    );
  });

  it('J: checkout uses the stored snapshot even if the shop is now on Full (no plan recompute)', async () => {
    // Shop has since upgraded (paid) — the stored Free snapshot must still be honoured.
    findUniqueShop.mockResolvedValue({
      id: 'shop_1',
      name: 'Test Shop',
      shopPaidAt: new Date(),
      smsRemindersEnabled: true,
      depositsEnabled: true,
      stripeConnectAccountId: 'acct_shop',
      stripeConnectChargesEnabled: true,
      publicActivityPaused: false,
    });
    createInstantBooking.mockResolvedValue(
      pendingCreated({
        replayed: true,
        paymentAmountPence: 300,
        depositAmountPence: 300,
        kersivoPlatformFeeBps: 100,
        kersivoPlatformFeePence: 3,
      }),
    );

    await POST(requestCtx(bookingBody) as never);

    expect(createBookingPaymentCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ paymentAmountPence: 300, applicationFeePence: 3 }),
    );
  });

  it('K: retries for the same booking send identical amount, fee and expiry anchor', async () => {
    const created = pendingCreated({ kersivoPlatformFeeBps: 100, kersivoPlatformFeePence: 5 });
    createInstantBooking.mockResolvedValue(created);

    await POST(requestCtx(bookingBody) as never);
    createInstantBooking.mockResolvedValue({ ...created, replayed: true });
    await POST(requestCtx(bookingBody) as never);

    expect(createBookingPaymentCheckoutSession).toHaveBeenCalledTimes(2);
    const [first, second] = createBookingPaymentCheckoutSession.mock.calls.map((call) => call[0]);
    for (const key of [
      'paymentAmountPence',
      'applicationFeePence',
      'bookingPaymentType',
      'bookingCreatedAt',
      'holdExpiresAt',
    ] as const) {
      expect(second[key]).toEqual(first[key]);
    }
  });

  it('pre-snapshot pending booking falls back to the legacy deposit amount with 0 fee', async () => {
    createInstantBooking.mockResolvedValue(
      pendingCreated({
        replayed: true,
        bookingPaymentType: null,
        paymentAmountPence: null,
        kersivoPlatformFeeBps: null,
        kersivoPlatformFeePence: null,
        stripeConnectAccountIdAtPayment: null,
      }),
    );

    await POST(requestCtx(bookingBody) as never);

    expect(createBookingPaymentCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ bookingPaymentType: 'DEPOSIT', paymentAmountPence: 500, applicationFeePence: 0 }),
    );
  });

  describe('payment account snapshot', () => {
    function shopNowOn(accountId: string) {
      findUniqueShop.mockResolvedValue({
        id: 'shop_1',
        name: 'Test Shop',
        shopPaidAt: null,
        smsRemindersEnabled: false,
        depositsEnabled: true,
        stripeConnectAccountId: accountId,
        stripeConnectChargesEnabled: true,
        publicActivityPaused: false,
      });
    }

    it('I: after the shop account changes, Checkout reuse + creation use the Booking snapshot', async () => {
      shopNowOn('acct_new');
      createInstantBooking.mockResolvedValue(
        pendingCreated({
          replayed: true,
          stripeCheckoutSessionId: 'cs_expired',
          stripeConnectAccountIdAtPayment: 'acct_original',
          kersivoPlatformFeeBps: 100,
          kersivoPlatformFeePence: 5,
        }),
      );
      retrieveBookingDepositSession.mockResolvedValue({ id: 'cs_expired', status: 'expired', url: null });

      const res = await POST(requestCtx(bookingBody) as never);

      expect(res.status).toBe(200);
      expect(retrieveBookingDepositSession).toHaveBeenCalledWith('cs_expired', 'acct_original');
      expect(createBookingPaymentCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ shopConnectAccountId: 'acct_original', applicationFeePence: 5 }),
      );
      expect(retrieveBookingDepositSession).not.toHaveBeenCalledWith(expect.anything(), 'acct_new');
    });

    it('a NEW paid booking without an account snapshot fails closed and alerts ops', async () => {
      createInstantBooking.mockResolvedValue(
        pendingCreated({ replayed: false, stripeConnectAccountIdAtPayment: null }),
      );

      const res = await POST(requestCtx(bookingBody) as never);

      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe('BOOKING_PAYMENT_NOT_READY');
      expect(createBookingPaymentCheckoutSession).not.toHaveBeenCalled();
      expect(captureOpsException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ opsAlert: true, tags: expect.objectContaining({ bookingId: 'book_1' }) }),
      );
    });

    it('a replayed fee-bearing booking without a snapshot never falls back to the shop account', async () => {
      createInstantBooking.mockResolvedValue(
        pendingCreated({
          replayed: true,
          stripeConnectAccountIdAtPayment: null,
          kersivoPlatformFeeBps: 100,
          kersivoPlatformFeePence: 5,
        }),
      );

      const res = await POST(requestCtx(bookingBody) as never);

      expect(res.status).toBe(503);
      expect(createBookingPaymentCheckoutSession).not.toHaveBeenCalled();
      expect(retrieveBookingDepositSession).not.toHaveBeenCalled();
    });

    it('Q: replayed legacy 0%-fee booking with null snapshot uses the current shop account', async () => {
      shopNowOn('acct_current');
      createInstantBooking.mockResolvedValue(
        pendingCreated({
          replayed: true,
          stripeCheckoutSessionId: 'cs_legacy',
          stripeConnectAccountIdAtPayment: null,
        }),
      );
      retrieveBookingDepositSession.mockResolvedValue({
        id: 'cs_legacy',
        status: 'open',
        url: 'https://checkout.stripe.test/cs_legacy',
      });

      const res = await POST(requestCtx(bookingBody) as never);

      expect(res.status).toBe(200);
      expect(retrieveBookingDepositSession).toHaveBeenCalledWith('cs_legacy', 'acct_current');
      expect(captureOpsException).not.toHaveBeenCalled();
    });
  });

  it('4C-F / G: FULL booking uses the generic Checkout with the FULL type, amount, fee and account snapshot', async () => {
    findUniqueShop.mockResolvedValue({
      id: 'shop_1',
      name: 'Test Shop',
      shopPaidAt: null,
      smsRemindersEnabled: false,
      depositsEnabled: false,
      stripeConnectAccountId: 'acct_now_different',
      stripeConnectChargesEnabled: true,
      publicActivityPaused: false,
    });
    createInstantBooking.mockResolvedValue(
      pendingCreated({
        depositAmountPence: null,
        bookingPaymentType: 'FULL',
        paymentAmountPence: 3000,
        kersivoPlatformFeeBps: 100,
        kersivoPlatformFeePence: 30,
        stripeConnectAccountIdAtPayment: 'acct_full_snapshot',
      }),
    );

    const res = await POST(requestCtx(bookingBody) as never);

    expect(res.status).toBe(200);
    expect(createBookingPaymentCheckoutSession).toHaveBeenCalledTimes(1);
    expect(createBookingPaymentCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'book_1',
        bookingPaymentType: 'FULL',
        paymentAmountPence: 3000,
        applicationFeePence: 30,
        shopConnectAccountId: 'acct_full_snapshot',
      }),
    );
    expect(createBookingDepositCheckoutSession).not.toHaveBeenCalled();
  });

  it('F: payments-not-ready error is returned with the stable code and no checkout', async () => {
    createInstantBooking.mockRejectedValue(
      new BookingActionError('not ready', 503, 'BOOKING_PAYMENT_NOT_READY'),
    );

    const res = await POST(requestCtx(bookingBody) as never);

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('BOOKING_PAYMENT_NOT_READY');
    expect(createBookingPaymentCheckoutSession).not.toHaveBeenCalled();
  });

  it('Leave wins the shop lock: in-transaction refusal → no booking and no Stripe checkout', async () => {
    createInstantBooking.mockRejectedValue(
      new BookingActionError('no longer taking bookings', 403, 'SHOP_NOT_ACCEPTING_NEW_BOOKINGS'),
    );

    const res = await POST(requestCtx(bookingBody) as never);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('SHOP_NOT_ACCEPTING_NEW_BOOKINGS');
    expect(createInstantBooking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requiredCapability: 'PUBLIC_BOOKING' }),
    );
    expect(createBookingPaymentCheckoutSession).not.toHaveBeenCalled();
    expect(createBookingDepositCheckoutSession).not.toHaveBeenCalled();
  });
});
