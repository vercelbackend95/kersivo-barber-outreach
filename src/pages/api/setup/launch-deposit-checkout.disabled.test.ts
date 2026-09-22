import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const createCheckoutSession = vi.fn();
const createSetupDeposit = vi.fn();
const createLegalAcceptance = vi.fn();
const resolveAdminAccess = vi.fn();

vi.mock('@/lib/pricing/offerMode', () => ({
  ENABLE_SETUP_FEES: false,
  SHOW_SETUP_PLAN_CARDS: false,
}));

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: () => null,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    setupDeposit: {
      create: (...args: unknown[]) => createSetupDeposit(...args),
      findFirst: vi.fn(),
    },
    shopSettings: {
      findUnique: vi.fn(),
    },
    legalAcceptance: {
      create: (...args: unknown[]) => createLegalAcceptance(...args),
    },
  },
}));

vi.mock('@/lib/shop/stripe', () => ({
  createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args),
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.test',
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: vi.fn(async () => null),
}));

import { POST } from './launch-deposit-checkout';

function makeContext(body: unknown = {}): APIContext {
  return {
    request: new Request('http://localhost/api/setup/launch-deposit-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('POST /api/setup/launch-deposit-checkout when setup fees disabled', () => {
  beforeEach(() => {
    createCheckoutSession.mockReset();
    createSetupDeposit.mockReset();
    createLegalAcceptance.mockReset();
    resolveAdminAccess.mockReset();
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop_1',
      userId: 'user_1',
      userEmail: 'owner@example.com',
      userName: 'Owner',
    });
  });

  it('returns 410 SETUP_FEES_DISABLED before Stripe/DB work', async () => {
    const res = await POST(makeContext({ plan: 'launch', termsAccepted: true }) as never);
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body.code).toBe('SETUP_FEES_DISABLED');
    expect(resolveAdminAccess).toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(createSetupDeposit).not.toHaveBeenCalled();
    expect(createLegalAcceptance).not.toHaveBeenCalled();
  });
});
