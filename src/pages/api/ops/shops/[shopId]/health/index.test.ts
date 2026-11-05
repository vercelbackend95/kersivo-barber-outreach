import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveOperatorAccess, loadShopHealthReport } = vi.hoisted(() => ({
  resolveOperatorAccess: vi.fn(),
  loadShopHealthReport: vi.fn(),
}));

vi.mock('@/lib/ops/operatorAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ops/operatorAuth')>();
  return {
    ...actual,
    resolveOperatorAccess,
    requireOperatorAccess: async () => {
      const result = await resolveOperatorAccess();
      return result.ok ? result.access : actual.operatorAuthFailureResponse(result);
    },
  };
});
vi.mock('@/lib/ops/shopHealth/report', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ops/shopHealth/report')>();
  return { ...actual, loadShopHealthReport };
});

import { GET } from './index';

const get = (shopId: string) =>
  GET({ request: new Request(`https://kersivo.co.uk/api/ops/shops/${shopId}/health`), params: { shopId } } as never) as Promise<Response>;

beforeEach(() => {
  resolveOperatorAccess.mockReset().mockResolvedValue({ ok: true, access: { email: 'ops@kersivo.co.uk', userId: 'u1' } });
  loadShopHealthReport.mockReset().mockResolvedValue({
    shopId: 'shop_1',
    name: 'Fade Room',
    overall: 'GREEN',
    checkedAt: new Date('2026-11-05T10:00:00Z'),
    mode: 'LIVE',
    previewRequestId: null,
    latest: null,
    history: [{ id: 'r1', overall: 'GREEN', mode: 'LIVE', trigger: 'CRON', startedAt: new Date('2026-11-05T10:00:00Z'), failing: [] }],
  });
});

describe('GET /api/ops/shops/[shopId]/health', () => {
  it('401s when signed out', async () => {
    resolveOperatorAccess.mockResolvedValueOnce({ ok: false, status: 401, code: 'UNAUTHENTICATED' });
    expect((await get('shop_1')).status).toBe(401);
    expect(loadShopHealthReport).not.toHaveBeenCalled();
  });

  it('403s for a non-operator', async () => {
    resolveOperatorAccess.mockResolvedValueOnce({ ok: false, status: 403, code: 'FORBIDDEN' });
    expect((await get('shop_1')).status).toBe(403);
    expect(loadShopHealthReport).not.toHaveBeenCalled();
  });

  it('returns the latest run and history with ISO dates, never cached', async () => {
    const response = await get('shop_1');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toMatch(/no-store/);
    const data = await response.json();
    expect(data.report).toMatchObject({
      overall: 'GREEN',
      checkedAt: '2026-11-05T10:00:00.000Z',
      history: [{ id: 'r1', startedAt: '2026-11-05T10:00:00.000Z' }],
    });
  });

  it('404s for an unknown shop', async () => {
    loadShopHealthReport.mockResolvedValueOnce(null);
    expect((await get('nope')).status).toBe(404);
  });
});
