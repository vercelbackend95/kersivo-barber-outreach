import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const resolveHubContext = vi.fn();
const isAdminHubRouteEnabled = vi.fn();
const resolveOperatorAccess = vi.fn();
const previewFindUnique = vi.fn();
const shopFindUnique = vi.fn();
const eventFindFirst = vi.fn();
const eventCreate = vi.fn();

vi.mock('@/lib/freePreview/hubPage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubPage')>();
  return {
    ...actual,
    resolveHubContext: (...args: unknown[]) => resolveHubContext(...args),
    isAdminHubRouteEnabled: () => isAdminHubRouteEnabled(),
  };
});

vi.mock('@/lib/ops/operatorAuth', () => ({
  resolveOperatorAccess: (...args: unknown[]) => resolveOperatorAccess(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewRequest: { findUnique: (...a: unknown[]) => previewFindUnique(...a) },
    shopSettings: { findUnique: (...a: unknown[]) => shopFindUnique(...a) },
    previewRequestEvent: {
      findFirst: (...a: unknown[]) => eventFindFirst(...a),
      create: (...a: unknown[]) => eventCreate(...a),
    },
  },
}));

import { signHubSession } from './hubSession';
import {
  HUB_ADMIN_API_ALLOWLIST,
  HUB_ADMIN_PERMISSIONS,
  HUB_ADMIN_UNAVAILABLE_MESSAGE,
  HUB_INVITE_FORBIDDEN_MESSAGE,
  HUB_OWNER_EDIT_DEBOUNCE_MS,
  denyHubInvite,
  isAdminApiPath,
  isHubAdminApiAllowed,
  isHubOnlyAdminApiRequest,
  recordHubOwnerAdminEdit,
  resolveHubAdminAccess,
} from './hubAdminAccess';

const SECRET = 'hub-admin-access-test-secret-0123456789';
const NOW = new Date('2026-11-01T12:00:00Z');
const WEEK = new Date(NOW.getTime() + 7 * 86_400_000);

function cookie(input: { id?: string; operator?: boolean } = {}) {
  return signHubSession(
    { previewRequestId: input.id ?? 'req_1', expiresAt: WEEK, operator: input.operator },
    SECRET,
  )!;
}

function ctxWith(cookieValue: string | null): APIContext {
  const headers = new Headers();
  if (cookieValue) headers.set('cookie', `ks_hub=${cookieValue}`);
  return {
    request: new Request('http://localhost/api/admin/services', { headers }),
    cookies: { get: () => undefined },
  } as unknown as APIContext;
}

function hubCtx(stage: string, draftShopId: string | null = 'shop_draft') {
  return {
    token: '',
    source: 'cookie',
    request: { id: 'req_1', draftShopId, expiresAt: WEEK },
    state: { kind: 'hub', stage, capabilities: {} },
    isOperator: false,
    draft: null,
  };
}

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', SECRET);
  vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
  vi.stubEnv('ADMIN_HUB_ENABLED', 'true');
  isAdminHubRouteEnabled.mockReturnValue(true);
  resolveHubContext.mockReset().mockResolvedValue(hubCtx('review'));
  resolveOperatorAccess.mockReset().mockResolvedValue({ ok: false });
  previewFindUnique.mockReset().mockResolvedValue({ anonymisedAt: null });
  shopFindUnique.mockReset().mockResolvedValue({ id: 'shop_draft', ownerUserId: null });
  eventFindFirst.mockReset().mockResolvedValue(null);
  eventCreate.mockReset().mockResolvedValue({ id: 'evt_1' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('HUB_ADMIN_API_ALLOWLIST', () => {
  it('allows every allowlisted method+path and GET /api/admin/session', () => {
    for (const entry of HUB_ADMIN_API_ALLOWLIST) {
      const path = entry.path.replace(':id', 'svc_1').replace(':barberId', 'barber_1');
      expect(isHubAdminApiAllowed(entry.method, path), `${entry.method} ${path}`).toBe(true);
    }
    expect(isHubAdminApiAllowed('GET', '/api/admin/session')).toBe(true);
    expect(isHubAdminApiAllowed('GET', '/api/admin/session/')).toBe(true);
  });

  it('does not treat static catalogue paths as :id patterns', () => {
    expect(isHubAdminApiAllowed('POST', '/api/admin/services/reorder')).toBe(true);
    expect(isHubAdminApiAllowed('POST', '/api/admin/barbers/delete')).toBe(true);
    expect(isHubAdminApiAllowed('POST', '/api/admin/shop/products/create')).toBe(true);
    expect(isHubAdminApiAllowed('PATCH', '/api/admin/shop/products/prod_1')).toBe(true);
    expect(isHubAdminApiAllowed('GET', '/api/admin/team/shop-hours')).toBe(true);
    expect(isHubAdminApiAllowed('POST', '/api/admin/team/booking-profiles')).toBe(true);
  });

  it('denies bookings, clients, reports, invites, settings, billing, AI and retail onboarding', () => {
    const denied: Array<[string, string]> = [
      ['GET', '/api/admin/bookings'],
      ['POST', '/api/admin/bookings/cancel'],
      ['GET', '/api/admin/clients'],
      ['GET', '/api/admin/reports'],
      ['POST', '/api/admin/team/invite'],
      ['POST', '/api/admin/members/invite'],
      ['POST', '/api/admin/team/invitations/inv_1/resend'],
      ['GET', '/api/admin/barbershop-settings'],
      ['PATCH', '/api/admin/barbershop-settings/pause'],
      ['POST', '/api/admin/subscription/upgrade-checkout'],
      ['GET', '/api/admin/site-launch'],
      ['POST', '/api/admin/ai/chat'],
      ['POST', '/api/admin/retail-onboarding/reset'],
      ['PATCH', '/api/admin/barbershop-settings/retail'],
      ['GET', '/api/admin/shop/orders'],
    ];
    for (const [method, path] of denied) {
      expect(isHubAdminApiAllowed(method, path), `${method} ${path}`).toBe(false);
    }
  });

  it('never uses a /api/admin/* prefix wildcard', () => {
    expect(HUB_ADMIN_API_ALLOWLIST.some((entry) => entry.path === '/api/admin/*')).toBe(false);
    expect(HUB_ADMIN_API_ALLOWLIST.some((entry) => entry.path.endsWith('/*'))).toBe(false);
  });
});

describe('isAdminApiPath', () => {
  it('matches /api/admin and /api/admin/... only', () => {
    expect(isAdminApiPath('/api/admin')).toBe(true);
    expect(isAdminApiPath('/api/admin/')).toBe(true);
    expect(isAdminApiPath('/api/admin/services')).toBe(true);
    expect(isAdminApiPath('/api/admin-hub/assets')).toBe(false);
    expect(isAdminApiPath('/api/admin-demo/x')).toBe(false);
    expect(isAdminApiPath('/api/administrator')).toBe(false);
  });
});

describe('isHubOnlyAdminApiRequest', () => {
  it('is true for a valid hub cookie alone', () => {
    const request = new Request('http://localhost/api/admin/services', {
      headers: { cookie: `ks_hub=${cookie()}` },
    });
    expect(isHubOnlyAdminApiRequest(request, NOW)).toBe(true);
  });

  it('is false when a Better Auth or preview cookie is also present', () => {
    const hub = cookie();
    expect(
      isHubOnlyAdminApiRequest(
        new Request('http://localhost/api/admin/services', {
          headers: { cookie: `ks_hub=${hub}; better-auth.session_token=abc` },
        }),
        NOW,
      ),
    ).toBe(false);
    expect(
      isHubOnlyAdminApiRequest(
        new Request('http://localhost/api/admin/services', {
          headers: { cookie: `ks_hub=${hub}; kersivo_shop_preview=tok` },
        }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe('resolveHubAdminAccess', () => {
  it('grants via hub with the draft shop and restricted permissions', async () => {
    const access = await resolveHubAdminAccess(ctxWith(cookie()), NOW);
    expect(access).toMatchObject({
      shopId: 'shop_draft',
      via: 'hub',
      role: 'OWNER',
      userId: null,
      previewRequestId: 'req_1',
      permissions: HUB_ADMIN_PERMISSIONS,
    });
  });

  it('returns null when there is no draft shop', async () => {
    resolveHubContext.mockResolvedValue(hubCtx('review', null));
    expect(await resolveHubAdminAccess(ctxWith(cookie()), NOW)).toBeNull();
  });

  it('returns null when the draft shop already has an owner', async () => {
    shopFindUnique.mockResolvedValue({ id: 'shop_draft', ownerUserId: 'user_1' });
    expect(await resolveHubAdminAccess(ctxWith(cookie()), NOW)).toBeNull();
  });

  it('returns null for expired, declined, launch and rejected stages', async () => {
    for (const stage of ['expired', 'declined', 'launch', 'live']) {
      resolveHubContext.mockResolvedValue(hubCtx(stage));
      expect(await resolveHubAdminAccess(ctxWith(cookie()), NOW), stage).toBeNull();
    }
    resolveHubContext.mockResolvedValue(null);
    expect(await resolveHubAdminAccess(ctxWith(cookie()), NOW)).toBeNull();
  });

  it('returns null for an anonymised request', async () => {
    previewFindUnique.mockResolvedValue({ anonymisedAt: NOW });
    expect(await resolveHubAdminAccess(ctxWith(cookie()), NOW)).toBeNull();
  });

  it('returns null for an operator cookie without a live operator session', async () => {
    resolveOperatorAccess.mockResolvedValue({ ok: false });
    expect(await resolveHubAdminAccess(ctxWith(cookie({ operator: true })), NOW)).toBeNull();
    expect(resolveHubContext).not.toHaveBeenCalled();
  });

  it('grants operator hub access when the operator session is live', async () => {
    resolveOperatorAccess.mockResolvedValue({ ok: true, access: { userId: 'ops', email: 'ops@kersivo.co.uk' } });
    const access = await resolveHubAdminAccess(ctxWith(cookie({ operator: true })), NOW);
    expect(access?.via).toBe('hub');
    expect(resolveHubContext).toHaveBeenCalledWith(
      { cookie: cookie({ operator: true }) },
      { isOperator: true, now: NOW },
    );
  });
});

describe('denyHubInvite', () => {
  it('returns the live-shop invite message for hub access only', async () => {
    const denied = denyHubInvite({ via: 'hub' });
    expect(denied).toBeInstanceOf(Response);
    expect(denied!.status).toBe(403);
    expect(await denied!.json()).toEqual({ error: HUB_INVITE_FORBIDDEN_MESSAGE });
    expect(denyHubInvite({ via: 'session' })).toBeNull();
  });
});

describe('recordHubOwnerAdminEdit', () => {
  it('records one debounced event per section and skips operators and GETs', async () => {
    const hub = cookie();
    const request = new Request('http://localhost/api/admin/services', {
      method: 'POST',
      headers: { cookie: `ks_hub=${hub}` },
    });
    await recordHubOwnerAdminEdit({ request, pathname: '/api/admin/services', method: 'POST', now: NOW });
    expect(eventCreate).toHaveBeenCalledTimes(1);
    expect(eventCreate.mock.calls[0]?.[0]).toMatchObject({
      data: { previewRequestId: 'req_1', action: 'OWNER_EDITED_SERVICES' },
    });

    eventFindFirst.mockResolvedValue({ id: 'evt_1' });
    await recordHubOwnerAdminEdit({ request, pathname: '/api/admin/services', method: 'POST', now: NOW });
    expect(eventCreate).toHaveBeenCalledTimes(1);

    await recordHubOwnerAdminEdit({
      request,
      pathname: '/api/admin/services',
      method: 'GET',
      now: NOW,
    });
    expect(eventCreate).toHaveBeenCalledTimes(1);

    const opRequest = new Request('http://localhost/api/admin/barbers', {
      method: 'POST',
      headers: { cookie: `ks_hub=${cookie({ operator: true })}` },
    });
    await recordHubOwnerAdminEdit({
      request: opRequest,
      pathname: '/api/admin/barbers',
      method: 'POST',
      now: NOW,
    });
    expect(eventCreate).toHaveBeenCalledTimes(1);
    expect(HUB_OWNER_EDIT_DEBOUNCE_MS).toBe(10 * 60 * 1000);
  });
});

describe('middleware wiring', () => {
  it('enforces the hub allowlist and records owner edits on successful writes', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/middleware.ts'), 'utf8');
    expect(src).toContain('isHubOnlyAdminApiRequest');
    expect(src).toContain('isHubAdminApiAllowed');
    expect(src).toContain('isAdminApiPath');
    expect(src).toContain('hubAdminUnavailableResponse');
    expect(src).toContain('recordHubOwnerAdminEdit');
    expect(src).toContain('isPreviewHubAllowedPath');
    expect(src).not.toMatch(/startsWith\(ADMIN_API_PREFIX\)/);
    expect(src).not.toMatch(/startsWith\(['"]\/api\/admin['"]\)/);
    expect(HUB_ADMIN_UNAVAILABLE_MESSAGE).toBe('Not available in your preview.');
  });
});
