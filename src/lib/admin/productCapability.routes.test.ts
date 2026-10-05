import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  prismaArgs: [] as Array<{ call: string; args: unknown[] }>,
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
        get: (_t, method) => (...args: unknown[]) => {
          state.prismaCalls.push(`${name}.${String(method)}`);
          state.prismaArgs.push({ call: `${name}.${String(method)}`, args });
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
    name: 'D GET /api/admin/clients/[clientId]/notes (nested)',
    load: () => import('@/pages/api/admin/clients/[clientId]/notes'),
    method: 'GET',
    url: 'http://localhost/api/admin/clients/client-1/notes',
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
    name: 'GET /api/admin/site-launch (branded site)',
    load: () => import('@/pages/api/admin/site-launch/index'),
    method: 'GET',
    url: 'http://localhost/api/admin/site-launch',
    capability: 'BRANDED_SITE',
  },
];

/** v1.18 Starter core: allowed on FREE_BOOKING, still denied to SETUP. */
const STARTER_CORE_ROUTES: GatedRoute[] = [
  {
    name: 'C GET /api/admin/clients (Clients Core)',
    load: () => import('@/pages/api/admin/clients'),
    method: 'GET',
    url: 'http://localhost/api/admin/clients',
    capability: 'CLIENTS_CORE',
  },
  {
    name: 'D GET /api/admin/clients/[clientId] (Clients Core profile)',
    load: () => import('@/pages/api/admin/clients/[clientId]/index'),
    method: 'GET',
    url: 'http://localhost/api/admin/clients/client-1',
    params: { clientId: 'client-1' },
    capability: 'CLIENTS_CORE',
  },
  {
    name: 'J GET /api/admin/bookings?view=history (rolling 90-day History)',
    load: () => import('@/pages/api/admin/bookings'),
    method: 'GET',
    url: 'http://localhost/api/admin/bookings?view=history&limit=25',
    capability: 'RECENT_BOOKING_HISTORY',
  },
  {
    name: 'J GET /api/admin/bookings (list without a day)',
    load: () => import('@/pages/api/admin/bookings'),
    method: 'GET',
    url: 'http://localhost/api/admin/bookings',
    capability: 'RECENT_BOOKING_HISTORY',
  },
];

const FREE_ROUTES: Omit<GatedRoute, 'capability'>[] = [
  {
    name: 'K GET /api/admin/bookings?range=today (current day)',
    load: () => import('@/pages/api/admin/bookings'),
    method: 'GET',
    url: 'http://localhost/api/admin/bookings?range=today',
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
  state.prismaArgs.length = 0;
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

describe('v1.18 Starter core: Clients Core and rolling History are Starter features', () => {
  describe.each(STARTER_CORE_ROUTES)('$name', (route) => {
    it('Starter passes the product gate and reaches the business layer', async () => {
      const { status, body } = await invoke(route);
      expect(status).not.toBe(403);
      expect(body?.code).not.toBe(KERSIVO_UPGRADE_REQUIRED);
      expect(state.prismaCalls.length).toBeGreaterThan(0);
    });

    it('SETUP is denied before any business operation', async () => {
      state.product = 'SETUP';
      const { status, body } = await invoke(route);
      expect(status).toBe(403);
      expect(body).toEqual({
        error: KERSIVO_UPGRADE_REQUIRED_MESSAGE,
        code: KERSIVO_UPGRADE_REQUIRED,
        requiredCapability: route.capability,
      });
      expect(state.prismaCalls).toEqual([]);
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

});

describe('SETUP tenants get no paid capabilities (capability matrix is authoritative)', () => {
  describe.each(PAID_ROUTES)('$name', (route) => {
    it('A–E: SETUP Owner with the RBAC permission is denied before any business operation', async () => {
      state.product = 'SETUP';
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

  const ONBOARDING_ROUTES: Omit<GatedRoute, 'capability'>[] = [
    {
      name: 'GET /api/admin/onboarding',
      load: () => import('@/pages/api/admin/onboarding/index'),
      method: 'GET',
      url: 'http://localhost/api/admin/onboarding',
    },
    {
      name: 'GET /api/admin/services',
      load: () => import('@/pages/api/admin/services'),
      method: 'GET',
      url: 'http://localhost/api/admin/services',
    },
    {
      name: 'GET /api/admin/barbers',
      load: () => import('@/pages/api/admin/barbers'),
      method: 'GET',
      url: 'http://localhost/api/admin/barbers',
    },
  ];

  describe.each(ONBOARDING_ROUTES)('H: $name', (route) => {
    it('core onboarding / setup routes keep working for SETUP', async () => {
      state.product = 'SETUP';
      const { body } = await invoke(route);
      expect(body?.code).not.toBe(KERSIVO_UPGRADE_REQUIRED);
      expect(state.prismaCalls.length).toBeGreaterThan(0);
    });
  });
});

describe('Starter rolling 90-day History is enforced server-side (Europe/London)', () => {
  const bookingsAt = (query: string) => ({
    load: () => import('@/pages/api/admin/bookings'),
    method: 'GET' as const,
    url: `http://localhost/api/admin/bookings?${query}`,
  });
  // London today 2026-10-04 → oldest Starter day 2026-07-06 (00:00 BST = 2026-07-05T23:00Z).
  const FLOOR_START = new Date('2026-07-05T23:00:00.000Z');

  const bookingFindManyWhere = () => {
    const call = state.prismaArgs.find((entry) => entry.call === 'booking.findMany');
    return (call?.args[0] as { where?: unknown } | undefined)?.where;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-04T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('K: Starter + today / upcoming days are allowed', async () => {
    for (const day of ['2026-10-04', '2026-10-05']) {
      const { body } = await invoke(bookingsAt(`date=${day}&mode=day`));
      expect(body?.code, day).not.toBe(KERSIVO_UPGRADE_REQUIRED);
    }
    expect(state.prismaCalls.length).toBeGreaterThan(0);
  });

  it('L: Starter + every day inside the rolling 90-day window is allowed', async () => {
    for (let daysAgo = 1; daysAgo <= 90; daysAgo += 1) {
      const day = new Date(Date.UTC(2026, 9, 4 - daysAgo)).toISOString().slice(0, 10);
      const { status, body } = await invoke(bookingsAt(`date=${day}&mode=day`));
      expect(status, day).not.toBe(403);
      expect(body?.code, day).not.toBe(KERSIVO_UPGRADE_REQUIRED);
    }
  });

  it('M + N: Starter cannot open or enumerate any day older than the window (Full required)', async () => {
    for (let daysAgo = 91; daysAgo <= 135; daysAgo += 1) {
      const day = new Date(Date.UTC(2026, 9, 4 - daysAgo)).toISOString().slice(0, 10);
      const { status, body } = await invoke(bookingsAt(`date=${day}&mode=day`));
      expect(status, day).toBe(403);
      expect(body, day).toEqual({
        error: KERSIVO_UPGRADE_REQUIRED_MESSAGE,
        code: KERSIVO_UPGRADE_REQUIRED,
        requiredCapability: 'FULL_BOOKING_HISTORY',
      });
    }
    expect(state.prismaCalls.filter((c) => c.startsWith('booking.'))).toEqual([]);
  });

  it('N: malformed / crafted dates are rejected before any query', async () => {
    for (const query of ['date=2026-10', 'date=yesterday', 'date=9999-99', 'view=history&from=2020-1-1&to=2026-10-04']) {
      const { status } = await invoke(bookingsAt(query));
      expect(status, query).toBe(400);
    }
    expect(state.prismaCalls.filter((c) => c.startsWith('booking.'))).toEqual([]);
  });

  it('N: "today" follows the London calendar, not UTC', async () => {
    // 23:30 UTC on 4 Oct is 00:30 BST on 5 Oct in London: the oldest Starter day becomes 7 Jul.
    vi.setSystemTime(new Date('2026-10-04T23:30:00.000Z'));
    expect((await invoke(bookingsAt('date=2026-07-06'))).status).toBe(403);
    const { body } = await invoke(bookingsAt('date=2026-07-07'));
    expect(body?.code).not.toBe(KERSIVO_UPGRADE_REQUIRED);
  });

  it('history view: search, date filters and pagination cursors are all floored for Starter', async () => {
    await invoke(
      bookingsAt('view=history&from=2020-01-01&to=2026-10-04&q=smith&cursor=2026-01-01T00:00:00.000Z|bk_1'),
    );
    const where = bookingFindManyWhere() as { AND: unknown[] };
    expect(where.AND).toContainEqual({ startAt: { gte: FLOOR_START } });
  });

  it('list without a day is floored for Starter', async () => {
    await invoke(bookingsAt(''));
    const where = bookingFindManyWhere() as { startAt: { gte: Date } };
    expect(where.startAt.gte).toEqual(FLOOR_START);
  });

  it('O: Full keeps unbounded historical dates and history', async () => {
    state.product = 'FULL_KERSIVO';
    const { body } = await invoke(bookingsAt('date=2026-01-01&mode=day'));
    expect(body?.code).not.toBe(KERSIVO_UPGRADE_REQUIRED);
    state.prismaArgs.length = 0;
    await invoke(bookingsAt('view=history&from=2020-01-01&to=2026-10-04'));
    const where = bookingFindManyWhere() as { AND: unknown[] };
    expect(where.AND).not.toContainEqual({ startAt: { gte: FLOOR_START } });
  });

  it('SETUP has no history at all', async () => {
    state.product = 'SETUP';
    const { status, body } = await invoke(bookingsAt('date=2026-10-03&mode=day'));
    expect(status).toBe(403);
    expect(body?.requiredCapability).toBe('RECENT_BOOKING_HISTORY');
  });

  it.each([
    ['guest preview', { via: 'preview' as const, userId: null }],
    ['legacy secret access', { via: 'secret' as const, userId: null }],
    ['public demo shop session', { shopId: DEMO_SHOP_ID }],
  ])('P: %s keeps historical dates unchanged', async (_label, overrides) => {
    state.access = ownerAccess(overrides);
    const { body } = await invoke(bookingsAt('date=2026-01-01&mode=day'));
    expect(body?.code).not.toBe(KERSIVO_UPGRADE_REQUIRED);
    expect(loadKersivoAccessSpy).not.toHaveBeenCalled();
  });
});
