import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const shopMemberFindFirst = vi.fn();
const shopMemberDelete = vi.fn();
const barberUpdateMany = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: vi.fn(async () => ({
    shopId: 'shop-1',
    userId: 'user-o',
    role: 'OWNER',
    permissions: ['members.manage'],
  })),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: vi.fn(() => null),
}));

vi.mock('@/lib/db/serializableTransaction', () => ({
  runSerializableTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      shopMember: {
        findFirst: (...a: unknown[]) => shopMemberFindFirst(...a),
        delete: (...a: unknown[]) => shopMemberDelete(...a),
      },
      barber: {
        updateMany: (...a: unknown[]) => barberUpdateMany(...a),
      },
    }),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {},
}));

import { DELETE } from './dashboard-access';
import { requireAdminContext as requireAdminContextMock } from '@/lib/admin/auth';
import { requireAnyPermission as requireAnyPermissionMock } from '@/lib/admin/rbac/can';

function ctx(memberId = 'm1'): APIContext {
  return {
    params: { memberId },
    request: new Request(
      `http://localhost/api/admin/team/members/${memberId}/dashboard-access`,
      { method: 'DELETE' },
    ),
  } as unknown as APIContext;
}

describe('DELETE /api/admin/team/members/[memberId]/dashboard-access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAnyPermissionMock).mockReturnValue(null);
    shopMemberDelete.mockResolvedValue({ id: 'm1' });
    barberUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('revokes dashboard access and clears Barber.userId', async () => {
    shopMemberFindFirst.mockResolvedValue({
      id: 'm1',
      userId: 'user-b',
      role: 'BARBER',
      barberId: 'b1',
      user: { email: 'barber@shop.com' },
    });

    const res = await DELETE(ctx());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.barberId).toBe('b1');
    expect(shopMemberDelete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(barberUpdateMany).toHaveBeenCalledWith({
      where: { id: 'b1', shopId: 'shop-1' },
      data: { userId: null },
    });
  });

  it('rejects revoking the shop owner', async () => {
    shopMemberFindFirst.mockResolvedValue({
      id: 'm-owner',
      userId: 'user-other-o',
      role: 'OWNER',
      barberId: 'b-owner',
      user: { email: 'owner@shop.com' },
    });

    const res = await DELETE(ctx('m-owner'));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('FORBIDDEN');
    expect(shopMemberDelete).not.toHaveBeenCalled();
  });

  it('rejects revoking self', async () => {
    shopMemberFindFirst.mockResolvedValue({
      id: 'm1',
      userId: 'user-o',
      role: 'BARBER',
      barberId: 'b1',
      user: { email: 'me@shop.com' },
    });

    const res = await DELETE(ctx());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('CANNOT_REVOKE_SELF');
    expect(shopMemberDelete).not.toHaveBeenCalled();
  });

  it('rejects when Manager targets a Manager', async () => {
    vi.mocked(requireAdminContextMock).mockResolvedValueOnce({
      shopId: 'shop-1',
      userId: 'user-m',
      role: 'MANAGER',
      permissions: ['members.manage'],
    } as never);
    shopMemberFindFirst.mockResolvedValue({
      id: 'm2',
      userId: 'user-m2',
      role: 'MANAGER',
      barberId: null,
      user: { email: 'mgr@shop.com' },
    });

    const res = await DELETE(ctx('m2'));
    expect(res.status).toBe(403);
    expect(shopMemberDelete).not.toHaveBeenCalled();
  });
});
