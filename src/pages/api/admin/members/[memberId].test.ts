import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const shopMemberFindFirst = vi.fn();
const shopMemberUpdate = vi.fn();
const barberUpdateMany = vi.fn();
const linkMemberToBarberSeat = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: vi.fn(async () => ({
    shopId: 'shop-1',
    userId: 'user-o',
    role: 'OWNER',
    permissions: ['members.manage'],
  })),
}));

vi.mock('@/lib/admin/rbac/members', () => ({
  linkMemberToBarberSeat: (...a: unknown[]) => linkMemberToBarberSeat(...a),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopMember: {
      findFirst: (...a: unknown[]) => shopMemberFindFirst(...a),
      update: (...a: unknown[]) => shopMemberUpdate(...a),
    },
    barber: {
      updateMany: (...a: unknown[]) => barberUpdateMany(...a),
    },
  },
}));

import { PATCH } from './[memberId]';
import { requireAdminPermission as requireAdminPermissionMock } from '@/lib/admin/auth';

function ctx(memberId: string, body: unknown, method = 'PATCH'): APIContext {
  return {
    params: { memberId },
    request: new Request(`http://localhost/api/admin/members/${memberId}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('PATCH /api/admin/members/[memberId] role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminPermissionMock).mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-o',
      role: 'OWNER',
      permissions: ['members.manage'],
    } as never);
    shopMemberUpdate.mockImplementation(async ({ data }: { data: { role: string } }) => ({
      id: 'm1',
      role: data.role,
      barberId: 'b1',
      barber: { id: 'b1', name: 'Alex' },
    }));
    barberUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('allows Owner to promote Barber to Manager and syncs intendedRole', async () => {
    shopMemberFindFirst.mockResolvedValue({
      id: 'm1',
      role: 'BARBER',
      barberId: 'b1',
      shopId: 'shop-1',
    });

    const res = await PATCH(ctx('m1', { role: 'MANAGER' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.member.role).toBe('MANAGER');
    expect(shopMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: { role: 'MANAGER' },
      }),
    );
    expect(barberUpdateMany).toHaveBeenCalledWith({
      where: { id: 'b1', shopId: 'shop-1' },
      data: { intendedRole: 'MANAGER' },
    });
  });

  it('allows Owner to demote Manager to Barber', async () => {
    shopMemberFindFirst.mockResolvedValue({
      id: 'm1',
      role: 'MANAGER',
      barberId: null,
      shopId: 'shop-1',
    });
    shopMemberUpdate.mockResolvedValue({
      id: 'm1',
      role: 'BARBER',
      barberId: null,
      barber: null,
    });

    const res = await PATCH(ctx('m1', { role: 'BARBER' }));
    expect(res.status).toBe(200);
    expect(barberUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects Manager actors', async () => {
    vi.mocked(requireAdminPermissionMock).mockResolvedValueOnce({
      shopId: 'shop-1',
      userId: 'user-m',
      role: 'MANAGER',
      permissions: ['members.invite_barber'],
    } as never);
    shopMemberFindFirst.mockResolvedValue({
      id: 'm1',
      role: 'BARBER',
      barberId: 'b1',
      shopId: 'shop-1',
    });

    const res = await PATCH(ctx('m1', { role: 'MANAGER' }));
    expect(res.status).toBe(403);
    expect(shopMemberUpdate).not.toHaveBeenCalled();
  });

  it('rejects changing Owner role', async () => {
    shopMemberFindFirst.mockResolvedValue({
      id: 'm-owner',
      role: 'OWNER',
      barberId: 'b-o',
      shopId: 'shop-1',
    });

    const res = await PATCH(ctx('m-owner', { role: 'MANAGER' }));
    expect(res.status).toBe(400);
    expect(shopMemberUpdate).not.toHaveBeenCalled();
  });
});
