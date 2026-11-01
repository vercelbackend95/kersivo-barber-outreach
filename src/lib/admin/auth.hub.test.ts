import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const getSession = vi.fn();
const resolvePreviewAccess = vi.fn();
const resolveHubAdminAccess = vi.fn();
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

vi.mock('@/lib/preview/shopPreviewSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/preview/shopPreviewSession')>();
  return {
    ...actual,
    resolvePreviewAccess: (...args: unknown[]) => resolvePreviewAccess(...args),
  };
});

vi.mock('@/lib/adminHub/hubAdminAccess', () => ({
  HUB_ADMIN_PERMISSIONS: ['catalog.manage', 'team.read', 'retail.manage'],
  resolveHubAdminAccess: (...args: unknown[]) => resolveHubAdminAccess(...args),
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

import { HUB_ADMIN_PERMISSIONS } from '@/lib/adminHub/hubAdminAccess';
import { isTenantAdminAccess, resolveAdminAccess } from './auth';

function makeCtx(): APIContext {
  return {
    request: new Request('http://localhost/api/admin/session'),
    cookies: { get: () => undefined },
  } as unknown as APIContext;
}

describe('resolveAdminAccess hub via', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(null);
    resolvePreviewAccess.mockResolvedValue(null);
    resolveHubAdminAccess.mockResolvedValue(null);
    resolveShopId.mockResolvedValue(null);
  });

  it('returns hub access when the hub cookie resolves to a draft shop', async () => {
    resolveHubAdminAccess.mockResolvedValue({
      shopId: 'shop_draft',
      userId: null,
      userName: null,
      userEmail: null,
      emailVerified: true,
      userImage: null,
      via: 'hub',
      role: 'OWNER',
      memberId: null,
      barberId: null,
      permissions: HUB_ADMIN_PERMISSIONS,
      previewRequestId: 'req_1',
    });
    const access = await resolveAdminAccess(makeCtx());
    expect(access).toMatchObject({
      shopId: 'shop_draft',
      via: 'hub',
      role: 'OWNER',
      userId: null,
      permissions: HUB_ADMIN_PERMISSIONS,
      previewRequestId: 'req_1',
    });
    expect(isTenantAdminAccess(access)).toBe(false);
  });

  it('returns null when hub access does not resolve and no other auth is present', async () => {
    expect(await resolveAdminAccess(makeCtx())).toBeNull();
  });

  it('prefers Better Auth session over hub access', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user_1', name: 'Alex', email: 'a@x.com', emailVerified: true, image: null },
    });
    getMembershipForUser.mockResolvedValue({
      id: 'mem_1',
      shopId: 'shop_session',
      role: 'OWNER',
      barberId: null,
    });
    resolveHubAdminAccess.mockResolvedValue({
      shopId: 'shop_draft',
      via: 'hub',
      role: 'OWNER',
      permissions: HUB_ADMIN_PERMISSIONS,
      previewRequestId: 'req_1',
    });

    const access = await resolveAdminAccess(makeCtx());
    expect(access).toMatchObject({ shopId: 'shop_session', via: 'session', userId: 'user_1' });
    expect(resolveHubAdminAccess).not.toHaveBeenCalled();
  });

  it('prefers the guest preview cookie over hub access', async () => {
    resolvePreviewAccess.mockResolvedValue({ shopId: 'shop_preview', sessionId: 'sess_1' });
    resolveHubAdminAccess.mockResolvedValue({
      shopId: 'shop_draft',
      via: 'hub',
      role: 'OWNER',
      permissions: HUB_ADMIN_PERMISSIONS,
      previewRequestId: 'req_1',
    });
    const access = await resolveAdminAccess(makeCtx());
    expect(access).toMatchObject({ shopId: 'shop_preview', via: 'preview' });
    expect(resolveHubAdminAccess).not.toHaveBeenCalled();
  });
});

describe('isTenantAdminAccess hub', () => {
  it('is false for via hub so existing tenant callers stay unchanged', () => {
    expect(
      isTenantAdminAccess({
        shopId: 's',
        userId: null,
        userName: null,
        userEmail: null,
        emailVerified: true,
        userImage: null,
        via: 'hub',
        role: 'OWNER',
        memberId: null,
        barberId: null,
        permissions: HUB_ADMIN_PERMISSIONS,
      }),
    ).toBe(false);
  });
});
