import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const {
  requireAdminContext,
  requireAnyPermission,
  shopInviteFindFirst,
  shopInviteUpdate,
  shopInviteCreate,
  shopMemberCreate,
  shopMemberUpdate,
  barberUpdate,
  shopSettingsFindUnique,
  sendShopTeamInviteEmail,
  createInviteToken,
  inviteExpiresAt,
  assertCanInviteRole,
} = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  requireAnyPermission: vi.fn(() => null),
  shopInviteFindFirst: vi.fn(),
  shopInviteUpdate: vi.fn(),
  shopInviteCreate: vi.fn(),
  shopMemberCreate: vi.fn(),
  shopMemberUpdate: vi.fn(),
  barberUpdate: vi.fn(),
  shopSettingsFindUnique: vi.fn(),
  sendShopTeamInviteEmail: vi.fn(),
  createInviteToken: vi.fn(() => ({ token: 'new-tok', tokenHash: 'new-hash' })),
  inviteExpiresAt: vi.fn(() => new Date('2026-08-01T12:00:00.000Z')),
  assertCanInviteRole: vi.fn(async () => null),
}));

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext,
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission,
}));

vi.mock('@/lib/admin/rbac/members', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/rbac/members')>(
    '@/lib/admin/rbac/members',
  );
  return {
    ...actual,
    createInviteToken,
    inviteExpiresAt,
    assertCanInviteRole,
  };
});

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'http://localhost:4321',
}));

vi.mock('@/lib/email/sender', () => ({
  sendShopTeamInviteEmail,
}));

vi.mock('@/lib/db/serializableTransaction', () => ({
  runSerializableTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      shopInvite: {
        findFirst: (...a: unknown[]) => shopInviteFindFirst(...a),
        update: (...a: unknown[]) => shopInviteUpdate(...a),
        create: (...a: unknown[]) => shopInviteCreate(...a),
      },
      shopMember: {
        create: (...a: unknown[]) => shopMemberCreate(...a),
        update: (...a: unknown[]) => shopMemberUpdate(...a),
      },
      barber: {
        update: (...a: unknown[]) => barberUpdate(...a),
      },
    }),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...a: unknown[]) => shopSettingsFindUnique(...a),
    },
  },
}));

import { POST } from './resend';
import { INVITE_TTL_MS, invitationResendCooldown } from '@/lib/admin/rbac/members';
import { canActorResendInvitation } from '@/lib/admin/teamCards';

function makeContext(inviteId: string): APIContext {
  return {
    params: { inviteId },
    request: new Request('http://localhost/api/admin/team/invitations/inv-1/resend', {
      method: 'POST',
    }),
  } as unknown as APIContext;
}

function baseInvite(overrides: Record<string, unknown> = {}) {
  const issuedAgo = 5 * 60_000;
  const expiresAt = new Date(Date.now() - issuedAgo + INVITE_TTL_MS);
  return {
    id: 'inv-1',
    email: 'barber@example.com',
    role: 'BARBER' as const,
    displayName: 'Alex',
    bookable: true,
    barberId: 'b1',
    invitedByUserId: 'user-o',
    acceptedAt: null,
    expiresAt,
    tokenHash: 'old-hash',
    ...overrides,
  };
}

describe('canActorResendInvitation', () => {
  it('allows Owner to resend Manager and Barber', () => {
    expect(canActorResendInvitation('OWNER', 'MANAGER')).toBe(true);
    expect(canActorResendInvitation('OWNER', 'BARBER')).toBe(true);
  });

  it('allows Manager to resend Barber only', () => {
    expect(canActorResendInvitation('MANAGER', 'BARBER')).toBe(true);
    expect(canActorResendInvitation('MANAGER', 'MANAGER')).toBe(false);
  });

  it('blocks Barber and Owner invites', () => {
    expect(canActorResendInvitation('BARBER', 'BARBER')).toBe(false);
    expect(canActorResendInvitation('OWNER', 'OWNER')).toBe(false);
  });
});

describe('invitationResendCooldown', () => {
  it('blocks when issued less than 60s ago', () => {
    const now = new Date('2026-07-23T12:00:30.000Z');
    const expiresAt = new Date(now.getTime() - 10_000 + INVITE_TTL_MS);
    const result = invitationResendCooldown(expiresAt, now);
    expect(result.blocked).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('allows when issued more than 60s ago', () => {
    const now = new Date('2026-07-23T12:02:00.000Z');
    const expiresAt = new Date(now.getTime() - 120_000 + INVITE_TTL_MS);
    expect(invitationResendCooldown(expiresAt, now).blocked).toBe(false);
  });
});

describe('POST /api/admin/team/invitations/[inviteId]/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-o',
      role: 'OWNER',
      permissions: ['members.manage'],
    });
    requireAnyPermission.mockReturnValue(null);
    assertCanInviteRole.mockResolvedValue(null);
    createInviteToken.mockReturnValue({ token: 'new-tok', tokenHash: 'new-hash' });
    inviteExpiresAt.mockReturnValue(new Date('2026-08-01T12:00:00.000Z'));
    shopSettingsFindUnique.mockResolvedValue({ name: 'Test Shop' });
    sendShopTeamInviteEmail.mockResolvedValue(undefined);
  });

  it('renews the same ShopInvite: rotates tokenHash, extends expiresAt, preserves fields', async () => {
    const invite = baseInvite();
    shopInviteFindFirst.mockResolvedValue(invite);
    shopInviteUpdate.mockResolvedValue({
      ...invite,
      tokenHash: 'new-hash',
      expiresAt: new Date('2026-08-01T12:00:00.000Z'),
    });

    const res = await POST(makeContext('inv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.emailSent).toBe(true);
    expect(body.invite.id).toBe('inv-1');
    expect(shopInviteCreate).not.toHaveBeenCalled();
    expect(shopMemberCreate).not.toHaveBeenCalled();
    expect(shopMemberUpdate).not.toHaveBeenCalled();
    expect(barberUpdate).not.toHaveBeenCalled();
    expect(shopInviteUpdate).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        tokenHash: 'new-hash',
        expiresAt: new Date('2026-08-01T12:00:00.000Z'),
      },
      select: expect.any(Object),
    });
    expect(shopInviteFindFirst).toHaveBeenCalledWith({
      where: { id: 'inv-1', shopId: 'shop-1' },
      select: expect.any(Object),
    });
  });

  it('sends email only after commit and keeps invite when email fails', async () => {
    const invite = baseInvite();
    shopInviteFindFirst.mockResolvedValue(invite);
    shopInviteUpdate.mockResolvedValue({
      ...invite,
      tokenHash: 'new-hash',
      expiresAt: new Date('2026-08-01T12:00:00.000Z'),
    });
    sendShopTeamInviteEmail.mockRejectedValue(new Error('smtp down'));

    const res = await POST(makeContext('inv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailSent).toBe(false);
    expect(body.acceptPath).toBe('/admin/invite?token=new-tok');
    expect(body.warning).toMatch(/could not be sent/i);
    expect(body).not.toHaveProperty('tokenHash');
    expect(JSON.stringify(body)).not.toMatch(/new-hash|old-hash/);
    expect(shopInviteUpdate).toHaveBeenCalled();
    expect(sendShopTeamInviteEmail).toHaveBeenCalled();
    expect(shopInviteUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      sendShopTeamInviteEmail.mock.invocationCallOrder[0],
    );
  });

  it('survives post-commit shop lookup failure and still emails with fallback name', async () => {
    const invite = baseInvite();
    shopInviteFindFirst.mockResolvedValue(invite);
    shopInviteUpdate.mockResolvedValue({
      ...invite,
      tokenHash: 'new-hash',
      expiresAt: new Date('2026-08-01T12:00:00.000Z'),
    });
    shopSettingsFindUnique.mockRejectedValue(new Error('db blip'));

    const res = await POST(makeContext('inv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.emailSent).toBe(true);
    expect(body).not.toHaveProperty('tokenHash');
    expect(sendShopTeamInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'barber@example.com',
        shopName: 'your barbershop',
        acceptUrl: 'http://localhost:4321/admin/invite?token=new-tok',
      }),
    );
  });

  it('returns 200 with acceptPath when shop lookup and email both fail after commit', async () => {
    const invite = baseInvite();
    shopInviteFindFirst.mockResolvedValue(invite);
    shopInviteUpdate.mockResolvedValue({
      ...invite,
      tokenHash: 'new-hash',
      expiresAt: new Date('2026-08-01T12:00:00.000Z'),
    });
    shopSettingsFindUnique.mockRejectedValue(new Error('db blip'));
    sendShopTeamInviteEmail.mockRejectedValue(new Error('smtp down'));

    const res = await POST(makeContext('inv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailSent).toBe(false);
    expect(body.acceptPath).toBe('/admin/invite?token=new-tok');
    expect(shopInviteUpdate).toHaveBeenCalled();
  });

  it('returns 404 for missing or cross-shop invite', async () => {
    shopInviteFindFirst.mockResolvedValue(null);
    const res = await POST(makeContext('other-shop-inv'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('INVITATION_NOT_FOUND');
    expect(shopInviteUpdate).not.toHaveBeenCalled();
    expect(sendShopTeamInviteEmail).not.toHaveBeenCalled();
  });

  it('returns 409 when already accepted', async () => {
    shopInviteFindFirst.mockResolvedValue(baseInvite({ acceptedAt: new Date() }));
    const res = await POST(makeContext('inv-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('INVITATION_ALREADY_ACCEPTED');
    expect(shopInviteUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 for OWNER invite role', async () => {
    shopInviteFindFirst.mockResolvedValue(baseInvite({ role: 'OWNER' }));
    const res = await POST(makeContext('inv-1'));
    expect(res.status).toBe(403);
    expect(shopInviteUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 when assertCanInviteRole denies (Manager→Manager)', async () => {
    requireAdminContext.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-m',
      role: 'MANAGER',
      permissions: ['members.invite_barber'],
    });
    assertCanInviteRole.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as never,
    );
    shopInviteFindFirst.mockResolvedValue(baseInvite({ role: 'MANAGER' }));

    const res = await POST(makeContext('inv-1'));
    expect(res.status).toBe(403);
    expect(shopInviteUpdate).not.toHaveBeenCalled();
  });

  it('returns 429 cooldown without rotating token or sending email', async () => {
    const now = Date.now();
    const expiresAt = new Date(now - 5_000 + INVITE_TTL_MS);
    shopInviteFindFirst.mockResolvedValue(baseInvite({ expiresAt }));

    const res = await POST(makeContext('inv-1'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    const body = await res.json();
    expect(body.code).toBe('INVITATION_RESEND_COOLDOWN');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(shopInviteUpdate).not.toHaveBeenCalled();
    expect(sendShopTeamInviteEmail).not.toHaveBeenCalled();
  });

  it('Owner may resend Manager invitation', async () => {
    const invite = baseInvite({ role: 'MANAGER', email: 'mgr@example.com', barberId: null });
    shopInviteFindFirst.mockResolvedValue(invite);
    shopInviteUpdate.mockResolvedValue({
      ...invite,
      tokenHash: 'new-hash',
      expiresAt: new Date('2026-08-01T12:00:00.000Z'),
    });

    const res = await POST(makeContext('inv-1'));
    expect(res.status).toBe(200);
    expect(assertCanInviteRole).toHaveBeenCalledWith('OWNER', 'MANAGER');
  });
});
