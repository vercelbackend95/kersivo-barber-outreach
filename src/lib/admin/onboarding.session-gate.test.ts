import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermission = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...a: unknown[]) => requireAdminPermission(...a),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {},
}));

import { requireOnboardingAccess } from '@/lib/admin/onboarding';

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
