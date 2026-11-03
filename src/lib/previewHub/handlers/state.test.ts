import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubApiContext = vi.fn();
const enforceHubStateGetRate = vi.fn();
const loadActiveHubAssets = vi.fn();

vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
    enforceHubStateGetRate: (...args: unknown[]) => enforceHubStateGetRate(...args),
  };
});
vi.mock('@/lib/freePreview/hubAssets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubAssets')>();
  return { ...actual, loadActiveHubAssets: (...args: unknown[]) => loadActiveHubAssets(...args) };
});

import { GET } from '@/pages/api/admin-hub/state';
import { hubJson } from '@/lib/freePreview/hubApi';

const request = {
  id: 'req_1',
  shopName: 'Fade Room',
  email: 'owner@example.com',
  brandPrimaryColour: '#1F6F6B',
  brandSecondaryColour: null,
  styleNotes: null,
  aboutText: 'About us',
  instagramUrl: null,
  websiteExtraText: null,
  brandBackgroundTone: 'DARK',
  brandColoursSource: 'LOGO',
  brandPaletteExtracted: [{ hex: '#1F6F6B', share: 0.5 }],
  brandColoursSentAt: null,
  brandSubmittedSnapshot: null,
};

function row(id: string, kind: string, createdAt: string) {
  return {
    id,
    kind,
    originalFileName: `${id}.png`,
    contentType: 'image/png',
    sizeBytes: 100,
    width: 400,
    height: 300,
    caption: null,
    sortOrder: 0,
    barberId: null,
    uploadedBy: 'OWNER',
    createdAt: new Date(createdAt),
    thumbPath: `private/${id}-thumb.webp`,
  };
}

function get() {
  return GET({ request: new Request('http://localhost/api/admin-hub/state'), params: {} } as never);
}

beforeEach(() => {
  enforceHubStateGetRate.mockReset().mockResolvedValue(null);
  resolveHubApiContext.mockReset().mockResolvedValue({ ok: true, ctx: { request, isOperator: false } });
  loadActiveHubAssets.mockReset().mockResolvedValue([
    row('logo_old', 'LOGO', '2026-10-01T10:00:00Z'),
    row('logo_new', 'LOGO', '2026-10-02T10:00:00Z'),
    row('photo_1', 'SHOP_PHOTO', '2026-10-03T10:00:00Z'),
  ]);
});
afterEach(() => vi.clearAllMocks());

describe('GET /api/admin-hub/state', () => {
  it('is 404 without a hub session, with private no-store headers', async () => {
    resolveHubApiContext.mockResolvedValue({ ok: false, response: hubJson({ ok: false, error: 'Not found.' }, 404) });
    const response = await get();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
    expect(loadActiveHubAssets).not.toHaveBeenCalled();
  });

  it('uses the read-only hub session check and its own GET rate limit', async () => {
    await get();
    expect(resolveHubApiContext).toHaveBeenCalledWith(
      expect.objectContaining({ mutation: false, source: { kind: 'cookie' } }),
    );
    expect(enforceHubStateGetRate).toHaveBeenCalled();
    enforceHubStateGetRate.mockResolvedValue(new Response(null, { status: 429 }));
    const limited = await get();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns only the session shop: assets, details and the current logo', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(loadActiveHubAssets).toHaveBeenCalledWith('req_1');
    const body = (await response.json()) as { ok: boolean; state: Record<string, unknown> };
    expect(Object.keys(body.state).sort()).toEqual(['assets', 'currentLogo', 'details']);
    expect(body.state.currentLogo).toEqual({ id: 'logo_new', src: '/api/admin-hub/assets/logo_new?size=thumb' });
    expect(body.state).toMatchSnapshot();
    const json = JSON.stringify(body);
    expect(json).not.toContain('owner@example.com');
    expect(json).not.toContain('Fade Room');
    expect(json).not.toContain('thumb.webp');
  });
});
