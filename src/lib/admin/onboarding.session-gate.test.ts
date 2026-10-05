import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermission = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...a: unknown[]) => requireAdminPermission(...a),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {},
}));

import { requireOnboardingAccess, resolveAdminOnboardingGate } from '@/lib/admin/onboarding';

describe('resolveAdminOnboardingGate (onboardingCompleted is not product access)', () => {
  it('A: onboarding not completed => onboarding', () => {
    expect(resolveAdminOnboardingGate({ onboardingCompleted: false, productState: 'SETUP' })).toBe(
      'onboarding',
    );
  });

  it('B/K: completed but SETUP => Free activation still required', () => {
    expect(resolveAdminOnboardingGate({ onboardingCompleted: true, productState: 'SETUP' })).toBe(
      'free_activation',
    );
  });

  it('C/L: completed + FREE_BOOKING => dashboard', () => {
    expect(
      resolveAdminOnboardingGate({ onboardingCompleted: true, productState: 'FREE_BOOKING' }),
    ).toBe('dashboard');
  });

  it('D/M: completed + FULL_KERSIVO => dashboard', () => {
    expect(
      resolveAdminOnboardingGate({ onboardingCompleted: true, productState: 'FULL_KERSIVO' }),
    ).toBe('dashboard');
  });

  it('E: FULL_KERSIVO but onboarding not completed keeps onboarding', () => {
    expect(
      resolveAdminOnboardingGate({ onboardingCompleted: false, productState: 'FULL_KERSIVO' }),
    ).toBe('onboarding');
  });
});

describe('requireOnboardingAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires session via (rejects secret)', async () => {
    requireAdminPermission.mockResolvedValue({
      shopId: 'demo',
      userId: null,
      via: 'secret',
      permissions: ['onboarding.manage'],
    });
    const res = await requireOnboardingAccess({} as APIContext);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  it('requires signed-in userId', async () => {
    requireAdminPermission.mockResolvedValue({
      shopId: 'shop_1',
      userId: null,
      via: 'session',
      permissions: ['onboarding.manage'],
    });
    const res = await requireOnboardingAccess({} as APIContext);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });
});
