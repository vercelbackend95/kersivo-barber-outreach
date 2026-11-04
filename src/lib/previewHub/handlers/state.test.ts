import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubApiContext = vi.fn();
const enforceHubStateGetRate = vi.fn();
const loadActiveHubAssets = vi.fn();
const loadDraftShopSetupCounts = vi.fn();

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

vi.mock('@/lib/adminHub/draftShopSetupCounts', () => ({
  loadDraftShopSetupCounts: (...args: unknown[]) => loadDraftShopSetupCounts(...args),
}));

import { GET } from '@/pages/api/admin-hub/state';
import { hubJson } from '@/lib/freePreview/hubApi';

const request = {
  id: 'req_1',
  draftShopId: 'shop_1',
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
  resolveHubApiContext.mockReset().mockResolvedValue({
    ok: true,
    ctx: { request, isOperator: false, state: { kind: 'hub', stage: 'review' } },
  });
  loadDraftShopSetupCounts
    .mockReset()
    .mockResolvedValue({ activeServices: 0, activeBarbers: 0, products: 0, openingHoursSaved: true });
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

  it('returns only the session shop: assets, details, the current logo and the setup card', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(loadActiveHubAssets).toHaveBeenCalledWith('req_1');
    const body = (await response.json()) as { ok: boolean; state: Record<string, unknown> };
    expect(Object.keys(body.state).sort()).toEqual(['assets', 'currentLogo', 'details', 'setup']);
    expect(body.state.currentLogo).toEqual({ id: 'logo_new', src: '/api/admin-hub/assets/logo_new?size=thumb' });
    // The Website content tile sizes its cells from these (O3): width/height ride along with every asset.
    expect((body.state.assets as Array<Record<string, unknown>>).map((a) => [a.id, a.width, a.height])).toEqual([
      ['logo_old', 400, 300],
      ['logo_new', 400, 300],
      ['photo_1', 400, 300],
    ]);
    // The sidebar setup card refreshes from here after a save: hours come from the draft shop's saved rows.
    expect(loadDraftShopSetupCounts).toHaveBeenCalledWith('shop_1');
    const setup = body.state.setup as { done: number; total: number; items: Array<{ id: string; done: boolean }> };
    expect(setup.items.find((item) => item.id === 'hours')?.done).toBe(true);
    expect([setup.done, setup.total]).toEqual([3, 5]);
    expect(body.state).toMatchSnapshot();
    const json = JSON.stringify(body);
    expect(json).not.toContain('owner@example.com');
    expect(json).not.toContain('Fade Room');
    expect(json).not.toContain('thumb.webp');
  });
});
