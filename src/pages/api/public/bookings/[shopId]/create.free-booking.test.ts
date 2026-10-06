import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

const { db, createInstantBooking, createBookingDepositCheckoutSession } = vi.hoisted(() => ({
  db: {
    shop: null as null | Record<string, unknown>,
    subscription: null as null | Record<string, unknown>,
    services: [] as Array<Record<string, unknown>>,
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
    service: {
      findMany: async () => db.services,
    },
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
    stripeConnectAccountId: 'acct_ready',
    stripeConnectChargesEnabled: true,
    stripeConnectAccountType: 'STANDARD',
    publicActivityPaused: false,
    ...overrides,
  };
}

function post(overrides: Record<string, unknown> = {}) {
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
        paymentChoice: 'DEPOSIT',
        ...overrides,
      }),
    }),
  } as never);
}

const endedFullWithStarter = {
  status: 'CANCELED',
  currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
  postFullPlan: 'STARTER',
  postFullTermsVersion: 'LEGACY_EFFECTIVE_PRE_V119',
};

describe('public booking create — Free Booking shop (real entitlement gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.shop = freeShop();
    db.subscription = null;
    db.services = [{ id: 'svc_1', name: 'Haircut', pricePence: 2500, isActive: true }];
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

  it('passes an activated, Stripe-ready Starter booking request through to booking creation', async () => {
    const res = await post();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking).toMatchObject({ id: 'book_1', depositRequired: false, barberName: 'Sam' });
    expect(createInstantBooking).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 'svc_1', barberId: 'barber_1', paymentChoice: 'DEPOSIT' }),
      expect.objectContaining({ requiredShopId: 'shop_free' }),
    );
    expect(createBookingDepositCheckoutSession).not.toHaveBeenCalled();
  });

  it('rejects Starter public booking before Stripe is ready', async () => {
    db.shop = freeShop({ stripeConnectAccountId: null, stripeConnectChargesEnabled: false });
    const res = await post();

    expect(res.status).toBe(403);
    expect(createInstantBooking).not.toHaveBeenCalled();
  });

  describe('after Full → Starter becomes effective (crafted API calls cannot bypass readiness)', () => {
    beforeEach(() => {
      db.shop = freeShop({ freeBookingActivatedAt: null, shopPaidAt: null });
      db.subscription = endedFullWithStarter;
    });

    it('accepts new public bookings once Stripe is ready and all services are at least £5', async () => {
      const res = await post();
      expect(res.status).toBe(200);
      expect(createInstantBooking).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ allowDepositCollection: true, requiredCapability: 'PUBLIC_BOOKING' }),
      );
    });

    it('refuses intake while any active service is below £5, even for a different, valid service', async () => {
      db.services = [
        { id: 'svc_1', name: 'Haircut', pricePence: 2500, isActive: true },
        { id: 'svc_low', name: 'Line-up', pricePence: 300, isActive: true },
      ];
      const res = await post({ serviceId: 'svc_1' });
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('Online booking is not available for this shop.');
      expect(createInstantBooking).not.toHaveBeenCalled();
    });

    it.each([
      ['legacy Express (charges enabled)', { stripeConnectAccountType: 'EXPRESS', stripeConnectChargesEnabled: true }],
      ['of unknown type', { stripeConnectAccountType: null }],
      ['missing', { stripeConnectAccountId: null, stripeConnectChargesEnabled: false }],
      ['disconnected', { stripeConnectDisconnectedAt: new Date(), stripeConnectChargesEnabled: true }],
      ['charges disabled', { stripeConnectChargesEnabled: false }],
    ])('refuses intake with Stripe %s — no Pay-at-shop fallback, even if requested', async (_l, overrides) => {
      db.shop = { ...db.shop, ...overrides };
      const res = await post({ paymentChoice: 'NONE' });
      expect(res.status).toBe(403);
      expect(createInstantBooking).not.toHaveBeenCalled();
    });
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
