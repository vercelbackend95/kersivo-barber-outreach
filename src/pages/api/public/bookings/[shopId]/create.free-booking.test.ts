import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

const { db, createInstantBooking, createBookingDepositCheckoutSession } = vi.hoisted(() => ({
  db: {
    shop: null as null | Record<string, unknown>,
    subscription: null as null | Record<string, unknown>,
  },
  createInstantBooking: vi.fn(),
  createBookingDepositCheckoutSession: vi.fn(),
}));

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
  retrieveBookingDepositSession: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        db.shop && db.shop.id === where.id ? { ...db.shop } : null,
    },
    saasSubscription: { findFirst: async () => db.subscription },
    booking: { update: vi.fn() },
  },
}));

vi.mock('@/lib/rate-limit/bookingRateLimit', () => ({
  checkBookingRateLimit: async () => ({ ok: true }),
}));

vi.mock('@/lib/booking/schemas', () => ({
  bookingCreateSchema: {
    safeParse: (payload: unknown) => ({ success: true as const, data: payload as Record<string, unknown> }),
  },
}));

import { canCollectBookingDeposit } from '@/lib/booking/depositGate';
import { POST } from './create';

function freeShop(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shop_free',
    name: 'Fade Lab',
    shopPaidAt: null,
    smsRemindersEnabled: false,
    freeBookingActivatedAt: new Date('2026-10-04T09:00:00.000Z'),
    depositsEnabled: false,
    stripeConnectAccountId: null,
    stripeConnectChargesEnabled: false,
    publicActivityPaused: false,
    ...overrides,
  };
}

function post() {
  return POST({
    params: { shopId: 'shop_free' },
    request: new Request('https://kersivo.co.uk/api/public/bookings/shop_free/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: 'svc_1',
        barberId: 'barber_1',
        fullName: 'Client',
        email: 'client@example.com',
        startAt: '2026-10-10T10:00:00.000Z',
      }),
    }),
  } as never);
}

describe('public booking create — Free Booking shop (real entitlement gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.shop = freeShop();
    db.subscription = null;
    createInstantBooking.mockResolvedValue({
      id: 'book_1',
      status: BookingStatus.BOOKED,
      email: 'client@example.com',
      depositRequired: false,
      depositAmountPence: null,
      replayed: false,
      service: { name: 'Haircut' },
      barber: { name: 'Sam' },
      serviceNameAtBooking: 'Haircut',
      startAt: new Date('2026-10-10T10:00:00.000Z'),
    });
  });

  it('creates a pay-at-shop booking for an activated Free shop', async () => {
    const res = await post();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking).toMatchObject({ id: 'book_1', depositRequired: false, barberName: 'Sam' });
    expect(createInstantBooking).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 'svc_1', barberId: 'barber_1' }),
      expect.objectContaining({ requiredShopId: 'shop_free' }),
    );
    expect(createBookingDepositCheckoutSession).not.toHaveBeenCalled();
  });

  it('rejects an unactivated SETUP shop even when onboarding is complete', async () => {
    db.shop = freeShop({ freeBookingActivatedAt: null, onboardingCompleted: true });
    const res = await post();

    expect(res.status).toBe(403);
    expect(createInstantBooking).not.toHaveBeenCalled();
  });

  it('keeps Stripe deposits Paid-only: stale deposit settings on a Free shop do not enable deposits', () => {
    expect(
      canCollectBookingDeposit(
        freeShop({
          depositsEnabled: true,
          stripeConnectAccountId: 'acct_free',
          stripeConnectChargesEnabled: true,
        }) as never,
      ),
    ).toBe(false);
  });
});
