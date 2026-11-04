import { describe, expect, it, vi } from 'vitest';
import { buildSiteData } from './build';
import { seededShopSource } from './fixtures';
import { handlePreviewSiteData, handlePublicSiteData, SITE_DATA_PREVIEW_TOKEN_HEADER } from './api';

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({ enforceIpRateLimit: async () => null }));

const full = buildSiteData(seededShopSource());
const starter = buildSiteData(
  seededShopSource({ plan: 'starter', features: { brandedSite: false, onlineBooking: true, retail: false } }),
);

describe('GET /api/public/site/{identifier}', () => {
  it('serves a Full shop with per-URL CDN caching', async () => {
    const load = vi.fn(async () => full);
    const res = await handlePublicSiteData('fixture-barbers', new URL('https://kersivo.co.uk/api/public/site/fixture-barbers'), {
      getSiteData: load,
    });
    expect(res.status).toBe(200);
    expect(load).toHaveBeenCalledWith('fixture-barbers', undefined, { now: undefined });
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    expect(res.headers.get('Vary')).toBeNull(); // cache key = URL, which contains the shop identifier
    expect((await res.json()).business.name).toBe('Fixture Barbers');
  });

  it('returns 404 when the plan does not include a branded site (data kept, not published)', async () => {
    const res = await handlePublicSiteData('fixture-barbers', new URL('https://x.test'), { getSiteData: async () => starter });
    expect(res.status).toBe(404);
  });

  it('passes the location filter through and 404s unknown shops', async () => {
    const load = vi.fn(async () => null);
    const res = await handlePublicSiteData('nope', new URL('https://x.test/?location=loc_2'), { getSiteData: load });
    expect(load).toHaveBeenCalledWith('nope', 'loc_2', { now: undefined });
    expect(res.status).toBe(404);
  });

  it('never caches an outage', async () => {
    const res = await handlePublicSiteData('x', new URL('https://x.test'), {
      getSiteData: async () => {
        throw new Error('db down');
      },
    });
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('GET /api/public/site-preview', () => {
  const request = (token?: string) =>
    new Request('https://kersivo.co.uk/api/public/site-preview', {
      headers: token ? { [SITE_DATA_PREVIEW_TOKEN_HEADER]: token } : {},
    });
  const preview = { draftShopId: 'shop_fixture', status: 'IN_PROGRESS', expiresAt: null };

  it('requires the token header and is never cached', async () => {
    const res = await handlePreviewSiteData(request(), { rateLimit: async () => null });
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('loads the draft shop in preview mode', async () => {
    const loadShop = vi.fn(async () => full);
    const res = await handlePreviewSiteData(request('tok'), {
      rateLimit: async () => null,
      resolveToken: async () => preview as never,
      loadShop,
    });
    expect(res.status).toBe(200);
    expect(loadShop).toHaveBeenCalledWith('shop_fixture', expect.objectContaining({ mode: 'preview' }));
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('refuses rejected, declined and expired previews', async () => {
    for (const status of ['REJECTED', 'DECLINED', 'EXPIRED']) {
      const res = await handlePreviewSiteData(request('tok'), {
        rateLimit: async () => null,
        resolveToken: async () => ({ ...preview, status }) as never,
        loadShop: async () => full,
      });
      expect(res.status).toBe(404);
    }
  });
});
