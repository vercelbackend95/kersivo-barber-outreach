import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const subscriptionFindFirst = vi.fn();
const loadStarterPublicLaunchReadiness = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
  requireVerifiedEmail: () => null,
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: () => null,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    saasSubscription: { findFirst: (...args: unknown[]) => subscriptionFindFirst(...args) },
    shopSettings: { findUnique: vi.fn(async () => null) },
  },
}));

vi.mock('@/lib/setup/starterPublicLaunchReadiness', () => ({
  loadStarterPublicLaunchReadiness: (...args: unknown[]) => loadStarterPublicLaunchReadiness(...args),
}));

import { GET } from './billing-status';

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ACTIVE',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: new Date('2999-01-01T00:00:00.000Z'),
    pastDueSince: null,
    suspendedAt: null,
    retentionEndsAt: null,
    canceledAt: null,
    dataExportDownloadedAt: null,
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    monthlyPence: 3900,
    currency: 'gbp',
    postFullPlan: 'UNDECIDED',
    postFullPlanChosenAt: null,
    ...overrides,
  };
}

const blocked = {
  ready: false,
  reasons: ['stripe_not_ready', 'service_below_minimum'],
  stripe: { ready: false, accountLinked: false, disconnected: false, blocker: 'connect_missing' },
  activeServiceCount: 2,
  minimumServicePricePence: 500,
  servicesBelowMinimum: [{ id: 'svc_low', name: 'Line-up', pricePence: 300 }],
};

describe('GET /api/setup/billing-status — Full → Starter readiness preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAdminAccess.mockResolvedValue({ via: 'session', shopId: 'shop-1', userId: 'u1' });
    loadStarterPublicLaunchReadiness.mockResolvedValue(blocked);
  });

  it('previews Starter blockers before the owner confirms the Starter choice', async () => {
    subscriptionFindFirst.mockResolvedValue(subscription());
    const body = await (await GET({} as APIContext)).json();
    expect(body.postFullPlanChoiceRequired).toBe(true);
    expect(body.currentPeriodEnd).toBe('2999-01-01T00:00:00.000Z');
    expect(body.starterPublicLaunch).toEqual(blocked);
    expect(loadStarterPublicLaunchReadiness).toHaveBeenCalledWith('shop-1');
  });

  it('keeps showing blockers after Starter was chosen', async () => {
    subscriptionFindFirst.mockResolvedValue(
      subscription({ postFullPlan: 'STARTER', postFullPlanChosenAt: new Date() }),
    );
    const body = await (await GET({} as APIContext)).json();
    expect(body.starterPublicLaunch).toEqual(blocked);
  });

  it('does not evaluate Starter readiness for a Leave choice', async () => {
    subscriptionFindFirst.mockResolvedValue(
      subscription({ postFullPlan: 'LEAVE', postFullPlanChosenAt: new Date() }),
    );
    const body = await (await GET({} as APIContext)).json();
    expect(body.starterPublicLaunch).toBeNull();
    expect(loadStarterPublicLaunchReadiness).not.toHaveBeenCalled();
  });
});
