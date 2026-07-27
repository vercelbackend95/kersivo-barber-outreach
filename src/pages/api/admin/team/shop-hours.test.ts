import { beforeEach, describe, expect, it, vi } from 'vitest';

const serializeShopOpeningHours = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: vi.fn(async () => ({
    shopId: 'shop-1',
    userId: 'user-o',
    role: 'OWNER',
    permissions: ['members.manage', 'members.invite_barber'],
  })),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: vi.fn(() => null),
}));

vi.mock('@/lib/admin/shopOpeningHours', () => ({
  serializeShopOpeningHours: (...args: unknown[]) => serializeShopOpeningHours(...args),
}));

import { GET } from './shop-hours';
import type { APIContext } from 'astro';
import { requireAdminContext as requireAdminContextMock } from '@/lib/admin/auth';
import { requireAnyPermission as requireAnyPermissionMock } from '@/lib/admin/rbac/can';

function ctx(): APIContext {
  return {
    request: new Request('http://localhost/api/admin/team/shop-hours', { method: 'GET' }),
  } as unknown as APIContext;
}

describe('GET /api/admin/team/shop-hours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAnyPermissionMock).mockReturnValue(null);
    serializeShopOpeningHours.mockResolvedValue([
      { dayOfWeek: 1, active: true, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 7, active: false, startTime: '09:00', endTime: '18:00' },
    ]);
  });

  it('returns serialized shop opening hours', async () => {
    const res = await GET(ctx());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(serializeShopOpeningHours).toHaveBeenCalledWith('shop-1');
    expect(data.hours).toEqual([
      { dayOfWeek: 1, active: true, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 7, active: false, startTime: '09:00', endTime: '18:00' },
    ]);
  });

  it('rejects when permission is denied', async () => {
    vi.mocked(requireAnyPermissionMock).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    );
    const res = await GET(ctx());
    expect(res.status).toBe(403);
    expect(serializeShopOpeningHours).not.toHaveBeenCalled();
  });

  it('rejects when auth fails', async () => {
    vi.mocked(requireAdminContextMock).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) as never,
    );
    const res = await GET(ctx());
    expect(res.status).toBe(401);
    expect(serializeShopOpeningHours).not.toHaveBeenCalled();
  });
});
