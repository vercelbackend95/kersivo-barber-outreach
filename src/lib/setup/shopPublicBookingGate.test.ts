import { beforeEach, describe, expect, it, vi } from 'vitest';

const { shopFindUnique, subscriptionFindFirst } = vi.hoisted(() => ({
  shopFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...a: unknown[]) => shopFindUnique(...a) },
    saasSubscription: { findFirst: (...a: unknown[]) => subscriptionFindFirst(...a) },
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
    ...overrides,
  };
}

describe('shopAcceptsPublicBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionFindFirst.mockResolvedValue(null);
  });

  it('denies SETUP shops (onboarding state is not an entitlement)', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ onboardingCompleted: true }));
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
  });

  it('allows FREE_BOOKING shops', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ freeBookingActivatedAt: new Date() }));
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(true);
  });

  it('allows FULL_KERSIVO shops via subscription or legacy paid fallback', async () => {
    shopFindUnique.mockResolvedValue(shopRow());
    subscriptionFindFirst.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: farFuture });
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(true);

    subscriptionFindFirst.mockResolvedValue(null);
    shopFindUnique.mockResolvedValue(shopRow({ shopPaidAt: new Date() }));
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(true);
  });

  it('allows PAST_DUE within grace and denies after grace without a free marker', async () => {
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

  it('denies a departed Starter shop (wind-down or retention) despite its activation marker', async () => {
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
      shopRow({ id: where.id, shopPaidAt: new Date(), freeBookingActivatedAt: new Date() }),
    );
    subscriptionFindFirst.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: farFuture });
    expect(await shopAcceptsPublicBookings(DEMO_SHOP_ID)).toBe(false);
    expect(await shopAcceptsPublicBookings(BLACKLINE_SHOP_ID)).toBe(false);
  });
});
