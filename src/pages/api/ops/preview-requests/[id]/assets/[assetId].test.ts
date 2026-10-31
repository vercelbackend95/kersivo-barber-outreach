import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requireOperatorAccess, findFirst, blobGet } = vi.hoisted(() => ({
  requireOperatorAccess: vi.fn(),
  findFirst: vi.fn(),
  blobGet: vi.fn(),
}));

vi.mock('@/lib/ops/operatorAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ops/operatorAuth')>();
  return { ...actual, requireOperatorAccess: (...args: unknown[]) => requireOperatorAccess(...args) };
});
vi.mock('@/lib/db/client', () => ({
  prisma: { previewHubAsset: { findFirst } },
}));
vi.mock('@/lib/freePreview/hubAssets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubAssets')>();
  return {
    ...actual,
    defaultHubBlobClient: { get: (...args: unknown[]) => blobGet(...args) },
  };
});

import { GET } from './[assetId]';

beforeEach(() => {
  requireOperatorAccess.mockReset().mockResolvedValue({ userId: 'op-1', email: 'ops@kersivo.co.uk' });
  findFirst.mockReset();
  blobGet.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe('GET /api/ops/preview-requests/[id]/assets/[assetId]', () => {
  it('refuses non-operators without reading the blob', async () => {
    requireOperatorAccess.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    const request = new Request('http://localhost/api/ops/preview-requests/req_1/assets/asset_1');
    expect((await GET({ request, params: { id: 'req_1', assetId: 'asset_1' } } as never)).status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('404s an asset that belongs to another request', async () => {
    findFirst.mockResolvedValueOnce(null);
    const request = new Request('http://localhost/api/ops/preview-requests/req_other/assets/asset_1');
    const response = await GET({ request, params: { id: 'req_other', assetId: 'asset_1' } } as never);
    expect(response.status).toBe(404);
    expect(blobGet).not.toHaveBeenCalled();
  });

  it('downloads the original as an attachment', async () => {
    findFirst.mockResolvedValueOnce({
      id: 'asset_1',
      previewRequestId: 'req_1',
      storagePath: 'preview-hub/req_1/shop_photo/a.jpg',
      thumbPath: 'preview-hub/req_1/shop_photo/a.webp',
      contentType: 'image/jpeg',
      originalFileName: 'chair.jpg',
      deletedAt: null,
    });
    blobGet.mockResolvedValueOnce({
      stream: new ReadableStream(),
      contentType: 'image/jpeg',
      statusCode: 200,
    });
    const request = new Request('http://localhost/api/ops/preview-requests/req_1/assets/asset_1?size=full');
    const response = await GET({ request, params: { id: 'req_1', assetId: 'asset_1' } } as never);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment;/);
    expect(response.headers.get('Content-Disposition')).toContain('chair.jpg');
    expect(blobGet).toHaveBeenCalledWith('preview-hub/req_1/shop_photo/a.jpg');
  });
});
