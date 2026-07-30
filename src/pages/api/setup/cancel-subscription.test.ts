import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const cancelSubscriptionAtPeriodEnd = vi.fn();
const applyStripeSubscriptionToSaasRecord = vi.fn();
const recordAccountLifecycleEvent = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    saasSubscription: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

vi.mock('@/lib/shop/stripe', () => ({
  cancelSubscriptionAtPeriodEnd: (...args: unknown[]) => cancelSubscriptionAtPeriodEnd(...args),
}));

vi.mock('@/lib/setup/saasSubscriptionLifecycle', () => ({
  applyStripeSubscriptionToSaasRecord: (...args: unknown[]) =>
    applyStripeSubscriptionToSaasRecord(...args),
}));

vi.mock('@/lib/setup/accountLifecycleAudit', () => ({
  ACCOUNT_LIFECYCLE_ACTIONS: {
    SUBSCRIPTION_CANCEL_REQUESTED: 'SUBSCRIPTION_CANCEL_REQUESTED',
  },
  recordAccountLifecycleEvent: (...args: unknown[]) => recordAccountLifecycleEvent(...args),
}));

import { POST } from './cancel-subscription';

function makeContext(): APIContext {
  return {
    request: new Request('http://localhost/api/setup/cancel-subscription', { method: 'POST' }),
  } as unknown as APIContext;
}

describe('POST /api/setup/cancel-subscription', () => {
  beforeEach(() => {
    resolveAdminAccess.mockReset();
    requirePermission.mockReset();
    findFirst.mockReset();
    update.mockReset();
    cancelSubscriptionAtPeriodEnd.mockReset();
    applyStripeSubscriptionToSaasRecord.mockReset();
    recordAccountLifecycleEvent.mockReset();
    requirePermission.mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    resolveAdminAccess.mockResolvedValue(null);
    const res = await POST(makeContext() as never);
    expect(res.status).toBe(401);
    expect(cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
  });

  it('returns 404 when no cancellable subscription', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userId: 'u1',
      userEmail: 'o@example.com',
    });
    findFirst.mockResolvedValue(null);

    const res = await POST(makeContext() as never);
    expect(res.status).toBe(404);
    expect(cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
  });

  it('does not call Stripe when already scheduled', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userId: 'u1',
      userEmail: 'o@example.com',
    });
    findFirst.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      status: 'ACTIVE',
    });

    const res = await POST(makeContext() as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.alreadyScheduled).toBe(true);
    expect(cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
  });

  it('syncs local state only after Stripe succeeds', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userId: 'u1',
      userEmail: 'o@example.com',
    });
    findFirst.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      status: 'ACTIVE',
    });
    const stripeSub = {
      id: 'sub_1',
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: 1782864000,
    };
    cancelSubscriptionAtPeriodEnd.mockResolvedValue(stripeSub);
    applyStripeSubscriptionToSaasRecord.mockResolvedValue({
      record: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
        status: 'ACTIVE',
      },
      grantedAccess: true,
      shopId: 'shop-1',
    });

    const res = await POST(makeContext() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.cancelAtPeriodEnd).toBe(true);
    expect(cancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith('sub_1');
    expect(applyStripeSubscriptionToSaasRecord).toHaveBeenCalledWith(stripeSub);
    expect(recordAccountLifecycleEvent).toHaveBeenCalled();
  });

  it('does not sync when Stripe fails', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userId: 'u1',
      userEmail: 'o@example.com',
    });
    findFirst.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      status: 'ACTIVE',
    });
    cancelSubscriptionAtPeriodEnd.mockRejectedValue(new Error('stripe down'));

    const res = await POST(makeContext() as never);
    expect(res.status).toBe(500);
    expect(applyStripeSubscriptionToSaasRecord).not.toHaveBeenCalled();
    expect(recordAccountLifecycleEvent).not.toHaveBeenCalled();
  });
});
