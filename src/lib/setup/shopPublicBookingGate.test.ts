import { beforeEach, describe, expect, it, vi } from 'vitest';

const { shopFindUnique, subscriptionFindFirst, serviceFindMany } = vi.hoisted(() => ({
  shopFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  serviceFindMany: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...a: unknown[]) => shopFindUnique(...a) },
    saasSubscription: { findFirst: (...a: unknown[]) => subscriptionFindFirst(...a) },
    service: { findMany: (...a: unknown[]) => serviceFindMany(...a) },
  },
}));

import { BLACKLINE_SHOP_ID } from '@/lib/demo/products';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { loadPublicBookingIntakeStatus, shopAcceptsPublicBookings } from './shopPublicBookingGate';

const farFuture = new Date('2999-01-01T00:00:00.000Z');

function shopRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shop_1',
    shopPaidAt: null,
    smsRemindersEnabled: false,
    freeBookingActivatedAt: null,
    stripeConnectAccountId: 'acct_ready',
    stripeConnectChargesEnabled: true,
    stripeConnectDisconnectedAt: null,
    stripeConnectAccountType: 'STANDARD',
    ...overrides,
  };
}

function starterServices(options: { active?: boolean; underpriced?: boolean } = {}) {
  const active = options.active ?? true;
  const underpriced = options.underpriced ?? false;
  serviceFindMany.mockImplementation(async () => {
    if (!active) return [];
    const services = [{ id: 'svc_1', name: 'Skin Fade', pricePence: 2500, isActive: true }];
    if (underpriced) services.push({ id: 'svc_low', name: 'Line-up', pricePence: 300, isActive: true });
    return services;
  });
}

describe('shopAcceptsPublicBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionFindFirst.mockResolvedValue(null);
    starterServices();
  });

  it('denies SETUP shops (onboarding state is not an entitlement)', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ onboardingCompleted: true }));
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
  });

  it('allows Starter only when Stripe is ready and active services satisfy the £5 floor', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ freeBookingActivatedAt: new Date() }));
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(true);
  });

  it('denies Starter when Stripe is missing or not payment-ready', async () => {
    shopFindUnique.mockResolvedValue(
      shopRow({ freeBookingActivatedAt: new Date(), stripeConnectAccountId: null }),
    );
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);

    shopFindUnique.mockResolvedValue(
      shopRow({ freeBookingActivatedAt: new Date(), stripeConnectChargesEnabled: false }),
    );
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
  });

  it('denies Starter after an explicit Stripe disconnect even if chargesEnabled is stale true', async () => {
    shopFindUnique.mockResolvedValue(
      shopRow({
        freeBookingActivatedAt: new Date(),
        stripeConnectDisconnectedAt: new Date(),
        stripeConnectChargesEnabled: true,
      }),
    );
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
  });

  it('denies Starter with no active service or any active service below £5', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ freeBookingActivatedAt: new Date() }));

    starterServices({ active: false });
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);

    starterServices({ underpriced: true });
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
  });

  it('allows FULL_KERSIVO via subscription or legacy paid fallback without applying Starter readiness rules', async () => {
    shopFindUnique.mockResolvedValue(
      shopRow({ stripeConnectAccountId: null, stripeConnectChargesEnabled: false }),
    );
    subscriptionFindFirst.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: farFuture });
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(true);

    subscriptionFindFirst.mockResolvedValue(null);
    shopFindUnique.mockResolvedValue(
      shopRow({ shopPaidAt: new Date(), stripeConnectAccountId: null, stripeConnectChargesEnabled: false }),
    );
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(true);
  });

  it('Full KERSIVO on a legacy Express account keeps accepting public bookings (unchanged)', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ stripeConnectAccountType: 'EXPRESS' }));
    subscriptionFindFirst.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: farFuture });
    expect(await loadPublicBookingIntakeStatus('shop_1')).toMatchObject({ accepting: true, reason: 'ok' });
  });

  it('allows PAST_DUE within grace and denies after grace without a Starter choice', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ shopPaidAt: new Date() }));
    subscriptionFindFirst.mockResolvedValue({
      status: 'PAST_DUE',
      currentPeriodEnd: farFuture,
      pastDueSince: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(true);

    subscriptionFindFirst.mockResolvedValue({
      status: 'PAST_DUE',
      currentPeriodEnd: farFuture,
      pastDueSince: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
  });

  it('denies a departed Starter shop despite its activation marker', async () => {
    for (const status of ['WINDING_DOWN', 'RETENTION']) {
      shopFindUnique.mockResolvedValue(
        shopRow({ freeBookingActivatedAt: new Date(), departure: { status } }),
      );
      expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
    }
  });

  it('denies missing shops', async () => {
    shopFindUnique.mockResolvedValue(null);
    expect(await shopAcceptsPublicBookings('nope')).toBe(false);
  });

  describe('Full → Starter effective downgrade (postFullPlan = STARTER, Full ended)', () => {
    const endedFullWithStarter = {
      status: 'CANCELED',
      currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      postFullPlan: 'STARTER',
    };

    beforeEach(() => {
      subscriptionFindFirst.mockResolvedValue(endedFullWithStarter);
    });

    it('goes live when Stripe is ready and every active service is at least £5', async () => {
      shopFindUnique.mockResolvedValue(shopRow());
      expect(await loadPublicBookingIntakeStatus('shop_1')).toMatchObject({
        accepting: true,
        reason: 'ok',
      });
    });

    it('pauses intake for a service below £5 but keeps Starter entitlement and names the blocker', async () => {
      shopFindUnique.mockResolvedValue(shopRow());
      starterServices({ underpriced: true });
      const status = await loadPublicBookingIntakeStatus('shop_1');
      expect(status.accepting).toBe(false);
      expect(status.reason).toBe('service_below_minimum');
      expect(status.starterReadiness?.servicesBelowMinimum).toEqual([
        { id: 'svc_low', name: 'Line-up', pricePence: 300 },
      ]);
      expect(status.reason).not.toBe('no_public_booking_entitlement');
    });

    it.each([
      ['Stripe missing', { stripeConnectAccountId: null, stripeConnectChargesEnabled: false }, 'connect_missing'],
      ['Stripe disconnected', { stripeConnectDisconnectedAt: new Date(), stripeConnectChargesEnabled: true }, 'connect_disconnected'],
      ['charges disabled', { stripeConnectChargesEnabled: false }, 'connect_not_ready'],
    ])('pauses intake (never Pay at shop) when %s', async (_label, overrides, blocker) => {
      shopFindUnique.mockResolvedValue(shopRow(overrides));
      const status = await loadPublicBookingIntakeStatus('shop_1');
      expect(status).toMatchObject({ accepting: false, reason: 'stripe_not_ready' });
      expect(status.starterReadiness?.stripe.blocker).toBe(blocker);
    });

    it('pauses intake for a legacy Express account even with stale chargesEnabled=true', async () => {
      shopFindUnique.mockResolvedValue(
        shopRow({ stripeConnectAccountType: 'EXPRESS', stripeConnectChargesEnabled: true }),
      );
      const status = await loadPublicBookingIntakeStatus('shop_1');
      expect(status).toMatchObject({ accepting: false, reason: 'stripe_not_ready' });
      expect(status.starterReadiness?.stripe.blocker).toBe('connect_requires_standard');
    });

    it('recovers after Stripe reconnect without any shop or slug change', async () => {
      shopFindUnique.mockResolvedValue(shopRow({ stripeConnectDisconnectedAt: new Date() }));
      expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);

      shopFindUnique.mockResolvedValue(shopRow({ stripeConnectAccountId: 'acct_standard_new' }));
      expect(await shopAcceptsPublicBookings('shop_1')).toBe(true);
    });

    it('only reads services (never writes them) while evaluating readiness', async () => {
      shopFindUnique.mockResolvedValue(shopRow());
      starterServices({ underpriced: true });
      await loadPublicBookingIntakeStatus('shop_1');
      expect(serviceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shopId: 'shop_1', isActive: true } }),
      );
    });
  });

  it('reports no entitlement (not a Starter pause) for SETUP / LEAVE shops', async () => {
    shopFindUnique.mockResolvedValue(shopRow());
    subscriptionFindFirst.mockResolvedValue({
      status: 'CANCELED',
      currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
      postFullPlan: 'LEAVE',
    });
    expect(await loadPublicBookingIntakeStatus('shop_1')).toMatchObject({
      accepting: false,
      reason: 'no_public_booking_entitlement',
    });
  });

  it('denies demo shops even with markers populated', async () => {
    shopFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      shopRow({
        id: where.id,
        shopPaidAt: new Date(),
        freeBookingActivatedAt: new Date(),
      }),
    );
    subscriptionFindFirst.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: farFuture });
    expect(await shopAcceptsPublicBookings(DEMO_SHOP_ID)).toBe(false);
    expect(await shopAcceptsPublicBookings(BLACKLINE_SHOP_ID)).toBe(false);
  });
});
