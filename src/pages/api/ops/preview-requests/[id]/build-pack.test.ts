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

function pack() {
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
        draftShopId: null,
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
      shop: null,
      profile: null,
      hours: [],
      services: [],
      barbers: [],
      products: [],
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
afterEach(() => vi.clearAllMocks());

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
      expect.arrayContaining(['README.md', 'brief.md', 'shop.json', 'brand/colours.json', 'revisions/change-requests.md', 'brand/logo/logo.jpg', 'photos/shop/01_p1.jpg', 'photos/shop/02_p2.jpg']),
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
    expect(body.schemaVersion).toBe(1);
    expect(JSON.stringify(body)).not.toContain('storagePath');
    expect(eventCreate).not.toHaveBeenCalled();
    expect(blobGet).not.toHaveBeenCalled();
  });
});
