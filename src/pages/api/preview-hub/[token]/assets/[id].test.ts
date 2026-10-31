import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveHubApiContext,
  requireUploadCapability,
  enforceHubAssetRates,
  enforceHubAssetGetRate,
  findFirst,
  update,
  eventCreate,
  blobGet,
  softDeleteHubAsset,
} = vi.hoisted(() => ({
  resolveHubApiContext: vi.fn(),
  requireUploadCapability: vi.fn(),
  enforceHubAssetRates: vi.fn(),
  enforceHubAssetGetRate: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  eventCreate: vi.fn(),
  blobGet: vi.fn(),
  softDeleteHubAsset: vi.fn(),
}));

vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
    requireUploadCapability: (...args: unknown[]) => requireUploadCapability(...args),
    enforceHubAssetRates: (...args: unknown[]) => enforceHubAssetRates(...args),
    enforceHubAssetGetRate: (...args: unknown[]) => enforceHubAssetGetRate(...args),
  };
});
vi.mock('@/lib/freePreview/hubAssets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubAssets')>();
  return {
    ...actual,
    defaultHubBlobClient: { get: (...args: unknown[]) => blobGet(...args) },
    softDeleteHubAsset: (...args: unknown[]) => softDeleteHubAsset(...args),
  };
});
vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewHubAsset: { findFirst, update },
    previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) },
  },
}));

import { DELETE, GET, PATCH } from './[id]';

const TOKEN = 'A'.repeat(43);
const OTHER = 'B'.repeat(43);

function ctx(id = 'req_1') {
  return {
    ok: true,
    ctx: {
      token: TOKEN,
      request: { id, shopName: 'Sharp Cuts' },
      state: { kind: 'hub', stage: 'requested', capabilities: { canUpload: true } },
      isOperator: false,
      draft: null,
    },
  };
}

beforeEach(() => {
  resolveHubApiContext.mockReset().mockResolvedValue(ctx());
  requireUploadCapability.mockReset().mockReturnValue(null);
  enforceHubAssetRates.mockReset().mockResolvedValue(null);
  enforceHubAssetGetRate.mockReset().mockResolvedValue(null);
  findFirst.mockReset();
  update.mockReset();
  eventCreate.mockReset();
  blobGet.mockReset();
  softDeleteHubAsset.mockReset().mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe('GET /api/preview-hub/[token]/assets/[id]', () => {
  it('404s an asset that belongs to another request', async () => {
    findFirst.mockResolvedValueOnce(null);
    const request = new Request(`http://localhost/api/preview-hub/${OTHER}/assets/asset_1?size=full`);
    resolveHubApiContext.mockResolvedValueOnce(ctx('req_other'));
    const response = await GET({ request, params: { token: OTHER, id: 'asset_1' } } as never);
    expect(response.status).toBe(404);
    expect(blobGet).not.toHaveBeenCalled();
  });

  it('serves SVG originals as attachment octet-stream, never inline', async () => {
    findFirst.mockResolvedValueOnce({
      id: 'asset_1',
      previewRequestId: 'req_1',
      storagePath: 'preview-hub/req_1/logo/a.svg',
      thumbPath: 'preview-hub/req_1/logo/a.png',
      contentType: 'image/svg+xml',
      originalFileName: 'logo.svg',
      deletedAt: null,
    });
    blobGet.mockResolvedValueOnce({
      stream: new ReadableStream(),
      contentType: 'image/svg+xml',
      statusCode: 200,
    });
    const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/assets/asset_1?size=full`);
    const response = await GET({ request, params: { token: TOKEN, id: 'asset_1' } } as never);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment;/);
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300');
  });
});

describe('PATCH and DELETE', () => {
  it('patches caption on an owner upload', async () => {
    findFirst.mockResolvedValueOnce({ id: 'asset_1', previewRequestId: 'req_1' });
    update.mockResolvedValueOnce({
      id: 'asset_1',
      kind: 'SHOP_PHOTO',
      originalFileName: 'a.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 10,
      width: 1,
      height: 1,
      caption: 'Chair',
      sortOrder: 0,
      barberId: null,
      uploadedBy: 'OWNER',
      createdAt: new Date(),
      thumbPath: 't',
    });
    const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/assets/asset_1`, {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ caption: 'Chair' }),
    });
    const response = await PATCH({ request, params: { token: TOKEN, id: 'asset_1' } } as never);
    expect(response.status).toBe(200);
    expect(eventCreate).toHaveBeenCalled();
  });

  it('rejects an oversized caption', async () => {
    const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/assets/asset_1`, {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ caption: 'x'.repeat(141) }),
    });
    expect((await PATCH({ request, params: { token: TOKEN, id: 'asset_1' } } as never)).status).toBe(400);
  });

  it('soft-deletes an owner upload', async () => {
    findFirst.mockResolvedValueOnce({ id: 'asset_1' });
    const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/assets/asset_1`, {
      method: 'DELETE',
      headers: { origin: 'http://localhost' },
    });
    const response = await DELETE({ request, params: { token: TOKEN, id: 'asset_1' } } as never);
    expect(response.status).toBe(200);
    expect(softDeleteHubAsset).toHaveBeenCalledWith({ assetId: 'asset_1', previewRequestId: 'req_1' });
  });

  it('denies mutations when the owner cannot upload', async () => {
    requireUploadCapability.mockReturnValue(new Response('{}', { status: 403 }));
    const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/assets/asset_1`, {
      method: 'DELETE',
      headers: { origin: 'http://localhost' },
    });
    expect((await DELETE({ request, params: { token: TOKEN, id: 'asset_1' } } as never)).status).toBe(403);
  });
});
