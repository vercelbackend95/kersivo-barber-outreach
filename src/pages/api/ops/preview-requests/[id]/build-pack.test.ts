import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';

const { requireOperatorAccess, findUnique, loadBuildPack, blobGet, eventCreate } = vi.hoisted(() => ({
  requireOperatorAccess: vi.fn(),
  findUnique: vi.fn(),
  loadBuildPack: vi.fn(),
  blobGet: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock('@/lib/ops/operatorAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ops/operatorAuth')>();
  return { ...actual, requireOperatorAccess: (...args: unknown[]) => requireOperatorAccess(...args) };
});
vi.mock('@/lib/db/client', () => ({
  prisma: { previewRequest: { findUnique }, previewRequestEvent: { create: eventCreate } },
}));
vi.mock('@/lib/ops/buildPack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ops/buildPack')>();
  return { ...actual, loadBuildPack: (...args: unknown[]) => loadBuildPack(...args) };
});
vi.mock('@/lib/freePreview/hubAssets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubAssets')>();
  return { ...actual, defaultHubBlobClient: { get: (...args: unknown[]) => blobGet(...args) } };
});

import { shapeBuildPack } from '@/lib/ops/buildPack';
import { GET } from './build-pack';

const at = (s: string) => new Date(s);

function pack(extra: { barbers?: unknown[]; products?: unknown[]; draftShopId?: string | null } = {}) {
  const asset = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({
    id,
    kind,
    storagePath: `preview-hub/req_1/${id}.jpg`,
    thumbPath: `preview-hub/req_1/${id}-thumb.webp`,
    originalFileName: `${id}.jpg`,
    contentType: 'image/jpeg',
    sizeBytes: 10,
    width: null,
    height: null,
    caption: null,
    sortOrder: 0,
    barberId: null,
    uploadedBy: 'OWNER' as const,
    createdAt: at('2026-11-01T10:00:00Z'),
    ...extra,
  });
  return shapeBuildPack(
    {
      request: {
        id: 'req_1',
        shopName: 'Fade Co',
        townCity: 'Leeds',
        bookingPageUrl: null,
        instagramUrl: null,
        googleListingUrl: null,
        websiteUrl: null,
        workLinks: null,
        barberCount: null,
        currentBookingSystem: null,
        hasOwnDomain: null,
        notes: null,
        draftShopId: extra.draftShopId ?? null,
        changesRequestedText: null,
        changesRequestedAt: null,
        anonymisedAt: null,
        brandPrimaryColour: null,
        brandSecondaryColour: null,
        brandBackgroundTone: null,
        brandColoursSource: null,
        brandPaletteExtracted: null,
        brandColoursSentAt: null,
        brandSubmittedSnapshot: null,
        styleNotes: null,
        aboutText: null,
        websiteExtraText: null,
      },
      shop: extra.draftShopId
        ? { id: extra.draftShopId, name: 'Fade Co', townCity: 'Leeds', logoUrl: null, bookingSlug: null, sitePreviewUrl: null, sitePreviewVersion: null }
        : null,
      profile: null,
      hours: [],
      services: [],
      barbers: (extra.barbers ?? []) as never,
      products: (extra.products ?? []) as never,
      assets: [asset('logo', 'LOGO'), asset('p1', 'SHOP_PHOTO', { sortOrder: 0 }), asset('p2', 'SHOP_PHOTO', { sortOrder: 1 })],
      changeRequests: [],
    },
    at('2026-11-04T12:00:00Z'),
  );
}

function blob(text: string) {
  return {
    statusCode: 200,
    contentType: 'image/jpeg',
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
  };
}

const call = (id: string, query = '') =>
  GET({
    request: new Request(`http://localhost/api/ops/preview-requests/${id}/build-pack${query}`),
    params: { id },
  } as never) as Promise<Response>;

beforeEach(() => {
  requireOperatorAccess.mockReset().mockResolvedValue({ userId: 'op-1', email: 'ops@kersivo.co.uk' });
  findUnique.mockReset().mockResolvedValue({ id: 'req_1', anonymisedAt: null });
  loadBuildPack.mockReset().mockResolvedValue(pack());
  blobGet.mockReset().mockImplementation(async (path: string) => blob(`ORIGINAL:${path}`));
  eventCreate.mockReset().mockResolvedValue({});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GET /api/ops/preview-requests/[id]/build-pack', () => {
  it.each([401, 403])('passes through %i from operator auth without reading data', async (status) => {
    requireOperatorAccess.mockResolvedValueOnce(new Response('{}', { status }));
    expect((await call('req_1')).status).toBe(status);
    expect(findUnique).not.toHaveBeenCalled();
    expect(blobGet).not.toHaveBeenCalled();
  });

  it('404s an unknown request', async () => {
    findUnique.mockResolvedValueOnce(null);
    const response = await call('nope');
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('410s an anonymised request', async () => {
    findUnique.mockResolvedValueOnce({ id: 'req_1', anonymisedAt: new Date() });
    expect((await call('req_1')).status).toBe(410);
    expect(loadBuildPack).not.toHaveBeenCalled();
  });

  it('streams a zip of originals (never thumbnails) and records the download', async () => {
    const response = await call('req_1');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="kersivo-build-pack_fade-co_\d{4}-\d{2}-\d{2}\.zip"$/);

    const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
    const names = Object.keys(entries).map((name) => name.replace(/^[^/]+\//, ''));
    expect(names).toEqual(
      expect.arrayContaining(['README.md', 'brief.md', 'shop.json', 'brand/colours.json', 'revisions/change-requests.md', 'brand/logo/current-logo.jpg', 'photos/shop/01_p1.jpg', 'photos/shop/02_p2.jpg']),
    );
    const photo = Object.entries(entries).find(([name]) => name.endsWith('photos/shop/01_p1.jpg'))!;
    expect(strFromU8(photo[1])).toBe('ORIGINAL:preview-hub/req_1/p1.jpg');
    expect(blobGet.mock.calls.map(([path]) => path).every((path: string) => !path.includes('thumb'))).toBe(true);
    expect(eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previewRequestId: 'req_1',
        action: 'ops_build_pack_downloaded',
        actorEmail: 'ops@kersivo.co.uk',
        meta: { fileCount: 3, failedCount: 0 },
      }),
    });
  });

  it('keeps going when one file cannot be read and lists it in README', async () => {
    blobGet.mockImplementation(async (path: string) =>
      path.endsWith('p1.jpg') ? { statusCode: 404, stream: null, contentType: null } : blob(`ORIGINAL:${path}`),
    );
    const entries = unzipSync(new Uint8Array(await (await call('req_1')).arrayBuffer()));
    const names = Object.keys(entries);
    expect(names.some((name) => name.endsWith('01_p1.jpg'))).toBe(false);
    expect(names.some((name) => name.endsWith('02_p2.jpg'))).toBe(true);
    const readme = strFromU8(Object.entries(entries).find(([name]) => name.endsWith('README.md'))![1]);
    expect(readme).toContain('`photos/shop/01_p1.jpg` — not found in storage');
    const shop = JSON.parse(strFromU8(Object.entries(entries).find(([name]) => name.endsWith('shop.json'))![1]));
    expect(shop.assets.SHOP_PHOTO[0].path).toBeNull();
    expect(eventCreate.mock.calls[0][0].data.meta).toEqual({ fileCount: 2, failedCount: 1 });
  });

  it('returns brief.md and shop.json on request, without a download event', async () => {
    const md = await call('req_1', '?format=md');
    expect(md.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect((await md.text()).startsWith('# Website brief — Fade Co')).toBe(true);
    const json = await call('req_1', '?format=json');
    const body = await json.json();
    expect(body.schemaVersion).toBe(2);
    expect(JSON.stringify(body)).not.toContain('storagePath');
    expect(eventCreate).not.toHaveBeenCalled();
    expect(blobGet).not.toHaveBeenCalled();
  });
});

describe('GET build-pack: dashboard images', () => {
  const HOST = 'store1.public.blob.vercel-storage.com';
  const unzip = async (response: Response) => unzipSync(new Uint8Array(await response.arrayBuffer()));
  const text = (entries: Record<string, Uint8Array>, suffix: string) =>
    strFromU8(Object.entries(entries).find(([name]) => name.endsWith(suffix))![1]);

  beforeEach(() => {
    vi.stubEnv('PUBLIC_BLOB_STORE_HOST', HOST);
    loadBuildPack.mockResolvedValue(
      pack({
        draftShopId: 'shop_1',
        barbers: [
          { id: 'b1', name: 'Jess', avatarUrl: `https://${HOST}/shops/shop_1/barbers/jess.jpg`, title: null, bio: null, sortOrder: 0 },
          { id: 'b2', name: 'Sam', avatarUrl: 'https://example.com/sam.jpg', title: null, bio: null, sortOrder: 1 },
        ],
        products: [
          { id: 'p1', name: 'Wax', description: null, pricePence: 900, imageUrl: `https://${HOST}/shops/shop_1/products/wax.png`, featured: false, category: 'HAIR', sortOrder: 0 },
        ],
      }),
    );
  });

  it('downloads allowlisted images one at a time; a remote failure does not break the zip', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(init.redirect).toBe('error');
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      if (url.endsWith('wax.png')) return new Response('nope', { status: 500, headers: { 'content-type': 'text/plain' } });
      return new Response(new TextEncoder().encode(`REMOTE:${url}`), { status: 200, headers: { 'content-type': 'image/jpeg' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const entries = await unzip(await call('req_1'));
    expect(fetchMock).toHaveBeenCalledTimes(2); // example.com is never fetched
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('example.com'))).toBe(false);
    expect(maxInFlight).toBe(1);
    expect(text(entries, 'photos/team/jess.jpg')).toBe(`REMOTE:https://${HOST}/shops/shop_1/barbers/jess.jpg`);
    expect(Object.keys(entries).some((name) => name.includes('photos/products/'))).toBe(false);

    const readme = text(entries, 'README.md');
    expect(readme).toContain('`photos/team/sam.jpg` — external URL not fetched');
    expect(readme).toContain('`photos/products/01_wax.png` — download failed (HTTP 500)');
    const shop = JSON.parse(text(entries, 'shop.json'));
    expect(shop.team.map((m: { photoPath: string | null }) => m.photoPath)).toEqual(['photos/team/jess.jpg', null]);
    expect(text(entries, 'brief.md')).toContain('- **Jess** · photo: `photos/team/jess.jpg`');
    // 3 hub files + Jess; Sam (external) and the wax image (500) failed.
    expect(eventCreate.mock.calls[0][0].data.meta).toEqual({ fileCount: 4, failedCount: 2 });
  });

  it('?format=md never fetches and only names files that would be in the zip; &download=1 makes it a download', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const inline = await call('req_1', '?format=md');
    expect(inline.headers.get('content-disposition')).toBeNull();
    const md = await inline.text();
    expect(md).toContain('- **Jess** · photo: `photos/team/jess.jpg`');
    expect(md).toContain('- **Sam** · photo: image added in the dashboard (not in this pack)');
    const download = await call('req_1', '?format=md&download=1');
    expect(download.headers.get('content-disposition')).toMatch(/^attachment; filename="kersivo-build-pack_fade-co_\d{4}-\d{2}-\d{2}_brief\.md"$/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
