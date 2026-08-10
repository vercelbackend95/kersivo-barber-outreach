import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const getSession = vi.fn();
const resolvePreviewAccess = vi.fn();
const getMembershipForUser = vi.fn();
const getShopIdForUser = vi.fn();
const ensureOwnerMembership = vi.fn();
const resolveShopId = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}));

vi.mock('@/lib/preview/shopPreviewSession', () => ({
  resolvePreviewAccess: (...args: unknown[]) => resolvePreviewAccess(...args),
}));

vi.mock('@/lib/auth/provisionShop', () => ({
  getMembershipForUser: (...args: unknown[]) => getMembershipForUser(...args),
  getShopIdForUser: (...args: unknown[]) => getShopIdForUser(...args),
  ensureOwnerMembership: (...args: unknown[]) => ensureOwnerMembership(...args),
}));

vi.mock('@/lib/db/shopScope', () => ({
  DEMO_SHOP_ID: 'demo-shop',
  resolveShopId: (...args: unknown[]) => resolveShopId(...args),
}));

vi.mock('@/lib/admin/session', () => ({
  getAdminSessionCookieName: () => 'kersivo_admin_session',
  getSessionSecret: () => null,
  parseAdminSessionToken: () => null,
}));

import { isTenantAdminAccess, resolveAdminAccess } from './auth';

function makeCtx(): APIContext {
  return {
    request: new Request('http://localhost/api/admin/session'),
    cookies: { get: () => undefined },
  } as unknown as APIContext;
}

describe('resolveAdminAccess preview via', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(null);
    resolvePreviewAccess.mockResolvedValue(null);
    resolveShopId.mockResolvedValue(null);
  });

  it('returns preview access for valid preview cookie', async () => {
    resolvePreviewAccess.mockResolvedValue({ shopId: 'shop_preview', sessionId: 'sess_1' });
    const access = await resolveAdminAccess(makeCtx());
    expect(access).toMatchObject({
      shopId: 'shop_preview',
      via: 'preview',
      role: 'OWNER',
      userId: null,
    });
    expect(isTenantAdminAccess(access)).toBe(true);
  });

  it('returns null when preview cookie missing and no other auth', async () => {
    const access = await resolveAdminAccess(makeCtx());
    expect(access).toBeNull();
  });

  it('prefers Better Auth session over preview cookie', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user_1', name: 'Alex', email: 'a@x.com', emailVerified: true, image: null },
    });
    getMembershipForUser.mockResolvedValue({
      id: 'mem_1',
      shopId: 'shop_session',
      role: 'OWNER',
      barberId: null,
    });
    resolvePreviewAccess.mockResolvedValue({ shopId: 'shop_preview', sessionId: 'sess_1' });

    const access = await resolveAdminAccess(makeCtx());
    expect(access).toMatchObject({ shopId: 'shop_session', via: 'session', userId: 'user_1' });
    expect(resolvePreviewAccess).not.toHaveBeenCalled();
  });
});

describe('isTenantAdminAccess', () => {
  it('is true for session and preview only', () => {
    expect(
      isTenantAdminAccess({
        shopId: 's',
        userId: 'u',
        userName: null,
        userEmail: null,
        emailVerified: true,
        userImage: null,
        via: 'session',
        role: 'OWNER',
        memberId: null,
        barberId: null,
        permissions: [],
      }),
    ).toBe(true);
    expect(
      isTenantAdminAccess({
        shopId: 's',
        userId: null,
        userName: null,
        userEmail: null,
        emailVerified: true,
        userImage: null,
        via: 'preview',
        role: 'OWNER',
        memberId: null,
        barberId: null,
        permissions: [],
      }),
    ).toBe(true);
    expect(
      isTenantAdminAccess({
        shopId: 'demo',
        userId: null,
        userName: null,
        userEmail: null,
        emailVerified: true,
        userImage: null,
        via: 'secret',
        role: 'OWNER',
        memberId: null,
        barberId: null,
        permissions: [],
      }),
    ).toBe(false);
  });
});
