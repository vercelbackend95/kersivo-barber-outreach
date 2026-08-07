import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const findUniqueShop = vi.fn();
const findFirstSaas = vi.fn();
const findManyMembers = vi.fn();
const findManyInvites = vi.fn();
const findManyBarbers = vi.fn();
const findFirstDeposit = vi.fn();

let enableSetupFees = false;

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/pricing/offerMode', () => ({
  get ENABLE_SETUP_FEES() {
    return enableSetupFees;
  },
}));

vi.mock('@/lib/email/sender', () => ({
  getSetupOnboardingFormUrlOrEmpty: () => 'https://forms.test/onboarding',
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
    },
    saasSubscription: {
      findFirst: (...args: unknown[]) => findFirstSaas(...args),
    },
    shopMember: {
      findMany: (...args: unknown[]) => findManyMembers(...args),
    },
    shopInvite: {
      findMany: (...args: unknown[]) => findManyInvites(...args),
    },
    barber: {
      findMany: (...args: unknown[]) => findManyBarbers(...args),
    },
    setupDeposit: {
      findFirst: (...args: unknown[]) => findFirstDeposit(...args),
    },
  },
}));

import { GET } from './launch-context';

function makeContext(): APIContext {
  return {
    request: new Request('http://localhost/api/setup/launch-context'),
  } as unknown as APIContext;
}

describe('GET /api/setup/launch-context (setup fees off)', () => {
  beforeEach(() => {
    enableSetupFees = false;
    resolveAdminAccess.mockReset();
    requirePermission.mockReset();
    findUniqueShop.mockReset();
    findFirstSaas.mockReset();
    findManyMembers.mockReset();
    findManyInvites.mockReset();
    findManyBarbers.mockReset();
    findFirstDeposit.mockReset();
    requirePermission.mockReturnValue(null);
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userId: 'user-1',
      userEmail: 'owner@example.com',
      userName: 'Owner',
      role: 'OWNER',
    });
    findUniqueShop.mockResolvedValue({
      id: 'shop-1',
      shopPaidAt: null,
      smsRemindersEnabled: false,
      onboardingCompleted: true,
      retailOnboardingSkipped: true,
      retailPickupWalkthroughCompletedAt: null,
      name: 'Fade Studio',
      townCity: 'London',
      barbers: [{ id: 'b1', name: 'Alex' }],
      _count: { services: 2 },
    });
    findManyMembers.mockResolvedValue([{ id: 'm1', barberId: 'b1' }]);
    findManyInvites.mockResolvedValue([]);
    findManyBarbers.mockResolvedValue([
      { id: 'b1', userId: 'user-1' },
      { id: 'b2', userId: null },
    ]);
  });

  it('marks ACTIVE as blocked with redirectTo /admin', async () => {
    findFirstSaas.mockResolvedValue({
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 86400000),
      pastDueSince: null,
      activatedAt: new Date(),
    });

    const res = await GET(makeContext() as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.subscriptionState).toBe('active');
    expect(body.subscriptionBlocked).toBe(true);
    expect(body.redirectTo).toBe('/admin');
    expect(body.paid).toBe(true);
    expect(body.paidHref).toBe('/admin/client-onboarding');
  });

  it('marks PENDING as continue-purchase pending', async () => {
    findFirstSaas.mockResolvedValue({
      status: 'PENDING',
      currentPeriodEnd: null,
      pastDueSince: null,
      activatedAt: null,
    });

    const res = await GET(makeContext() as never);
    const body = await res.json();
    expect(body.subscriptionState).toBe('pending');
    expect(body.subscriptionBlocked).toBe(false);
    expect(body.pending).toBeTruthy();
  });

  it('allows purchase after CANCELED', async () => {
    findFirstSaas.mockResolvedValue({
      status: 'CANCELED',
      currentPeriodEnd: null,
      pastDueSince: null,
      activatedAt: null,
    });

    const res = await GET(makeContext() as never);
    const body = await res.json();
    expect(body.subscriptionState).toBe('canceled');
    expect(body.subscriptionBlocked).toBe(false);
    expect(body.pending).toBeNull();
  });

  it('blocks when shopPaidAt set without SaasSubscription', async () => {
    findUniqueShop.mockResolvedValue({
      id: 'shop-1',
      shopPaidAt: new Date(),
      smsRemindersEnabled: false,
      onboardingCompleted: true,
      retailOnboardingSkipped: true,
      retailPickupWalkthroughCompletedAt: null,
      name: 'Fade Studio',
      townCity: 'London',
      barbers: [{ id: 'b1', name: 'Alex' }],
      _count: { services: 2 },
    });
    findFirstSaas.mockResolvedValue(null);

    const res = await GET(makeContext() as never);
    const body = await res.json();
    expect(body.subscriptionBlocked).toBe(true);
    expect(body.redirectTo).toBe('/admin');
  });

  it('keeps PENDING unblocked when shopPaidAt is null', async () => {
    findFirstSaas.mockResolvedValue({
      status: 'PENDING',
      currentPeriodEnd: null,
      pastDueSince: null,
      activatedAt: null,
    });

    const res = await GET(makeContext() as never);
    const body = await res.json();
    expect(body.subscriptionState).toBe('pending');
    expect(body.subscriptionBlocked).toBe(false);
    expect(body.pending).toBeTruthy();
  });

  it('shopPaidAt wins over PENDING and redirects to /admin', async () => {
    findUniqueShop.mockResolvedValue({
      id: 'shop-1',
      shopPaidAt: new Date(),
      smsRemindersEnabled: false,
      onboardingCompleted: true,
      retailOnboardingSkipped: true,
      retailPickupWalkthroughCompletedAt: null,
      name: 'Fade Studio',
      townCity: 'London',
      barbers: [{ id: 'b1', name: 'Alex' }],
      _count: { services: 2 },
    });
    findFirstSaas.mockResolvedValue({
      status: 'PENDING',
      currentPeriodEnd: null,
      pastDueSince: null,
      activatedAt: null,
    });

    const res = await GET(makeContext() as never);
    const body = await res.json();
    expect(body.subscriptionBlocked).toBe(true);
    expect(body.redirectTo).toBe('/admin');
    expect(body.pending).toBeNull();
  });
});

describe('GET /api/setup/launch-context (setup fees on)', () => {
  beforeEach(() => {
    enableSetupFees = true;
    resolveAdminAccess.mockReset();
    requirePermission.mockReset();
    findUniqueShop.mockReset();
    findFirstSaas.mockReset();
    findManyMembers.mockReset();
    findManyInvites.mockReset();
    findManyBarbers.mockReset();
    findFirstDeposit.mockReset();
    requirePermission.mockReturnValue(null);
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userId: 'user-1',
      userEmail: 'owner@example.com',
      userName: 'Owner',
      role: 'OWNER',
    });
    findUniqueShop.mockResolvedValue({
      id: 'shop-1',
      shopPaidAt: new Date(),
      smsRemindersEnabled: false,
      onboardingCompleted: true,
      retailOnboardingSkipped: true,
      retailPickupWalkthroughCompletedAt: null,
      name: 'Fade Studio',
      townCity: 'London',
      barbers: [{ id: 'b1', name: 'Alex' }],
      _count: { services: 2 },
    });
    findFirstSaas.mockResolvedValue(null);
    findManyMembers.mockResolvedValue([{ id: 'm1', barberId: 'b1' }]);
    findManyInvites.mockResolvedValue([]);
    findManyBarbers.mockResolvedValue([{ id: 'b1', userId: 'user-1' }]);
    findFirstDeposit.mockResolvedValue(null);
  });

  it('does not treat shopPaidAt alone as subscriptionBlocked when fees enabled', async () => {
    const res = await GET(makeContext() as never);
    const body = await res.json();
    expect(body.subscriptionBlocked).toBe(false);
    expect(body.redirectTo).toBeNull();
    expect(body.paidHref).toBe('https://forms.test/onboarding');
  });
});
