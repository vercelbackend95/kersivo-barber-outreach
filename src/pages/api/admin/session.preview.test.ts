import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const {
  requireAdminContext,
  healOnboardingCompletedIfEligible,
  shopFindUnique,
} = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  healOnboardingCompletedIfEligible: vi.fn(),
  shopFindUnique: vi.fn(),
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
  },
}));

import { GET } from './session';

describe('GET /api/admin/session preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    healOnboardingCompletedIfEligible.mockResolvedValue(undefined);
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
    });
  });
});
