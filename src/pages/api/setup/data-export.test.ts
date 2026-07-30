import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const findFirst = vi.fn();
const findUniqueShop = vi.fn();
const updateSub = vi.fn();
const buildCsv = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
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

const activeSub = {
  id: 'saas-1',
  status: 'ACTIVE',
  currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
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

  it('returns 409 when export already consumed', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'session', shopId: 'shop-1', role: 'OWNER' });
    findFirst.mockResolvedValue({
      ...activeSub,
      dataExportDownloadedAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    const res = await GET(makeContext() as never);
    expect(res.status).toBe(409);
    expect(buildCsv).not.toHaveBeenCalled();
  });

  it('returns CSV and marks export consumed', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'session', shopId: 'shop-1', role: 'OWNER' });
    findFirst.mockResolvedValue(activeSub);
    updateSub.mockResolvedValue({ ...activeSub, dataExportDownloadedAt: new Date() });

    const res = await GET(makeContext() as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(buildCsv).toHaveBeenCalledWith('shop-1');
    expect(updateSub).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dataExportDownloadedAt: expect.any(Date) }),
      }),
    );
  });

  it('returns 403 when export not allowed', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'session', shopId: 'shop-1', role: 'OWNER' });
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
