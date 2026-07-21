import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminContext = vi.fn();
const requireAnyPermission = vi.fn();
const resolveBarberSeatForInvite = vi.fn();
const createInviteToken = vi.fn();
const inviteExpiresAt = vi.fn();
const assertCanInviteRole = vi.fn();
const shopMemberFindFirst = vi.fn();
const shopInviteCreate = vi.fn();
const shopSettingsFindUnique = vi.fn();
const sendShopTeamInviteEmail = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: (...args: unknown[]) => requireAnyPermission(...args),
}));

vi.mock('@/lib/admin/rbac/members', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/rbac/members')>(
    '@/lib/admin/rbac/members',
  );
  return {
    ...actual,
    resolveBarberSeatForInvite: (...args: unknown[]) => resolveBarberSeatForInvite(...args),
    createInviteToken: (...args: unknown[]) => createInviteToken(...args),
    inviteExpiresAt: (...args: unknown[]) => inviteExpiresAt(...args),
    assertCanInviteRole: (...args: unknown[]) => assertCanInviteRole(...args),
  };
});

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopMember: {
      findFirst: (...args: unknown[]) => shopMemberFindFirst(...args),
    },
    shopInvite: {
      create: (...args: unknown[]) => shopInviteCreate(...args),
    },
    shopSettings: {
      findUnique: (...args: unknown[]) => shopSettingsFindUnique(...args),
    },
  },
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'http://localhost:4321',
}));

vi.mock('@/lib/email/sender', () => ({
  sendShopTeamInviteEmail: (...args: unknown[]) => sendShopTeamInviteEmail(...args),
}));

import { POST } from './invite';

function makeContext(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/members/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

const ownerAccess = {
  shopId: 'shop-1',
  userId: 'user-o',
  userName: 'Owner',
  userEmail: 'owner@example.com',
  userImage: null,
  via: 'session' as const,
  role: 'OWNER' as const,
  memberId: 'm-o',
  barberId: null,
  permissions: [],
};

describe('POST /api/admin/members/invite roster seat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue(ownerAccess);
    requireAnyPermission.mockReturnValue(null);
    assertCanInviteRole.mockResolvedValue(null);
    shopMemberFindFirst.mockResolvedValue(null);
    createInviteToken.mockReturnValue({ token: 'tok', tokenHash: 'hash' });
    inviteExpiresAt.mockReturnValue(new Date('2026-08-01T00:00:00.000Z'));
    shopSettingsFindUnique.mockResolvedValue({ name: 'Trim Shop' });
    sendShopTeamInviteEmail.mockResolvedValue(undefined);
    shopInviteCreate.mockResolvedValue({
      id: 'inv-1',
      email: 'alex@shop.com',
      role: 'BARBER',
      barberId: 'barber-new',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
    });
  });

  it('returns 400 when Barber invite has no seat', async () => {
    resolveBarberSeatForInvite.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'Barber invites require a roster seat. Pick an available seat or create a new one.',
        }),
        { status: 400 },
      ),
    );

    const res = await POST(
      makeContext({ email: 'alex@shop.com', role: 'BARBER' }),
    );

    expect(res.status).toBe(400);
    expect(shopInviteCreate).not.toHaveBeenCalled();
  });

  it('stores barberId from createSeat on the invite', async () => {
    resolveBarberSeatForInvite.mockResolvedValue('barber-new');

    const res = await POST(
      makeContext({
        email: 'alex@shop.com',
        role: 'BARBER',
        createSeat: { name: 'Alex' },
      }),
    );

    expect(res.status).toBe(201);
    expect(resolveBarberSeatForInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: 'shop-1',
        email: 'alex@shop.com',
        createSeat: { name: 'Alex' },
      }),
    );
    expect(shopInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          barberId: 'barber-new',
          role: 'BARBER',
        }),
      }),
    );
  });
});
