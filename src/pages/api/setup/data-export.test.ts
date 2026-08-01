import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const findFirst = vi.fn();
const findUniqueShop = vi.fn();
const updateSub = vi.fn();
const buildCsv = vi.fn();

const { EMAIL_VERIFICATION_REQUIRED_MESSAGE } = vi.hoisted(() => ({
  EMAIL_VERIFICATION_REQUIRED_MESSAGE:
    'Verify your email address before continuing. Check your inbox for a verification link.',
}));

vi.mock('@/lib/admin/auth', () => ({
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
  requireVerifiedEmail: (access: { via: string; emailVerified?: boolean }) => {
    if (access.via !== 'session') return null;
    if (access.emailVerified) return null;
    return new Response(
      JSON.stringify({
        error: EMAIL_VERIFICATION_REQUIRED_MESSAGE,
        code: 'EMAIL_NOT_VERIFIED',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  },
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    saasSubscription: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      update: (...args: unknown[]) => updateSub(...args),
    },
    shopSettings: {
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
    },
  },
}));

vi.mock('@/lib/setup/saasDataExport', () => ({
  buildShopClientBookingCsv: (...args: unknown[]) => buildCsv(...args),
}));

import { GET } from './data-export';

function makeContext(): APIContext {
  return {
    request: new Request('http://localhost/api/setup/data-export', { method: 'GET' }),
  } as unknown as APIContext;
}

/** Rolling future date: a fixed literal silently expires and turns the export 403. */
const FUTURE_PERIOD_END = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

const activeSub = {
  id: 'saas-1',
  shopId: 'shop-1',
  status: 'ACTIVE',
  currentPeriodEnd: FUTURE_PERIOD_END,
  pastDueSince: null,
  cancelAtPeriodEnd: false,
  retentionEndsAt: null,
  canceledAt: null,
  dataExportDownloadedAt: null,
};

describe('GET /api/setup/data-export', () => {
  beforeEach(() => {
    resolveAdminAccess.mockReset();
    requirePermission.mockReset();
    findFirst.mockReset();
    findUniqueShop.mockReset();
    updateSub.mockReset();
    buildCsv.mockReset();
    requirePermission.mockReturnValue(null);
    buildCsv.mockResolvedValue('firstName,lastName\nAlex,Demo\n');
  });

  it('returns 401 without session', async () => {
    resolveAdminAccess.mockResolvedValue(null);
    const res = await GET(makeContext() as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 when the session email is not verified', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      role: 'OWNER',
      emailVerified: false,
    });

    const res = await GET(makeContext() as never);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(body.error).toBe(EMAIL_VERIFICATION_REQUIRED_MESSAGE);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns 409 when export already consumed', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      role: 'OWNER',
      emailVerified: true,
    });
    findFirst.mockResolvedValue({
      ...activeSub,
      dataExportDownloadedAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    const res = await GET(makeContext() as never);
    expect(res.status).toBe(409);
    expect(buildCsv).not.toHaveBeenCalled();
  });

  it('returns CSV and marks export consumed for this shop', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      role: 'OWNER',
      emailVerified: true,
    });
    findFirst.mockResolvedValue(activeSub);
    updateSub.mockResolvedValue({ ...activeSub, dataExportDownloadedAt: new Date() });

    const res = await GET(makeContext() as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(buildCsv).toHaveBeenCalledWith('shop-1');
    expect(updateSub).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopId: 'shop-1',
          dataExportDownloadedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('email fallback only matches orphan subscriptions and never stamps another shop', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-attacker',
      role: 'OWNER',
      emailVerified: true,
    });
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    findUniqueShop.mockResolvedValue({ owner: { email: 'victim@example.com' } });

    const res = await GET(makeContext() as never);
    expect(res.status).toBe(404);
    expect(findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          shopId: null,
          customerEmail: { equals: 'victim@example.com', mode: 'insensitive' },
        }),
      }),
    );
    expect(updateSub).not.toHaveBeenCalled();
  });

  it('refuses to stamp a subscription that belongs to another shop', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-attacker',
      role: 'OWNER',
      emailVerified: true,
    });
    findFirst.mockResolvedValue({
      ...activeSub,
      id: 'saas-victim',
      shopId: 'shop-victim',
    });

    const res = await GET(makeContext() as never);
    expect(res.status).toBe(404);
    expect(updateSub).not.toHaveBeenCalled();
    expect(buildCsv).not.toHaveBeenCalled();
  });

  it('returns 403 when export not allowed', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      role: 'OWNER',
      emailVerified: true,
    });
    findFirst.mockResolvedValue({
      ...activeSub,
      status: 'CANCELED',
      retentionEndsAt: new Date('2026-01-01T00:00:00.000Z'),
      canceledAt: new Date('2025-12-01T00:00:00.000Z'),
    });

    const res = await GET(makeContext() as never);
    expect(res.status).toBe(403);
  });
});
