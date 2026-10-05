import { beforeEach, describe, expect, it, vi } from 'vitest';

const { shopFindUnique, subscriptionFindFirst, serviceFindFirst } = vi.hoisted(() => ({
  shopFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  serviceFindFirst: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...a: unknown[]) => shopFindUnique(...a) },
    saasSubscription: { findFirst: (...a: unknown[]) => subscriptionFindFirst(...a) },
    service: { findFirst: (...a: unknown[]) => serviceFindFirst(...a) },
  },
}));

import { BLACKLINE_SHOP_ID } from '@/lib/demo/products';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { shopAcceptsPublicBookings } from './shopPublicBookingGate';

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
    ...overrides,
  };
}

function starterServices(options: { active?: boolean; underpriced?: boolean } = {}) {
  const active = options.active ?? true;
  const underpriced = options.underpriced ?? false;
  serviceFindFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    if (!active) return null;
    if ('pricePence' in where) return underpriced ? { id: 'svc_low' } : null;
    return { id: 'svc_1' };
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
