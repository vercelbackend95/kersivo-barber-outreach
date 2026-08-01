import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

const createInstantBooking = vi.fn();
const createBookingDepositCheckoutSession = vi.fn();
const retrieveBookingDepositSession = vi.fn();
const updateBooking = vi.fn();
const findUniqueShop = vi.fn();
const shopAcceptsPublicBookings = vi.fn();
const checkBookingRateLimit = vi.fn();

vi.mock('@/lib/booking/service', () => ({
  BookingActionError: class BookingActionError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  createInstantBooking: (...args: unknown[]) => createInstantBooking(...args),
}));

vi.mock('@/lib/shop/stripeConnect', () => ({
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

describe('public booking create — deposit checkout reuse', () => {
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
  });

  it('reuses an open Checkout Session on retry instead of creating another', async () => {
    createInstantBooking.mockResolvedValue({
      id: 'book_1',
      status: BookingStatus.PENDING_PAYMENT,
      email: 'client@example.com',
      depositRequired: true,
      depositAmountPence: 500,
      shopName: 'Test Shop',
      stripeCheckoutSessionId: 'cs_existing',
      replayed: true,
      service: { name: 'Fade' },
      barber: { name: 'Alex' },
      serviceNameAtBooking: 'Fade',
      startAt: new Date(),
    });
    retrieveBookingDepositSession.mockResolvedValue({
      id: 'cs_existing',
      status: 'open',
      url: 'https://checkout.stripe.test/cs_existing',
      amount_total: 500,
      currency: 'gbp',
    });

    const res = await POST(
      requestCtx(
        {
          serviceId: 'svc_1',
          barberId: 'barber_1',
          fullName: 'Client',
          email: 'client@example.com',
          startAt: '2026-08-10T10:00:00.000Z',
          idempotencyKey: 'idem-key-12345678',
        },
        { 'Idempotency-Key': 'idem-key-12345678' },
      ) as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.checkoutUrl).toBe('https://checkout.stripe.test/cs_existing');
    expect(retrieveBookingDepositSession).toHaveBeenCalledWith('cs_existing', 'acct_shop');
    expect(createBookingDepositCheckoutSession).not.toHaveBeenCalled();
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it('creates a new session when the existing one is no longer open', async () => {
    const createdAt = new Date();
    createInstantBooking.mockResolvedValue({
      id: 'book_1',
      status: BookingStatus.PENDING_PAYMENT,
      email: 'client@example.com',
      depositRequired: true,
      depositAmountPence: 500,
      shopName: 'Test Shop',
      stripeCheckoutSessionId: 'cs_expired',
      replayed: true,
      service: { name: 'Fade' },
      barber: { name: 'Alex' },
      serviceNameAtBooking: 'Fade',
      startAt: new Date(),
      createdAt,
      paymentExpiresAt: new Date(createdAt.getTime() + 15 * 60 * 1000),
    });
    retrieveBookingDepositSession.mockResolvedValue({
      id: 'cs_expired',
      status: 'expired',
      url: null,
      amount_total: 500,
      currency: 'gbp',
    });
    createBookingDepositCheckoutSession.mockResolvedValue({
      id: 'cs_new',
      url: 'https://checkout.stripe.test/cs_new',
    });

    const res = await POST(
      requestCtx({
        serviceId: 'svc_1',
        barberId: 'barber_1',
        fullName: 'Client',
        email: 'client@example.com',
        startAt: '2026-08-10T10:00:00.000Z',
        idempotencyKey: 'idem-key-abcdef12',
      }) as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.checkoutUrl).toBe('https://checkout.stripe.test/cs_new');
    expect(createBookingDepositCheckoutSession).toHaveBeenCalledTimes(1);
    expect(updateBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'book_1' },
        data: { stripeCheckoutSessionId: 'cs_new' },
      }),
    );
  });
});
