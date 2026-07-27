import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const shopInviteFindFirst = vi.fn();
const shopInviteDelete = vi.fn();
const shopInviteUpdate = vi.fn();
const barberUpdateMany = vi.fn();

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

vi.mock('@/lib/admin/rbac/members', () => ({
  assertCanInviteRole: vi.fn(async () => null),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopInvite: {
      findFirst: (...a: unknown[]) => shopInviteFindFirst(...a),
      delete: (...a: unknown[]) => shopInviteDelete(...a),
      update: (...a: unknown[]) => shopInviteUpdate(...a),
    },
    barber: {
      updateMany: (...a: unknown[]) => barberUpdateMany(...a),
    },
  },
}));

import { DELETE, PATCH } from './index';
import { requireAdminContext as requireAdminContextMock } from '@/lib/admin/auth';
import { requireAnyPermission as requireAnyPermissionMock } from '@/lib/admin/rbac/can';
import { assertCanInviteRole as assertCanInviteRoleMock } from '@/lib/admin/rbac/members';

function ctx(inviteId = 'inv-1'): APIContext {
  return {
    params: { inviteId },
    request: new Request(`http://localhost/api/admin/team/invitations/${inviteId}`, {
      method: 'DELETE',
    }),
  } as unknown as APIContext;
}

function patchCtx(inviteId: string, body: unknown): APIContext {
  return {
    params: { inviteId },
    request: new Request(`http://localhost/api/admin/team/invitations/${inviteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('DELETE /api/admin/team/invitations/[inviteId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAnyPermissionMock).mockReturnValue(null);
    vi.mocked(assertCanInviteRoleMock).mockResolvedValue(null);
    shopInviteDelete.mockResolvedValue({ id: 'inv-1' });
  });

  it('cancels a pending invitation', async () => {
    shopInviteFindFirst.mockResolvedValue({
      id: 'inv-1',
      role: 'BARBER',
      acceptedAt: null,
      barberId: 'b1',
      email: 'a@b.com',
    });

    const res = await DELETE(ctx());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.cancelledInviteId).toBe('inv-1');
    expect(data.barberId).toBe('b1');
    expect(shopInviteDelete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
  });

  it('rejects when invitation is already accepted', async () => {
    shopInviteFindFirst.mockResolvedValue({
      id: 'inv-1',
      role: 'BARBER',
      acceptedAt: new Date(),
      barberId: 'b1',
      email: 'a@b.com',
    });

    const res = await DELETE(ctx());
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('INVITATION_ALREADY_ACCEPTED');
    expect(shopInviteDelete).not.toHaveBeenCalled();
  });

  it('rejects when invitation is not in the shop', async () => {
    shopInviteFindFirst.mockResolvedValue(null);

    const res = await DELETE(ctx('other'));
    expect(res.status).toBe(404);
    expect(shopInviteDelete).not.toHaveBeenCalled();
  });

  it('rejects when Manager tries to cancel a Manager invite', async () => {
    vi.mocked(requireAdminContextMock).mockResolvedValueOnce({
      shopId: 'shop-1',
      userId: 'user-m',
      role: 'MANAGER',
      permissions: ['members.invite_barber'],
    } as never);
    vi.mocked(assertCanInviteRoleMock).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Forbidden to invite this role.' }), { status: 403 }),
    );
    shopInviteFindFirst.mockResolvedValue({
      id: 'inv-1',
      role: 'MANAGER',
      acceptedAt: null,
      barberId: null,
      email: 'mgr@b.com',
    });

    const res = await DELETE(ctx());
    expect(res.status).toBe(403);
    expect(shopInviteDelete).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/admin/team/invitations/[inviteId] role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAnyPermissionMock).mockReturnValue(null);
    shopInviteUpdate.mockImplementation(async ({ data }: { data: { role: string } }) => ({
      id: 'inv-1',
      role: data.role,
      barberId: 'b1',
    }));
    barberUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('allows Owner to change pending invite role and sync intendedRole', async () => {
    shopInviteFindFirst.mockResolvedValue({
      id: 'inv-1',
      role: 'BARBER',
      acceptedAt: null,
      barberId: 'b1',
    });

    const res = await PATCH(patchCtx('inv-1', { role: 'MANAGER' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.invite.role).toBe('MANAGER');
    expect(barberUpdateMany).toHaveBeenCalledWith({
      where: { id: 'b1', shopId: 'shop-1' },
      data: { intendedRole: 'MANAGER' },
    });
  });

  it('rejects Manager actors', async () => {
    vi.mocked(requireAdminContextMock).mockResolvedValueOnce({
      shopId: 'shop-1',
      userId: 'user-m',
      role: 'MANAGER',
      permissions: ['members.invite_barber'],
    } as never);
    shopInviteFindFirst.mockResolvedValue({
      id: 'inv-1',
      role: 'BARBER',
      acceptedAt: null,
      barberId: 'b1',
    });

    const res = await PATCH(patchCtx('inv-1', { role: 'MANAGER' }));
    expect(res.status).toBe(403);
    expect(shopInviteUpdate).not.toHaveBeenCalled();
  });

  it('rejects accepted invitations', async () => {
    shopInviteFindFirst.mockResolvedValue({
      id: 'inv-1',
      role: 'BARBER',
      acceptedAt: new Date(),
      barberId: 'b1',
    });

    const res = await PATCH(patchCtx('inv-1', { role: 'MANAGER' }));
    expect(res.status).toBe(409);
    expect(shopInviteUpdate).not.toHaveBeenCalled();
  });
});
