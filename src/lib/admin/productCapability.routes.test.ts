import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import type { KersivoProductState } from '@/lib/shop/kersivoAccess';
import type { Permission } from './rbac/permissions';

type TestAccess = {
  shopId: string;
  userId: string | null;
  role: 'OWNER' | 'MANAGER' | 'BARBER';
  via: 'session' | 'preview' | 'secret';
  emailVerified: boolean;
  memberId: string | null;
  barberId: string | null;
  permissions: string[];
};

const state = vi.hoisted(() => ({
  access: null as unknown as TestAccess,
  product: 'FREE_BOOKING' as KersivoProductState,
  prismaCalls: [] as string[],
}));

const { loadKersivoAccessSpy, openaiCreate, checkDurableRateLimit } = vi.hoisted(() => ({
  loadKersivoAccessSpy: vi.fn(),
  openaiCreate: vi.fn(),
  checkDurableRateLimit: vi.fn(),
}));

vi.mock('@/lib/admin/auth', async () => {
  const canMod = await vi.importActual<typeof import('./rbac/can')>('./rbac/can');
  const authMod = await vi.importActual<typeof import('@/lib/admin/auth')>('@/lib/admin/auth');
  return {
    ...authMod,
    requireAdminContext: async () => state.access,
    resolveAdminAccess: async () => state.access,
    requireAdminPermission: async (_ctx: unknown, permission: Permission) =>
      canMod.requirePermission(state.access as never, permission) ?? state.access,
    requireVerifiedEmail: () => null,
  };
});

vi.mock('@/lib/shop/kersivoAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shop/kersivoAccess')>();
  return {
    ...actual,
    loadKersivoAccess: async (shopId: string) => {
      loadKersivoAccessSpy(shopId);
      return actual.accessForState(state.product);
    },
  };
});

vi.mock('@/lib/db/client', () => {
  const emptyResult = (method: string) => {
    if (method === 'findMany' || method === 'groupBy') return [];
    if (method === 'count') return 0;
    if (method === 'aggregate') return { _sum: {}, _count: { _all: 0 }, _avg: {} };
    return null;
  };
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method) => (..._args: unknown[]) => {
          state.prismaCalls.push(`${name}.${String(method)}`);
          return Promise.resolve(emptyResult(String(method)));
        },
      },
    );
  const prisma: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === 'then') return undefined;
        if (key === '$transaction') {
          return async (arg: unknown) => {
            state.prismaCalls.push('$transaction');
            return typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[]);
          };
        }
        if (typeof key === 'string' && key.startsWith('$')) {
          return async () => {
            state.prismaCalls.push(key);
            return [];
          };
        }
        return model(String(key));
      },
    },
  );
  return { prisma };
});

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: (...a: unknown[]) => openaiCreate(...a) } };
  },
}));

vi.mock('@/lib/rate-limit/durableRateLimit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit/durableRateLimit')>();
  return { ...actual, checkDurableRateLimit: (...a: unknown[]) => checkDurableRateLimit(...a) };
});

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: vi.fn(async () => null),
}));

import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { KERSIVO_UPGRADE_REQUIRED, KERSIVO_UPGRADE_REQUIRED_MESSAGE } from './productCapability';

type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RouteHandler = (ctx: APIContext) => Promise<Response> | Response;
type RouteModule = Partial<Record<RouteMethod, RouteHandler>>;

type GatedRoute = {
  name: string;
  load: () => Promise<RouteModule>;
  method: RouteMethod;
  url: string;
  params?: Record<string, string>;
  body?: unknown;
  capability: string;
};

function ctxFor(route: Pick<GatedRoute, 'method' | 'url' | 'params' | 'body'>): APIContext {
  const init: RequestInit = { method: route.method };
  if (route.body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(route.body);
  }
  const request = new Request(route.url, init);
  return {
    request,
    url: new URL(route.url),
    params: route.params ?? {},
    cookies: { get: () => undefined, set: () => undefined, delete: () => undefined },
    locals: {},
    clientAddress: '127.0.0.1',
  } as unknown as APIContext;
}

async function invoke(route: Pick<GatedRoute, 'load' | 'method' | 'url' | 'params' | 'body'>) {
  const mod = await route.load();
  const handler = mod[route.method];
  expect(handler).toBeTypeOf('function');
  try {
    const res = await handler!(ctxFor(route));
    const body = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, body };
  } catch {
    // Business layer ran against the empty Prisma mock and threw — the gate itself passed.
    return { status: -1, body: null };
  }
}

function ownerAccess(overrides: Partial<TestAccess> = {}): TestAccess {
  return {
    shopId: 'shop-1',
    userId: 'u1',
    role: 'OWNER',
    via: 'session',
    emailVerified: true,
    memberId: 'm1',
    barberId: null,
    permissions: [],
    ...overrides,
  };
}

const PAID_ROUTES: GatedRoute[] = [
  {
    name: 'A/B GET /api/admin/reports',
    load: () => import('@/pages/api/admin/reports'),
    method: 'GET',
    url: 'http://localhost/api/admin/reports?range=30d',
    capability: 'REPORTS',
  },
  {
    name: 'C GET /api/admin/clients',
    load: () => import('@/pages/api/admin/clients'),
    method: 'GET',
    url: 'http://localhost/api/admin/clients',
    capability: 'CLIENTS',
  },
  {
    name: 'D GET /api/admin/clients/[clientId]/notes (nested)',
    load: () => import('@/pages/api/admin/clients/[clientId]/notes'),
    method: 'GET',
    url: 'http://localhost/api/admin/clients/client-1/notes',
    params: { clientId: 'client-1' },
    capability: 'CLIENTS',
  },
  {
    name: 'D GET /api/admin/clients/[clientId] (nested)',
    load: () => import('@/pages/api/admin/clients/[clientId]/index'),
    method: 'GET',
    url: 'http://localhost/api/admin/clients/client-1',
    params: { clientId: 'client-1' },
    capability: 'CLIENTS',
  },
  {
    name: 'C POST /api/admin/clients/ensure',
    load: () => import('@/pages/api/admin/clients/ensure'),
    method: 'POST',
    url: 'http://localhost/api/admin/clients/ensure',
    body: { email: 'a@example.com', fullName: 'A' },
    capability: 'CLIENTS',
  },
  {
    name: 'E GET /api/admin/shop/products',
    load: () => import('@/pages/api/admin/shop/products/index'),
    method: 'GET',
    url: 'http://localhost/api/admin/shop/products',
    capability: 'RETAIL',
  },
  {
    name: 'F GET /api/admin/shop/orders',
    load: () => import('@/pages/api/admin/shop/orders/index'),
    method: 'GET',
    url: 'http://localhost/api/admin/shop/orders',
    capability: 'RETAIL',
  },
  {
    name: 'F GET /api/admin/shop/sales',
    load: () => import('@/pages/api/admin/shop/sales/index'),
    method: 'GET',
    url: 'http://localhost/api/admin/shop/sales',
    capability: 'RETAIL',
  },
  {
    name: 'G POST /api/admin/shop/products/create (retail mutation)',
    load: () => import('@/pages/api/admin/shop/products/create'),
    method: 'POST',
    url: 'http://localhost/api/admin/shop/products/create',
    body: { name: 'Pomade', pricePence: 1200 },
    capability: 'RETAIL',
  },
  {
    name: 'G PATCH /api/admin/barbershop-settings/retail (retail mutation)',
    load: () => import('@/pages/api/admin/barbershop-settings/retail'),
    method: 'PATCH',
    url: 'http://localhost/api/admin/barbershop-settings/retail',
    body: { collectionEnabled: true },
    capability: 'RETAIL',
  },
  {
    name: 'H POST /api/admin/ai/chat',
    load: () => import('@/pages/api/admin/ai/chat'),
    method: 'POST',
    url: 'http://localhost/api/admin/ai/chat',
    body: { messages: [{ role: 'user', content: 'How was last week?' }] },
    capability: 'ASSISTANT',
  },
  {
    name: 'J GET /api/admin/bookings?view=history',
    load: () => import('@/pages/api/admin/bookings'),
    method: 'GET',
    url: 'http://localhost/api/admin/bookings?view=history&limit=25',
    capability: 'FULL_BOOKING_HISTORY',
  },
  {
    name: 'J GET /api/admin/bookings (unbounded list)',
    load: () => import('@/pages/api/admin/bookings'),
    method: 'GET',
    url: 'http://localhost/api/admin/bookings',
    capability: 'FULL_BOOKING_HISTORY',
  },
  {
    name: 'GET /api/admin/site-launch (branded site)',
    load: () => import('@/pages/api/admin/site-launch/index'),
    method: 'GET',
    url: 'http://localhost/api/admin/site-launch',
    capability: 'BRANDED_SITE',
  },
];

const FREE_ROUTES: Omit<GatedRoute, 'capability'>[] = [
  {
    name: 'K GET /api/admin/bookings?date= (current day)',
    load: () => import('@/pages/api/admin/bookings'),
    method: 'GET',
    url: 'http://localhost/api/admin/bookings?date=2026-10-04&mode=day',
  },
  {
    name: 'K GET /api/admin/bookings?view=stats',
    load: () => import('@/pages/api/admin/bookings'),
    method: 'GET',
    url: 'http://localhost/api/admin/bookings?view=stats&barberId=b1',
  },
  {
    name: 'L GET /api/admin/services',
    load: () => import('@/pages/api/admin/services'),
    method: 'GET',
    url: 'http://localhost/api/admin/services',
  },
  {
    name: 'M GET /api/admin/barbers',
    load: () => import('@/pages/api/admin/barbers'),
    method: 'GET',
    url: 'http://localhost/api/admin/barbers',
  },
  {
    name: 'M GET /api/admin/barbers/[id]/rules (availability)',
    load: () => import('@/pages/api/admin/barbers/[id]/rules'),
    method: 'GET',
    url: 'http://localhost/api/admin/barbers/b1/rules',
    params: { id: 'b1' },
  },
  {
    name: 'N GET /api/admin/barbershop-settings/deposits (booking payments)',
    load: () => import('@/pages/api/admin/barbershop-settings/deposits'),
    method: 'GET',
    url: 'http://localhost/api/admin/barbershop-settings/deposits',
  },
  {
    name: 'N GET /api/admin/barbershop-settings/retail (settings panel read)',
    load: () => import('@/pages/api/admin/barbershop-settings/retail'),
    method: 'GET',
    url: 'http://localhost/api/admin/barbershop-settings/retail',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  state.prismaCalls.length = 0;
  state.access = ownerAccess();
  state.product = 'FREE_BOOKING';
  checkDurableRateLimit.mockResolvedValue({ ok: true });
});

describe('Free Booking is denied paid admin APIs before any business operation', () => {
  describe.each(PAID_ROUTES)('$name', (route) => {
    it('returns 403 KERSIVO_UPGRADE_REQUIRED and touches nothing', async () => {
      const { status, body } = await invoke(route);
      expect(status).toBe(403);
      expect(body).toEqual({
        error: KERSIVO_UPGRADE_REQUIRED_MESSAGE,
        code: KERSIVO_UPGRADE_REQUIRED,
        requiredCapability: route.capability,
      });
      expect(state.prismaCalls).toEqual([]);
      expect(openaiCreate).not.toHaveBeenCalled();
      expect(checkDurableRateLimit).not.toHaveBeenCalled();
    });
  });

  it('H: the assistant is denied before the rate limit and OpenAI', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    try {
      const { status } = await invoke(PAID_ROUTES.find((r) => r.capability === 'ASSISTANT')!);
      expect(status).toBe(403);
      expect(checkDurableRateLimit).not.toHaveBeenCalled();
      expect(openaiCreate).not.toHaveBeenCalled();
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  });
});

describe('Free Booking keeps its booking core (K–N)', () => {
  describe.each(FREE_ROUTES)('$name', (route) => {
    it('passes the gate and reaches the business layer', async () => {
      const { body } = await invoke(route);
      expect(body?.code).not.toBe(KERSIVO_UPGRADE_REQUIRED);
      expect(state.prismaCalls.length).toBeGreaterThan(0);
    });
  });
});

describe('Q: Full KERSIVO is unchanged', () => {
  describe.each(PAID_ROUTES)('$name', (route) => {
    it('passes the product gate', async () => {
      state.product = 'FULL_KERSIVO';
      const { status, body } = await invoke(route);
      expect(body?.code).not.toBe(KERSIVO_UPGRADE_REQUIRED);
      expect(status).not.toBe(403);
      expect(loadKersivoAccessSpy).toHaveBeenCalledWith('shop-1');
    });
  });

  it('B: Full reports reach the reporting queries', async () => {
    state.product = 'FULL_KERSIVO';
    await invoke(PAID_ROUTES[0]!);
    expect(state.prismaCalls.length).toBeGreaterThan(0);
  });

  it('H: Full assistant proceeds to the rate limit', async () => {
    state.product = 'FULL_KERSIVO';
    await invoke(PAID_ROUTES.find((r) => r.capability === 'ASSISTANT')!);
    expect(checkDurableRateLimit).toHaveBeenCalled();
  });
});

describe('R: RBAC is enforced independently of the plan', () => {
  it.each(['FREE_BOOKING', 'FULL_KERSIVO'] as const)(
    'a BARBER without reports.view is denied by RBAC on %s (no upgrade prompt, plan never loaded)',
    async (product) => {
      state.product = product;
      state.access = ownerAccess({ role: 'BARBER', barberId: 'b1' });
      const { status, body } = await invoke(PAID_ROUTES[0]!);
      expect(status).toBe(403);
      expect(body?.code).not.toBe(KERSIVO_UPGRADE_REQUIRED);
      expect(loadKersivoAccessSpy).not.toHaveBeenCalled();
      expect(state.prismaCalls).toEqual([]);
    },
  );

  it('a Full capability never grants a missing permission', async () => {
    state.product = 'FULL_KERSIVO';
    state.access = ownerAccess({ role: 'BARBER', barberId: 'b1' });
    const { status } = await invoke(PAID_ROUTES.find((r) => r.name.startsWith('E '))!);
    expect(status).toBe(403);
  });
});

describe('O: public booking and public retail never consult the admin product gate', () => {
  it('no public / storefront API route imports the admin capability gate', () => {
    const root = path.resolve(__dirname, '../../pages/api');
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      });
    const publicRoutes = [...walk(path.join(root, 'public')), ...walk(path.join(root, 'shop'))].filter(
      (file) => file.endsWith('.ts') && !/\.test\.ts$/.test(file),
    );
    expect(publicRoutes.some((file) => file.includes(path.join('public', 'bookings')))).toBe(true);
    for (const file of publicRoutes) {
      expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/productCapability/);
    }
  });
});

describe('S: demo, preview and legacy access are not plan-locked', () => {
  it.each([
    ['guest preview', { via: 'preview' as const, userId: null }],
    ['legacy secret access', { via: 'secret' as const, userId: null }],
    ['public demo shop session', { shopId: DEMO_SHOP_ID }],
  ])('%s reaches paid admin APIs without loading the plan', async (_label, overrides) => {
    state.access = ownerAccess(overrides);
    const { body } = await invoke(PAID_ROUTES[0]!);
    expect(body?.code).not.toBe(KERSIVO_UPGRADE_REQUIRED);
    expect(loadKersivoAccessSpy).not.toHaveBeenCalled();
  });

  it('SETUP tenants keep their current onboarding behaviour (not plan-locked)', async () => {
    state.product = 'SETUP';
    const { body } = await invoke(PAID_ROUTES.find((r) => r.name.startsWith('E '))!);
    expect(body?.code).not.toBe(KERSIVO_UPGRADE_REQUIRED);
    expect(state.prismaCalls.length).toBeGreaterThan(0);
  });
});
