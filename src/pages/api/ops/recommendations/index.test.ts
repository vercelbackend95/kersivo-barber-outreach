import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const listOverview = vi.fn();
const getDetail = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}));

vi.mock('@/lib/recommendations/ops/readModel', async () => {
  const actual = await vi.importActual<typeof import('@/lib/recommendations/ops/readModel')>(
    '@/lib/recommendations/ops/readModel',
  );
  return {
    ...actual,
    listRecommendationOpsOverview: (...args: unknown[]) => listOverview(...args),
    getRecommendationOpsShopDetail: (...args: unknown[]) => getDetail(...args),
  };
});

import { GET as GET_INDEX, POST as POST_INDEX } from './index';
import { GET as GET_DETAIL } from './[shopId]';

function ctx(url: string, params: Record<string, string> = {}) {
  return {
    request: new Request(url),
    params,
  } as never;
}

describe('GET /api/ops/recommendations', () => {
  beforeEach(() => {
    getSession.mockReset();
    listOverview.mockReset();
    getDetail.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
  });

  it('returns 401 and does not call read model when unauthorized', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET_INDEX(ctx('http://localhost/api/ops/recommendations'));
    expect(res.status).toBe(401);
    expect(listOverview).not.toHaveBeenCalled();
  });

  it('returns 403 EMAIL_NOT_VERIFIED', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: false },
    });
    const res = await GET_INDEX(ctx('http://localhost/api/ops/recommendations'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(listOverview).not.toHaveBeenCalled();
  });

  it('returns 403 for tenant OWNER email not on allowlist', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'owner@shop.com', emailVerified: true },
    });
    const res = await GET_INDEX(ctx('http://localhost/api/ops/recommendations'));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
    expect(listOverview).not.toHaveBeenCalled();
  });

  it('returns 503 when allowlist missing', async () => {
    vi.stubEnv('KERSIVO_OPS_EMAILS', '');
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    const res = await GET_INDEX(ctx('http://localhost/api/ops/recommendations'));
    expect(res.status).toBe(503);
    expect(listOverview).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid pagination', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    const res = await GET_INDEX(ctx('http://localhost/api/ops/recommendations?limit=9999'));
    expect(res.status).toBe(400);
    expect(listOverview).not.toHaveBeenCalled();
  });

  it('returns data for authorized operator with no-store headers', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    listOverview.mockResolvedValue({
      generatedAt: '2026-09-06T12:00:00.000Z',
      shops: [{ shop: { id: 'shop-a', name: 'A', townCity: null, createdAt: '2026-09-06T12:00:00.000Z' } }],
      nextCursor: null,
    });
    const res = await GET_INDEX(ctx('http://localhost/api/ops/recommendations?limit=10'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Vary')).toBe('Cookie');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.shops).toHaveLength(1);
    expect(listOverview).toHaveBeenCalled();
  });

  it('rejects non-GET', async () => {
    const res = await POST_INDEX();
    expect(res.status).toBe(405);
  });
});

describe('GET /api/ops/recommendations/[shopId]', () => {
  beforeEach(() => {
    getSession.mockReset();
    getDetail.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
  });

  it('returns 404 for unknown shop without leaking', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    getDetail.mockResolvedValue(null);
    const res = await GET_DETAIL(ctx('http://localhost/api/ops/recommendations/missing', { shopId: 'missing' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('returns detail for authorized operator', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    getDetail.mockResolvedValue({
      overview: { health: { generatedAt: '2026-09-06T12:00:00.000Z' } },
      services: [],
      products: [],
    });
    const res = await GET_DETAIL(ctx('http://localhost/api/ops/recommendations/shop-a', { shopId: 'shop-a' }));
    expect(res.status).toBe(200);
    expect(getDetail).toHaveBeenCalledWith('shop-a');
  });
});
