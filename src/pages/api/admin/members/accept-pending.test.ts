import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { EMAIL_VERIFICATION_REQUIRED_MESSAGE } from '@/lib/admin/auth';

const getSession = vi.fn();
const findFirstInvite = vi.fn();
const acceptInviteForUser = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopInvite: {
      findFirst: (...args: unknown[]) => findFirstInvite(...args),
    },
  },
}));

vi.mock('@/lib/admin/rbac/members', () => ({
  acceptInviteForUser: (...args: unknown[]) => acceptInviteForUser(...args),
}));

import { POST } from './accept-pending';

function makeContext(): APIContext {
  return {
    request: new Request('http://localhost/api/admin/members/accept-pending', { method: 'POST' }),
  } as unknown as APIContext;
}

describe('POST /api/admin/members/accept-pending', () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirstInvite.mockReset();
    acceptInviteForUser.mockReset();
  });

  it('returns 401 without a session', async () => {
    getSession.mockResolvedValue(null);
    const res = await POST(makeContext() as never);
    expect(res.status).toBe(401);
    expect(findFirstInvite).not.toHaveBeenCalled();
  });

  it('refuses an unverified session even when an invite matches the email', async () => {
    getSession.mockResolvedValue({
      user: {
        id: 'attacker-1',
        email: 'victim@example.com',
        emailVerified: false,
      },
    });

    const res = await POST(makeContext() as never);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(body.error).toBe(EMAIL_VERIFICATION_REQUIRED_MESSAGE);
    expect(findFirstInvite).not.toHaveBeenCalled();
    expect(acceptInviteForUser).not.toHaveBeenCalled();
  });

  it('accepts the newest open invite for a verified session email', async () => {
    getSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'barber@example.com',
        emailVerified: true,
      },
    });
    const invite = {
      id: 'inv-1',
      shopId: 'shop-1',
      email: 'barber@example.com',
      role: 'BARBER',
      barberId: 'b1',
    };
    findFirstInvite.mockResolvedValue(invite);
    acceptInviteForUser.mockResolvedValue({
      ok: true,
      shopId: 'shop-1',
      role: 'BARBER',
      alreadyMember: false,
    });

    const res = await POST(makeContext() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, shopId: 'shop-1', role: 'BARBER' });
    expect(acceptInviteForUser).toHaveBeenCalledWith(invite, 'user-1');
  });
});
