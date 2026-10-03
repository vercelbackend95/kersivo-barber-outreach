import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const {
  requireAdminContext,
  healOnboardingCompletedIfEligible,
  shopFindUnique,
  subscriptionFindFirst,
} = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  healOnboardingCompletedIfEligible: vi.fn(),
  shopFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
}));

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return {
    ...actual,
    requireAdminContext,
  };
});

vi.mock('@/lib/admin/onboarding', () => ({
  healOnboardingCompletedIfEligible,
}));

vi.mock('@/lib/admin/shopPublicActivity', () => ({
  isPauseActiveNow: () => false,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...a: unknown[]) => shopFindUnique(...a),
    },
    saasSubscription: {
      findFirst: (...a: unknown[]) => subscriptionFindFirst(...a),
    },
  },
}));

const sessionShopRow = {
  id: 'shop_preview',
  shopPaidAt: null,
  smsRemindersEnabled: false,
  freeBookingActivatedAt: null,
  onboardingCompleted: true,
  onboardingCurrentStep: 6,
  retailOnboardingCompleted: false,
  retailOnboardingSkipped: false,
  retailOnboardingProductId: null,
  retailTestOrderId: null,
  retailTestOrderCompletedAt: null,
  retailPickupWalkthroughCompletedAt: null,
  logoUrl: null,
  name: 'Fade Lab',
  timezone: 'Europe/London',
  publicActivityPaused: false,
  publicActivityPauseFrom: null,
  publicActivityPauseUntil: null,
  publicActivityPauseReason: null,
};

const tenantAccess = {
  shopId: 'shop_1',
  userId: 'user_1',
  userName: 'Owner',
  userEmail: 'owner@example.com',
  emailVerified: true,
  userImage: null,
  via: 'session',
  role: 'OWNER',
  memberId: 'member_1',
  barberId: null,
  permissions: ['bookings.manage', 'reports.view'],
};

import { GET } from './session';

describe('GET /api/admin/session preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    healOnboardingCompletedIfEligible.mockResolvedValue(undefined);
    subscriptionFindFirst.mockResolvedValue(null);
  });

  it('loads shop fields for via preview', async () => {
    requireAdminContext.mockResolvedValue({
      shopId: 'shop_preview',
      userId: null,
      userName: null,
      userEmail: null,
      emailVerified: true,
      userImage: null,
      via: 'preview',
      role: 'OWNER',
      memberId: null,
      barberId: null,
      permissions: ['bookings.manage'],
    });
    shopFindUnique.mockResolvedValue({
      onboardingCompleted: true,
      onboardingCurrentStep: 6,
      retailOnboardingCompleted: false,
      retailOnboardingSkipped: false,
      retailOnboardingProductId: null,
      retailTestOrderId: null,
      retailTestOrderCompletedAt: null,
      retailPickupWalkthroughCompletedAt: null,
      logoUrl: null,
      name: 'Fade Lab',
      timezone: 'Europe/London',
      publicActivityPaused: true,
      publicActivityPauseFrom: null,
      publicActivityPauseUntil: null,
      publicActivityPauseReason: 'preview',
    });

    const res = await GET({
      request: new Request('http://localhost/api/admin/session'),
    } as unknown as APIContext);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      via: 'preview',
      shopId: 'shop_preview',
      shop: { name: 'Fade Lab' },
      onboardingCompleted: true,
      productAccess: { state: 'SETUP' },
    });
    expect(Object.values(body.productAccess.capabilities).some(Boolean)).toBe(false);
  });
});

describe('GET /api/admin/session productAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    healOnboardingCompletedIfEligible.mockResolvedValue(undefined);
    subscriptionFindFirst.mockResolvedValue(null);
  });

  async function getBody() {
    const res = await GET({
      request: new Request('http://localhost/api/admin/session'),
    } as unknown as APIContext);
    expect(res.status).toBe(200);
    return res.json();
  }

  it('keeps legacy onboardingCompleted shops in SETUP and leaves RBAC permissions untouched', async () => {
    requireAdminContext.mockResolvedValue(tenantAccess);
    shopFindUnique.mockResolvedValue({ ...sessionShopRow, id: 'shop_1' });
    const body = await getBody();
    expect(body.onboardingCompleted).toBe(true);
    expect(body.productAccess.state).toBe('SETUP');
    expect(body.role).toBe('OWNER');
    expect(body.permissions).toEqual(['bookings.manage', 'reports.view']);
  });

  it('returns FREE_BOOKING capabilities when the free marker is set', async () => {
    requireAdminContext.mockResolvedValue(tenantAccess);
    shopFindUnique.mockResolvedValue({
      ...sessionShopRow,
      id: 'shop_1',
      freeBookingActivatedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const body = await getBody();
    expect(body.productAccess).toEqual({
      state: 'FREE_BOOKING',
      capabilities: {
        bookingCore: true,
        publicBooking: true,
        bookingPayments: true,
        team: true,
        services: true,
        reports: false,
        clients: false,
        fullBookingHistory: false,
        retail: false,
        assistant: false,
        smsReminders: false,
        automatedEmailReminders: false,
        brandedSite: false,
        manualBookings: false,
      },
    });
    expect(body.permissions).toEqual(['bookings.manage', 'reports.view']);
  });

  it('returns FULL_KERSIVO for an active paid subscription', async () => {
    requireAdminContext.mockResolvedValue(tenantAccess);
    shopFindUnique.mockResolvedValue({ ...sessionShopRow, id: 'shop_1' });
    subscriptionFindFirst.mockResolvedValue({
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2999-01-01T00:00:00.000Z'),
    });
    const body = await getBody();
    expect(body.productAccess.state).toBe('FULL_KERSIVO');
    expect(Object.values(body.productAccess.capabilities).every(Boolean)).toBe(true);
  });

  it('returns null productAccess for legacy secret access without loading the shop', async () => {
    requireAdminContext.mockResolvedValue({
      ...tenantAccess,
      shopId: 'demo-shop',
      userId: null,
      via: 'secret',
      memberId: null,
    });
    const body = await getBody();
    expect(body.productAccess).toBeNull();
    expect(body.via).toBe('secret');
    expect(shopFindUnique).not.toHaveBeenCalled();
  });
});
