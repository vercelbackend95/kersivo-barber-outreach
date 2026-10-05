import { beforeEach, describe, expect, it, vi } from 'vitest';

const { shopFindUnique, subscriptionFindFirst } = vi.hoisted(() => ({
  shopFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
}));

vi.mock('../db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...a: unknown[]) => shopFindUnique(...a) },
    saasSubscription: { findFirst: (...a: unknown[]) => subscriptionFindFirst(...a) },
  },
}));

import { BLACKLINE_SHOP_ID } from '../demo/products';
import { DEMO_SHOP_ID } from '../db/shopScope';
import {
  KERSIVO_CAPABILITIES,
  PRODUCT_STATE_CAPABILITIES,
  hasKersivoCapability,
  loadKersivoAccess,
  resolveKersivoAccess,
  resolveKersivoProductState,
  serializeKersivoAccess,
  type KersivoAccessShopFields,
} from './kersivoAccess';

const now = new Date('2026-07-15T12:00:00.000Z');
const activatedAt = new Date('2026-07-01T00:00:00.000Z');

const activeSub = { status: 'ACTIVE', currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z') };
const graceSub = {
  status: 'PAST_DUE',
  currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
  pastDueSince: new Date('2026-07-14T12:00:00.000Z'),
};
const expiredGraceSub = {
  status: 'PAST_DUE',
  currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
  pastDueSince: new Date('2026-07-01T12:00:00.000Z'),
};
const suspendedSub = { status: 'SUSPENDED', currentPeriodEnd: null };
const canceledSub = { status: 'CANCELED', currentPeriodEnd: null };

function shop(overrides: Partial<KersivoAccessShopFields> = {}): KersivoAccessShopFields {
  return {
    id: 'shop_1',
    shopPaidAt: null,
    smsRemindersEnabled: false,
    freeBookingActivatedAt: null,
    ...overrides,
  };
}

describe('resolveKersivoProductState', () => {
  it('A: no paid entitlement + no free marker => SETUP', () => {
    expect(resolveKersivoProductState(shop(), null, now)).toBe('SETUP');
  });

  it('B: free marker + no paid entitlement => FREE_BOOKING', () => {
    expect(
      resolveKersivoProductState(shop({ freeBookingActivatedAt: activatedAt }), null, now),
    ).toBe('FREE_BOOKING');
  });

  it('C: active paid entitlement + no free marker => FULL_KERSIVO', () => {
    expect(resolveKersivoProductState(shop(), activeSub, now)).toBe('FULL_KERSIVO');
    expect(resolveKersivoProductState(shop(), graceSub, now)).toBe('FULL_KERSIVO');
  });

  it('C: legacy paid fallback (no subscription row) => FULL_KERSIVO', () => {
    expect(resolveKersivoProductState(shop({ shopPaidAt: activatedAt }), null, now)).toBe(
      'FULL_KERSIVO',
    );
    expect(resolveKersivoProductState(shop({ smsRemindersEnabled: true }), null, now)).toBe(
      'FULL_KERSIVO',
    );
  });

  it('D: active paid entitlement + free marker => FULL_KERSIVO', () => {
    expect(
      resolveKersivoProductState(shop({ freeBookingActivatedAt: activatedAt }), activeSub, now),
    ).toBe('FULL_KERSIVO');
  });

  it('E: Full ended + legacy Starter marker but no explicit choice => SETUP (no silent fallback)', () => {
    const formerStarter = shop({ freeBookingActivatedAt: activatedAt, shopPaidAt: activatedAt });
    for (const sub of [expiredGraceSub, suspendedSub, canceledSub]) {
      for (const postFullPlan of [undefined, null, 'UNDECIDED', 'CHOICE_REQUIRED', 'LEAVE']) {
        expect(
          resolveKersivoProductState(formerStarter, { ...sub, postFullPlan }, now),
          `${sub.status} / ${String(postFullPlan)}`,
        ).toBe('SETUP');
      }
    }
  });

  it('E2: Full ended + explicit Starter choice => FREE_BOOKING (with or without the legacy marker)', () => {
    for (const s of [shop(), shop({ freeBookingActivatedAt: activatedAt, shopPaidAt: activatedAt })]) {
      for (const sub of [expiredGraceSub, suspendedSub, canceledSub]) {
        expect(resolveKersivoProductState(s, { ...sub, postFullPlan: 'STARTER' }, now)).toBe(
          'FREE_BOOKING',
        );
      }
    }
  });

  it('E3: active Full always wins over a recorded post-Full choice', () => {
    const formerStarter = shop({ freeBookingActivatedAt: activatedAt });
    for (const postFullPlan of ['STARTER', 'LEAVE', 'CHOICE_REQUIRED']) {
      expect(resolveKersivoProductState(formerStarter, { ...activeSub, postFullPlan }, now)).toBe(
        'FULL_KERSIVO',
      );
      expect(resolveKersivoProductState(formerStarter, { ...graceSub, postFullPlan }, now)).toBe(
        'FULL_KERSIVO',
      );
    }
  });

  it('E4: PENDING checkout rows are ignored, so initial Starter shops stay Starter', () => {
    const starter = shop({ freeBookingActivatedAt: activatedAt });
    const pending = { status: 'PENDING', currentPeriodEnd: null, postFullPlan: 'UNDECIDED' };
    expect(resolveKersivoProductState(starter, pending, now)).toBe('FREE_BOOKING');
    expect(resolveKersivoProductState(shop(), pending, now)).toBe('SETUP');
  });

  it('F: paid entitlement lapsed + no free marker => SETUP', () => {
    const lapsedShop = shop({ shopPaidAt: activatedAt, smsRemindersEnabled: true });
    for (const sub of [expiredGraceSub, suspendedSub, canceledSub]) {
      expect(resolveKersivoProductState(lapsedShop, sub, now)).toBe('SETUP');
    }
  });

  it('G: demo shops never resolve to Full/Free even with markers populated', () => {
    for (const id of [DEMO_SHOP_ID, BLACKLINE_SHOP_ID]) {
      const demo = shop({
        id,
        shopPaidAt: activatedAt,
        smsRemindersEnabled: true,
        freeBookingActivatedAt: activatedAt,
      });
      expect(resolveKersivoProductState(demo, activeSub, now)).toBe('SETUP');
      expect(resolveKersivoProductState(demo, null, now)).toBe('SETUP');
      expect(resolveKersivoAccess(demo, activeSub, now).capabilities).toEqual([]);
    }
  });
});

describe('capability matrix', () => {
  it('H: matches the approved V1 matrix exactly', () => {
    const free = [
      'BOOKING_CORE',
      'PUBLIC_BOOKING',
      'BOOKING_PAYMENTS',
      'TEAM',
      'SERVICES',
      'AUTOMATED_EMAIL_REMINDERS',
      'RECENT_BOOKING_HISTORY',
      'CLIENTS_CORE',
    ];
    const fullOnly = [
      'REPORTS',
      'CLIENTS',
      'FULL_BOOKING_HISTORY',
      'RETAIL',
      'ASSISTANT',
      'SMS_REMINDERS',
      'BRANDED_SITE',
      'MANUAL_BOOKINGS',
    ];
    expect([...PRODUCT_STATE_CAPABILITIES.SETUP]).toEqual([]);
    expect([...PRODUCT_STATE_CAPABILITIES.FREE_BOOKING].sort()).toEqual([...free].sort());
    expect([...PRODUCT_STATE_CAPABILITIES.FULL_KERSIVO].sort()).toEqual(
      [...free, ...fullOnly].sort(),
    );
    expect([...KERSIVO_CAPABILITIES].sort()).toEqual([...free, ...fullOnly].sort());
  });

  it('hasKersivoCapability follows the resolved state', () => {
    const freeAccess = resolveKersivoAccess(shop({ freeBookingActivatedAt: activatedAt }), null, now);
    expect(hasKersivoCapability(freeAccess, 'PUBLIC_BOOKING')).toBe(true);
    expect(hasKersivoCapability(freeAccess, 'RETAIL')).toBe(false);
    expect(hasKersivoCapability(freeAccess, 'REPORTS')).toBe(false);
  });

  it('serializes all capabilities as booleans', () => {
    const serialized = serializeKersivoAccess(
      resolveKersivoAccess(shop({ freeBookingActivatedAt: activatedAt }), null, now),
    );
    expect(serialized).toEqual({
      state: 'FREE_BOOKING',
      capabilities: {
        bookingCore: true,
        publicBooking: true,
        bookingPayments: true,
        team: true,
        services: true,
        reports: false,
        clientsCore: true,
        clients: false,
        recentBookingHistory: true,
        fullBookingHistory: false,
        retail: false,
        assistant: false,
        smsReminders: false,
        automatedEmailReminders: true,
        brandedSite: false,
        manualBookings: false,
      },
    });
    const full = serializeKersivoAccess(resolveKersivoAccess(shop(), activeSub, now));
    expect(Object.values(full.capabilities).every(Boolean)).toBe(true);
    const setup = serializeKersivoAccess(resolveKersivoAccess(shop(), null, now));
    expect(Object.values(setup.capabilities).some(Boolean)).toBe(false);
  });
});

describe('loadKersivoAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionFindFirst.mockResolvedValue(null);
  });

  it('loads entitlement fields and latest non-PENDING subscription', async () => {
    shopFindUnique.mockResolvedValue(shop({ freeBookingActivatedAt: activatedAt }));
    subscriptionFindFirst.mockResolvedValue(activeSub);
    const access = await loadKersivoAccess(' shop_1 ', now);
    expect(access.state).toBe('FULL_KERSIVO');
    expect(shopFindUnique).toHaveBeenCalledWith({
      where: { id: 'shop_1' },
      select: {
        id: true,
        shopPaidAt: true,
        smsRemindersEnabled: true,
        freeBookingActivatedAt: true,
      },
    });
    expect(subscriptionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: 'shop_1', status: { not: 'PENDING' } },
        orderBy: { createdAt: 'desc' },
        select: expect.objectContaining({ postFullPlan: true }),
      }),
    );
  });

  it('does not fall back to the Starter marker once Full ends without an explicit choice', async () => {
    shopFindUnique.mockResolvedValue(
      shop({ freeBookingActivatedAt: activatedAt, shopPaidAt: activatedAt }),
    );
    subscriptionFindFirst.mockResolvedValue({ ...canceledSub, postFullPlan: 'CHOICE_REQUIRED' });
    expect((await loadKersivoAccess('shop_1', now)).state).toBe('SETUP');

    subscriptionFindFirst.mockResolvedValue({ ...canceledSub, postFullPlan: 'STARTER' });
    expect((await loadKersivoAccess('shop_1', now)).state).toBe('FREE_BOOKING');
  });

  it('reads through a provided transaction client instead of the global client', async () => {
    const txShopFindUnique = vi.fn().mockResolvedValue(shop({ freeBookingActivatedAt: activatedAt }));
    const txSubscriptionFindFirst = vi.fn().mockResolvedValue(null);
    const tx = {
      shopSettings: { findUnique: txShopFindUnique },
      saasSubscription: { findFirst: txSubscriptionFindFirst },
    };

    const access = await loadKersivoAccess('shop_1', now, tx as never);

    expect(access.state).toBe('FREE_BOOKING');
    expect(txShopFindUnique).toHaveBeenCalledTimes(1);
    expect(txSubscriptionFindFirst).toHaveBeenCalledTimes(1);
    expect(shopFindUnique).not.toHaveBeenCalled();
    expect(subscriptionFindFirst).not.toHaveBeenCalled();
  });

  it('resolves missing, empty and demo shops to SETUP without querying', async () => {
    shopFindUnique.mockResolvedValue(null);
    expect((await loadKersivoAccess('missing', now)).state).toBe('SETUP');
    expect(subscriptionFindFirst).not.toHaveBeenCalled();

    shopFindUnique.mockClear();
    for (const id of ['', '  ', DEMO_SHOP_ID, BLACKLINE_SHOP_ID]) {
      expect((await loadKersivoAccess(id, now)).state).toBe('SETUP');
    }
    expect(shopFindUnique).not.toHaveBeenCalled();
  });
});
