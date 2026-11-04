import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

/**
 * One active shop per request, whichever /admin tab or /api/admin route asks.
 * Regression for the "Viewing as KERSIVO" bug: an operator who also owns a shop saw the impersonated shop on
 * Overview but their OWN shop on Team / Services / Products, because the admin API preferred the operator's
 * Better Auth membership over the impersonation cookie.
 *
 * Mocks stop at the Prisma / Better Auth boundary; the resolvers, cookie signing and binding are real.
 */

const SECRET = 'active-shop-context-secret-0123456789';
const NOW = new Date('2026-11-04T12:00:00Z');
const WEEK = new Date(NOW.getTime() + 7 * 86_400_000);

type User = { id: string; email: string; name: string };
type Member = { id: string; shopId: string; userId: string; role: string; barberId: null; createdAt: Date };

const OPS: User = { id: 'u_ops', email: 'ops@kersivo.co.uk', name: 'Ops' };
const OWNER: User = { id: 'u_owner', email: 'owner@example.co.uk', name: 'Owner' };
const MULTI: User = { id: 'u_multi', email: 'multi@example.co.uk', name: 'Multi' };

const shops: Record<string, { id: string; ownerUserId: string | null }> = {
  shop_ops_own: { id: 'shop_ops_own', ownerUserId: OPS.id },
  shop_owner: { id: 'shop_owner', ownerUserId: OWNER.id },
  shop_m1: { id: 'shop_m1', ownerUserId: MULTI.id },
  shop_m2: { id: 'shop_m2', ownerUserId: 'someone_else' },
  shop_draft_A: { id: 'shop_draft_A', ownerUserId: null },
  shop_draft_B: { id: 'shop_draft_B', ownerUserId: null },
};

const members: Member[] = [
  { id: 'm_ops', shopId: 'shop_ops_own', userId: OPS.id, role: 'OWNER', barberId: null, createdAt: new Date('2026-01-01') },
  { id: 'm_owner', shopId: 'shop_owner', userId: OWNER.id, role: 'OWNER', barberId: null, createdAt: new Date('2026-02-01') },
  // Multi-shop user: joined shop_m2 as staff EARLIER than they created their own shop_m1.
  { id: 'm_multi2', shopId: 'shop_m2', userId: MULTI.id, role: 'BARBER', barberId: null, createdAt: new Date('2026-03-01') },
  { id: 'm_multi1', shopId: 'shop_m1', userId: MULTI.id, role: 'OWNER', barberId: null, createdAt: new Date('2026-04-01') },
];

const previewRequests: Record<string, { id: string; draftShopId: string; shopName: string }> = {
  req_A: { id: 'req_A', draftShopId: 'shop_draft_A', shopName: 'Barbarber' },
  req_B: { id: 'req_B', draftShopId: 'shop_draft_B', shopName: 'Fade Lab' },
};

let sessionUser: User | null = null;
const opsAllowlist = new Set([OPS.email]);

const pick = (m: Member) => ({ id: m.id, shopId: m.shopId, role: m.role, barberId: m.barberId });

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () =>
        sessionUser ? { user: { ...sessionUser, emailVerified: true, image: null } } : null,
    },
  },
}));

vi.mock('@/lib/ops/operatorAuth', () => ({
  resolveOperatorAccess: async () =>
    sessionUser && opsAllowlist.has(sessionUser.email)
      ? { ok: true, access: { userId: sessionUser.id, email: sessionUser.email } }
      : { ok: false, status: 403, code: 'FORBIDDEN' },
}));

vi.mock('@/lib/freePreview/hubPage', () => ({
  isAdminHubRouteEnabled: () => true,
  resolveHubContext: async (source: { cookie?: string | null; previewRequestId?: string }, opts: { isOperator: boolean; now: Date }) => {
    const { verifyHubSession } = await import('@/lib/adminHub/hubSession');
    const id = source.previewRequestId ?? verifyHubSession(source.cookie ?? null, opts.now)?.previewRequestId;
    const request = id ? previewRequests[id] : undefined;
    if (!request) return null;
    return {
      token: '',
      source: 'cookie',
      request: { ...request, expiresAt: WEEK },
      state: { kind: 'hub', stage: 'review', capabilities: {} },
      isOperator: opts.isOperator,
      draft: null,
    };
  },
}));

vi.mock('@/lib/freePreview/previewAccess', () => ({ resolvePreviewRequestByDraftShopId: async () => null }));
vi.mock('@/lib/preview/shopPreviewSession', () => ({ resolvePreviewAccess: async () => null, clearPreviewCookie: vi.fn() }));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopMember: {
      findUnique: async ({ where }: { where: { shopId_userId: { shopId: string; userId: string } } }) => {
        const { shopId, userId } = where.shopId_userId;
        const found = members.find((m) => m.shopId === shopId && m.userId === userId);
        return found ? pick(found) : null;
      },
      findFirst: async ({ where }: { where: { userId: string; shop?: { ownerUserId: string } } }) => {
        const rows = members
          .filter((m) => m.userId === where.userId)
          .filter((m) => !where.shop || shops[m.shopId]?.ownerUserId === where.shop.ownerUserId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return rows[0] ? pick(rows[0]) : null;
      },
      upsert: async () => null,
    },
    shopSettings: {
      findUnique: async ({ where }: { where: { id?: string } }) => (where.id ? (shops[where.id] ?? null) : null),
    },
    previewRequest: {
      findUnique: async () => ({ anonymisedAt: null }),
    },
  },
}));

import { getActiveShopContext, resolveAdminAccess } from './auth';
import { ACTIVE_SHOP_COOKIE_NAME } from './activeShopSelection';
import { adminSessionShopFor, resolveAdminPageMode } from '@/lib/adminHub/adminMode';
import { HUB_COOKIE_NAME, signHubSession } from '@/lib/adminHub/hubSession';
import { isHubAdminApiAllowed } from '@/lib/adminHub/hubAdminAccess';
import { readOperatorImpersonation } from '@/lib/adminHub/operatorImpersonation';
import { POST as leavePreview } from '@/pages/admin/leave-preview';
import { POST as adminLogout } from '@/pages/api/admin/logout';

const ADMIN_PAGES = ['/admin', '/admin/team', '/admin/services', '/admin/products', '/admin/website', '/admin/changes', '/admin/messages'];
const ADMIN_APIS = [
  '/api/admin/session',
  '/api/admin/team',
  '/api/admin/barbers',
  '/api/admin/services',
  '/api/admin/shop/products',
  '/api/admin/timeblocks',
];

function opsCookie(requestId: string, operatorEmail: string | null = OPS.email): string {
  return signHubSession({ previewRequestId: requestId, expiresAt: WEEK, operator: true, operatorEmail }, SECRET)!;
}

function ctx(path: string, cookies: Record<string, string> = {}): APIContext {
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  const request = new Request(`https://kersivo.co.uk${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  return {
    request,
    url: new URL(request.url),
    locals: {},
    cookies: { get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined), set: vi.fn() },
  } as unknown as APIContext;
}

async function pageShop(path: string, cookies: Record<string, string>) {
  const context = ctx(path, cookies);
  const mode = await resolveAdminPageMode({
    request: context.request,
    now: NOW,
    sessionShop: () => adminSessionShopFor(context),
  });
  if (!mode) return null;
  if (mode.kind === 'hub') return { kind: 'hub' as const, requestId: mode.ctx.request.id, shopId: mode.ctx.request.draftShopId };
  const own = await adminSessionShopFor(context);
  return { kind: 'full' as const, shopId: own?.shopId ?? null, setCookie: mode.setCookie };
}

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', SECRET);
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  sessionUser = null;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('getActiveShopContext — operator impersonation', () => {
  it('(1) an operator viewing shop A sees shop A on every /admin tab and every admin API, never their own shop', async () => {
    sessionUser = OPS;
    const cookies = { [HUB_COOKIE_NAME]: opsCookie('req_A') };

    for (const path of ADMIN_PAGES) {
      expect(await pageShop(path, cookies), path).toEqual({ kind: 'hub', requestId: 'req_A', shopId: 'shop_draft_A' });
    }
    for (const path of ADMIN_APIS) {
      const access = await getActiveShopContext(ctx(path, cookies));
      expect(access, path).toMatchObject({ shopId: 'shop_draft_A', via: 'hub', previewRequestId: 'req_A', userId: null });
    }
    expect(resolveAdminAccess).toBe(getActiveShopContext);
  });

  it('(1) the hub allowlist applies to the impersonating operator, so their own bookings, billing and settings are unreachable', async () => {
    sessionUser = OPS;
    const request = ctx('/api/admin/bookings', { [HUB_COOKIE_NAME]: opsCookie('req_A') }).request;
    expect(await readOperatorImpersonation(request, NOW)).not.toBeNull();
    expect(isHubAdminApiAllowed('GET', '/api/admin/bookings')).toBe(false);
    expect(isHubAdminApiAllowed('POST', '/api/admin/barbershop-settings')).toBe(false);
    expect(isHubAdminApiAllowed('GET', '/api/admin/team')).toBe(true);
  });

  it('(1) an operator cookie for a request that no longer resolves denies access instead of falling back', async () => {
    sessionUser = OPS;
    const access = await getActiveShopContext(ctx('/api/admin/team', { [HUB_COOKIE_NAME]: opsCookie('req_gone') }));
    expect(access).toBeNull();
  });

  it('(2) switching impersonation from A to B updates every tab and API with no stale shop A data', async () => {
    sessionUser = OPS;
    const a = { [HUB_COOKIE_NAME]: opsCookie('req_A') };
    const b = { [HUB_COOKIE_NAME]: opsCookie('req_B') };

    for (const path of ADMIN_APIS) expect((await getActiveShopContext(ctx(path, a)))?.shopId).toBe('shop_draft_A');
    for (const path of ADMIN_PAGES) expect((await pageShop(path, b))?.shopId, path).toBe('shop_draft_B');
    for (const path of ADMIN_APIS) {
      const access = await getActiveShopContext(ctx(path, b));
      expect(access, path).toMatchObject({ shopId: 'shop_draft_B', previewRequestId: 'req_B' });
    }
  });

  it('honours an operator cookie only for the operator it was minted for', async () => {
    const OTHER_OPS: User = { id: 'u_ops2', email: 'ops2@kersivo.co.uk', name: 'Ops 2' };
    opsAllowlist.add(OTHER_OPS.email);
    try {
      sessionUser = OTHER_OPS;
      const stolen = { [HUB_COOKIE_NAME]: opsCookie('req_A', OPS.email) };
      expect(await readOperatorImpersonation(ctx('/api/admin/team', stolen).request, NOW)).toBeNull();
      expect(await getActiveShopContext(ctx('/api/admin/team', stolen))).toBeNull();

      const legacyUnbound = { [HUB_COOKIE_NAME]: opsCookie('req_A', null) };
      sessionUser = OPS;
      expect(await readOperatorImpersonation(ctx('/api/admin/team', legacyUnbound).request, NOW)).toBeNull();
    } finally {
      opsAllowlist.delete(OTHER_OPS.email);
    }
  });

  it('(4) leaving the preview or logging out clears ks_hub and returns the operator to their own shop', async () => {
    sessionUser = OPS;
    const leave = await leavePreview({
      request: new Request('https://kersivo.co.uk/admin/leave-preview', {
        method: 'POST',
        headers: { origin: 'null', 'sec-fetch-site': 'same-origin' },
      }),
    } as unknown as APIContext);
    expect(leave.headers.get('set-cookie')).toMatch(/^ks_hub=; Max-Age=0; Path=\/; HttpOnly; Secure; SameSite=Lax/);

    const logoutCtx = ctx('/api/admin/logout');
    await adminLogout(logoutCtx);
    const cleared = (logoutCtx.cookies.set as ReturnType<typeof vi.fn>).mock.calls.map(([name, value, opts]) => ({ name, value, opts }));
    expect(cleared).toEqual(
      expect.arrayContaining([
        { name: HUB_COOKIE_NAME, value: '', opts: expect.objectContaining({ path: '/', maxAge: 0, httpOnly: true }) },
        { name: ACTIVE_SHOP_COOKIE_NAME, value: '', opts: expect.objectContaining({ path: '/', maxAge: 0 }) },
      ]),
    );

    // Cookie gone → the operator's own shop on every tab and API.
    for (const path of ADMIN_PAGES.filter((p) => p === '/admin')) {
      expect(await pageShop(path, {})).toMatchObject({ kind: 'full', shopId: 'shop_ops_own' });
    }
    for (const path of ADMIN_APIS) {
      expect(await getActiveShopContext(ctx(path))).toMatchObject({ shopId: 'shop_ops_own', via: 'session', role: 'OWNER' });
    }
  });
});

describe('getActiveShopContext — real shop owners', () => {
  it('(3) a normal owner only ever loads their own shop, whatever shop id they send', async () => {
    sessionUser = OWNER;
    const attempts: APIContext[] = [
      ctx('/api/admin/team'),
      ctx('/api/admin/team?shopId=shop_draft_A'),
      ctx('/api/admin/services?shopId=shop_ops_own'),
      ctx('/api/admin/team', { [ACTIVE_SHOP_COOKIE_NAME]: 'shop_ops_own' }),
      // A forged / borrowed operator cookie: the owner is not on the ops allowlist.
      ctx('/api/admin/team', { [HUB_COOKIE_NAME]: opsCookie('req_A', OWNER.email) }),
      ctx('/api/admin/team', { [HUB_COOKIE_NAME]: opsCookie('req_A') }),
    ];
    for (const attempt of attempts) {
      const access = await getActiveShopContext(attempt);
      expect(access, attempt.request.url).toMatchObject({ shopId: 'shop_owner', via: 'session', userId: OWNER.id });
    }
    for (const path of ADMIN_PAGES.filter((p) => p === '/admin')) {
      expect(await pageShop(path, { [HUB_COOKIE_NAME]: opsCookie('req_A') })).toMatchObject({ kind: 'full', shopId: 'shop_owner' });
    }
  });

  it('(3) an owner who belongs to two shops gets a stable default and only a shop they belong to', async () => {
    sessionUser = MULTI;
    // Default: the shop they own, not whichever membership row was touched last.
    expect((await getActiveShopContext(ctx('/api/admin/team')))?.shopId).toBe('shop_m1');
    // Explicit selection (set when an invite is accepted) is honoured for their own memberships…
    const selected = await getActiveShopContext(ctx('/api/admin/team', { [ACTIVE_SHOP_COOKIE_NAME]: 'shop_m2' }));
    expect(selected).toMatchObject({ shopId: 'shop_m2', role: 'BARBER' });
    // …and ignored for a shop they are not a member of.
    const forged = await getActiveShopContext(ctx('/api/admin/team', { [ACTIVE_SHOP_COOKIE_NAME]: 'shop_owner' }));
    expect(forged?.shopId).toBe('shop_m1');
  });
});
