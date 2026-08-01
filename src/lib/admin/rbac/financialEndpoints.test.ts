import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import type { ShopRole } from '@prisma/client';
import { can } from './can';
import type { Permission } from './permissions';

type AdminAccess = {
  shopId: string;
  userId: string;
  role: ShopRole;
  via: 'session';
  emailVerified: boolean;
};

let currentAccess: AdminAccess;

const createConnectExpressAccount = vi.fn();
const createConnectAccountLink = vi.fn();
const createCheckoutSession = vi.fn();
const createBillingPortalSession = vi.fn();
const cancelSubscriptionAtPeriodEnd = vi.fn();
const approveSiteLaunch = vi.fn();
const orderDeleteMany = vi.fn();
const productDeleteMany = vi.fn();
const transaction = vi.fn();

function accessFor(role: ShopRole): AdminAccess {
  return {
    shopId: 'shop-1',
    userId: 'u1',
    role,
    via: 'session',
    emailVerified: true,
  };
}

vi.mock('@/lib/admin/auth', async () => {
  const canMod = await vi.importActual<typeof import('./can')>('./can');
  return {
    requireAdminContext: async () => currentAccess,
    resolveAdminAccess: async () => currentAccess,
    requireAdminPermission: async (_ctx: unknown, permission: Permission) =>
      canMod.requirePermission(currentAccess, permission) ?? currentAccess,
    requireVerifiedEmail: () => null,
  };
});

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    saasSubscription: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    order: {
      deleteMany: (...args: unknown[]) => orderDeleteMany(...args),
    },
    product: {
      deleteMany: (...args: unknown[]) => productDeleteMany(...args),
    },
    siteLaunchEvent: {
      create: vi.fn(),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/shop/stripe', () => ({
  createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args),
  createBillingPortalSession: (...args: unknown[]) => createBillingPortalSession(...args),
  cancelSubscriptionAtPeriodEnd: (...args: unknown[]) => cancelSubscriptionAtPeriodEnd(...args),
}));

vi.mock('@/lib/shop/stripeConnect', () => ({
  createConnectExpressAccount: (...args: unknown[]) => createConnectExpressAccount(...args),
  createConnectAccountLink: (...args: unknown[]) => createConnectAccountLink(...args),
  retrieveConnectAccount: vi.fn(),
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: vi.fn(async () => null),
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.co.uk',
}));

vi.mock('@/lib/setup/siteLaunch', () => ({
  approveSiteLaunch: (...args: unknown[]) => approveSiteLaunch(...args),
  getSiteLaunchStatus: vi.fn(() => ({ state: 'pending' })),
}));

vi.mock('@/lib/setup/saasDataExport', () => ({
  buildShopClientBookingCsv: vi.fn(() => 'csv'),
}));

vi.mock('@/lib/setup/saasEntitlement', () => ({
  saasSubscriptionAllowsDataExport: vi.fn(() => true),
}));

vi.mock('@/lib/admin/onboarding', () => ({
  linkAllServicesToAllBarbers: vi.fn(),
}));

vi.mock('@/lib/setup/saasSubscriptionLifecycle', () => ({
  applyStripeSubscriptionToSaasRecord: vi.fn(),
}));

vi.mock('@/lib/setup/accountLifecycleAudit', () => ({
  ACCOUNT_LIFECYCLE_ACTIONS: { CANCEL_SUBSCRIPTION: 'CANCEL_SUBSCRIPTION' },
  recordAccountLifecycleEvent: vi.fn(),
}));

type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';
type RouteHandler = (ctx: APIContext) => Promise<Response> | Response;
type RouteModule = Partial<Record<RouteMethod, RouteHandler>> & { prerender?: boolean };

type FinancialRoute = {
  name: string;
  load: () => Promise<RouteModule>;
  method: RouteMethod;
  url: string;
  body?: unknown;
};

const FINANCIAL_ROUTES: FinancialRoute[] = [
  {
    name: 'POST /api/admin/barbershop-settings/deposits',
    load: () => import('@/pages/api/admin/barbershop-settings/deposits'),
    method: 'POST',
    url: 'http://localhost/api/admin/barbershop-settings/deposits',
  },
  {
    name: 'POST /api/admin/shop/reset',
    load: () => import('@/pages/api/admin/shop/reset'),
    method: 'POST',
    url: 'http://localhost/api/admin/shop/reset',
  },
  {
    name: 'GET /api/admin/site-launch',
    load: () => import('@/pages/api/admin/site-launch/index'),
    method: 'GET',
    url: 'http://localhost/api/admin/site-launch',
  },
  {
    name: 'POST /api/admin/site-launch/approve',
    load: () => import('@/pages/api/admin/site-launch/approve'),
    method: 'POST',
    url: 'http://localhost/api/admin/site-launch/approve',
    body: { confirm: true },
  },
  {
    name: 'POST /api/setup/billing-portal',
    load: () => import('@/pages/api/setup/billing-portal'),
    method: 'POST',
    url: 'http://localhost/api/setup/billing-portal',
  },
  {
    name: 'GET /api/setup/billing-status',
    load: () => import('@/pages/api/setup/billing-status'),
    method: 'GET',
    url: 'http://localhost/api/setup/billing-status',
  },
  {
    name: 'POST /api/setup/cancel-subscription',
    load: () => import('@/pages/api/setup/cancel-subscription'),
    method: 'POST',
    url: 'http://localhost/api/setup/cancel-subscription',
  },
  {
    name: 'GET /api/setup/data-export',
    load: () => import('@/pages/api/setup/data-export'),
    method: 'GET',
    url: 'http://localhost/api/setup/data-export',
  },
  {
    name: 'GET /api/setup/launch-context',
    load: () => import('@/pages/api/setup/launch-context'),
    method: 'GET',
    url: 'http://localhost/api/setup/launch-context',
  },
  {
    name: 'PUT /api/setup/launch-workspace',
    load: () => import('@/pages/api/setup/launch-workspace'),
    method: 'PUT',
    url: 'http://localhost/api/setup/launch-workspace',
    body: {},
  },
  {
    name: 'POST /api/setup/launch-deposit-checkout',
    load: () => import('@/pages/api/setup/launch-deposit-checkout'),
    method: 'POST',
    url: 'http://localhost/api/setup/launch-deposit-checkout',
    body: { plan: 'starter', termsAccepted: true },
  },
  {
    name: 'POST /api/setup/launch-subscription-checkout',
    load: () => import('@/pages/api/setup/launch-subscription-checkout'),
    method: 'POST',
    url: 'http://localhost/api/setup/launch-subscription-checkout',
    body: { termsAccepted: true },
  },
];

function ctxFor(route: FinancialRoute): APIContext {
  const init: RequestInit = { method: route.method };
  if (route.body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(route.body);
  }
  return {
    request: new Request(route.url, init),
  } as unknown as APIContext;
}

describe('billing.manage exclusivity', () => {
  it('keeps billing.manage exclusive to OWNER', () => {
    expect(can('OWNER', 'billing.manage')).toBe(true);
    expect(can('MANAGER', 'billing.manage')).toBe(false);
    expect(can('BARBER', 'billing.manage')).toBe(false);
  });
});

describe('financial endpoints reject non-owners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createConnectExpressAccount.mockResolvedValue({ id: 'acct_x' });
    createConnectAccountLink.mockResolvedValue({ url: 'https://connect.stripe.com/x' });
    createCheckoutSession.mockResolvedValue({ id: 'cs_x', url: 'https://checkout.stripe.com/x' });
    createBillingPortalSession.mockResolvedValue({ url: 'https://billing.stripe.com/x' });
    cancelSubscriptionAtPeriodEnd.mockResolvedValue({ id: 'sub_x', cancel_at_period_end: true });
    approveSiteLaunch.mockResolvedValue({ ok: true });
    orderDeleteMany.mockResolvedValue({ count: 0 });
    productDeleteMany.mockResolvedValue({ count: 0 });
    transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);
  });

  describe.each(FINANCIAL_ROUTES)('$name', (route) => {
    it.each(['MANAGER', 'BARBER'] as const)('rejects %s with 403', async (role) => {
      currentAccess = accessFor(role);
      const mod = await route.load();
      const handler = mod[route.method];
      expect(handler).toBeTypeOf('function');

      const res = await handler!(ctxFor(route));
      expect(res.status).toBe(403);
      const body = (await res.json().catch(() => null)) as {
        permission?: string;
        permissions?: string[];
        error?: string;
      } | null;
      expect(
        body?.permission === 'billing.manage' ||
          body?.permissions?.includes('billing.manage') ||
          body?.error === 'Forbidden',
      ).toBe(true);

      expect(createConnectExpressAccount).not.toHaveBeenCalled();
      expect(createConnectAccountLink).not.toHaveBeenCalled();
      expect(createCheckoutSession).not.toHaveBeenCalled();
      expect(createBillingPortalSession).not.toHaveBeenCalled();
      expect(cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
      expect(approveSiteLaunch).not.toHaveBeenCalled();
      expect(orderDeleteMany).not.toHaveBeenCalled();
      expect(productDeleteMany).not.toHaveBeenCalled();
    });
  });
});
