import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const getDetail = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}));

vi.mock('@/lib/recommendations/ops/readModel', () => ({
  getRecommendationOpsShopDetail: (...args: unknown[]) => getDetail(...args),
}));

import { DEMO_SHOP_ID } from '@/lib/db/shopScope';

import {
  DELETE,
  GET,
  PATCH,
  POST,
  PUT,
} from './[shopId]';

function ctx(shopId?: string) {
  return {
    request: new Request('http://localhost/api/ops/recommendations/' + (shopId ?? '')),
    params: { shopId },
  } as never;
}

describe('GET /api/ops/recommendations/[shopId]', () => {
  beforeEach(() => {
    getSession.mockReset();
    getDetail.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
  });

  it('returns 401 and does not call read model without session', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(ctx('shop-a'));
    expect(res.status).toBe(401);
    expect(getDetail).not.toHaveBeenCalled();
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Vary')).toBe('Cookie');
  });

  it('returns 403 EMAIL_NOT_VERIFIED', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: false },
    });
    const res = await GET(ctx('shop-a'));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(getDetail).not.toHaveBeenCalled();
  });

  it('returns 403 for tenant OWNER not on allowlist', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'owner@shop.com', emailVerified: true },
    });
    const res = await GET(ctx('shop-a'));
    expect(res.status).toBe(403);
    expect(getDetail).not.toHaveBeenCalled();
  });

  it('returns 503 when allowlist missing', async () => {
    vi.stubEnv('KERSIVO_OPS_EMAILS', '');
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    const res = await GET(ctx('shop-a'));
    expect(res.status).toBe(503);
    expect(getDetail).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND for unknown shop', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    getDetail.mockResolvedValue(null);
    const res = await GET(ctx('missing-shop'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('returns NOT_FOUND for demo shop without leaking id in body', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    getDetail.mockResolvedValue(null);
    const res = await GET(ctx(DEMO_SHOP_ID));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(body)).not.toContain(DEMO_SHOP_ID);
  });

  it('returns INVALID_QUERY for malformed or oversized shopId without calling read model', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    for (const bad of ['', 'bad id', '../x', 'x'.repeat(200)]) {
      const res = await GET(ctx(bad));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: { code: 'INVALID_QUERY' } });
    }
    expect(getDetail).not.toHaveBeenCalled();
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
    const res = await GET(ctx('shop-a'));
    expect(res.status).toBe(200);
    expect(getDetail).toHaveBeenCalledWith('shop-a');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns INTERNAL_ERROR when read model throws', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    getDetail.mockRejectedValue(new Error('secret stack acct_xxx'));
    const res = await GET(ctx('shop-a'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: { code: 'INTERNAL_ERROR' } });
    expect(JSON.stringify(body)).not.toContain('acct_xxx');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('rejects non-GET methods', async () => {
    expect((await POST()).status).toBe(405);
    expect((await PUT()).status).toBe(405);
    expect((await PATCH()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
  });
});
