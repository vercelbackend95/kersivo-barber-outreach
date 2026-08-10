import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { permissionsForRole } from '@/lib/admin/rbac/permissions';

const requireAdminPermission = vi.fn();
const updateShop = vi.fn();

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return {
    ...actual,
    requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
  };
});

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      update: (...args: unknown[]) => updateShop(...args),
    },
  },
}));

import { POST } from './reset';

function makeContext(): APIContext {
  return {
    request: new Request('http://localhost/api/admin/retail-onboarding/reset', { method: 'POST' }),
  } as unknown as APIContext;
}

function access(via: 'session' | 'preview' | 'secret') {
  return {
    shopId: 'shop-1',
    userId: via === 'session' ? 'u1' : null,
    userName: null,
    userEmail: via === 'session' ? 'a@b.co' : null,
    emailVerified: true,
    userImage: null,
    via,
    role: 'OWNER' as const,
    memberId: null,
    barberId: null,
    permissions: permissionsForRole('OWNER'),
  };
}

describe('POST /api/admin/retail-onboarding/reset', () => {
  beforeEach(() => {
    requireAdminPermission.mockReset();
    updateShop.mockReset();
    updateShop.mockResolvedValue({});
  });

  it('allows preview via', async () => {
    requireAdminPermission.mockResolvedValue(access('preview'));
    const res = await POST(makeContext() as never);
    expect(res.status).toBe(200);
    expect(updateShop).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'shop-1' } }),
    );
  });

  it('rejects secret via', async () => {
    requireAdminPermission.mockResolvedValue(access('secret'));
    const res = await POST(makeContext() as never);
    expect(res.status).toBe(403);
    expect(updateShop).not.toHaveBeenCalled();
  });
});
