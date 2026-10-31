import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const enforceHubAssetRates = vi.fn();
const resolveHubApiContext = vi.fn();
const requireUploadCapability = vi.fn();
const processHubUpload = vi.fn();
const assertHubUploadCaps = vi.fn();
const storeProcessedHubFile = vi.fn();
const loadActiveHubAssets = vi.fn();
const maybeNotifyOpsOfHubFiles = vi.fn();
const sendServerAnalyticsEvent = vi.fn();
const eventCreate = vi.fn();

vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    enforceHubAssetRates: (...args: unknown[]) => enforceHubAssetRates(...args),
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
    requireUploadCapability: (...args: unknown[]) => requireUploadCapability(...args),
  };
});
vi.mock('@/lib/freePreview/hubAssets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubAssets')>();
  return {
    ...actual,
    processHubUpload: (...args: unknown[]) => processHubUpload(...args),
    assertHubUploadCaps: (...args: unknown[]) => assertHubUploadCaps(...args),
    storeProcessedHubFile: (...args: unknown[]) => storeProcessedHubFile(...args),
    loadActiveHubAssets: (...args: unknown[]) => loadActiveHubAssets(...args),
  };
});
vi.mock('@/lib/freePreview/hubFilesNotify', () => ({
  maybeNotifyOpsOfHubFiles: (...args: unknown[]) => maybeNotifyOpsOfHubFiles(...args),
}));
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => 'cid',
  sendServerAnalyticsEvent: (...args: unknown[]) => sendServerAnalyticsEvent(...args),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: { previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) } },
}));

import { GET, POST } from './assets';

const TOKEN = 'A'.repeat(43);
const origin = 'http://localhost';

function ctx(caps = { canUpload: true }) {
  return {
    token: TOKEN,
    request: { id: 'req_1', shopName: 'Sharp Cuts', publicToken: TOKEN },
    state: { kind: 'hub', stage: 'requested', capabilities: caps },
    isOperator: false,
    draft: null,
  };
}

function post(file: File, kind = 'SHOP_PHOTO', headers: Record<string, string> = {}) {
  const body = new FormData();
  body.append('kind', kind);
  body.append('file', file);
  const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/assets`, {
    method: 'POST',
    headers: { origin, ...headers },
    body,
  });
  return POST({ request, params: { token: TOKEN } } as never);
}

beforeEach(() => {
  vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
  vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
  enforceHubAssetRates.mockReset().mockResolvedValue(null);
  requireUploadCapability.mockReset().mockReturnValue(null);
  resolveHubApiContext.mockReset().mockResolvedValue({ ok: true, ctx: ctx() });
  processHubUpload.mockReset().mockResolvedValue({
    ok: true,
    file: { kind: 'SHOP_PHOTO', sizeBytes: 100, buffer: Buffer.from('x'), contentType: 'image/jpeg' },
  });
  assertHubUploadCaps.mockReset().mockResolvedValue({ ok: true });
  storeProcessedHubFile.mockReset().mockResolvedValue({
    id: 'asset_1',
    kind: 'SHOP_PHOTO',
    originalFileName: 'shop.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 100,
    width: 10,
    height: 8,
    caption: null,
    sortOrder: 0,
    barberId: null,
    uploadedBy: 'OWNER',
    createdAt: new Date('2026-10-31T12:00:00Z'),
    thumbPath: 'thumb',
  });
  loadActiveHubAssets.mockReset().mockResolvedValue([]);
  maybeNotifyOpsOfHubFiles.mockReset().mockResolvedValue('sent');
  sendServerAnalyticsEvent.mockReset();
  eventCreate.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/preview-hub/[token]/assets', () => {
  it('uploads on the happy path and writes hub_asset_uploaded', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'shop.jpg', { type: 'image/jpeg' });
    const response = await post(file);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.asset.id).toBe('asset_1');
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'hub_asset_uploaded', meta: { kind: 'SHOP_PHOTO', assetId: 'asset_1' } }),
      }),
    );
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'hub_asset_uploaded', params: { kind: 'SHOP_PHOTO' } }),
    );
  });

  it('404s when the hub flag is off', async () => {
    resolveHubApiContext.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: 'Not found.' }), { status: 404 }),
    });
    const file = new File([new Uint8Array([1])], 'shop.jpg', { type: 'image/jpeg' });
    const response = await post(file);
    expect(response.status).toBe(404);
    expect(processHubUpload).not.toHaveBeenCalled();
  });

  it('denies upload when the stage cannot upload', async () => {
    requireUploadCapability.mockReturnValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'denied' }), { status: 403 }),
    );
    const file = new File([new Uint8Array([1])], 'shop.jpg', { type: 'image/jpeg' });
    expect((await post(file)).status).toBe(403);
    expect(processHubUpload).not.toHaveBeenCalled();
  });

  it('rejects an unknown kind', async () => {
    const file = new File([new Uint8Array([1])], 'shop.jpg', { type: 'image/jpeg' });
    const response = await post(file, 'NOT_A_KIND');
    expect(response.status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    enforceHubAssetRates.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    const file = new File([new Uint8Array([1])], 'shop.jpg', { type: 'image/jpeg' });
    expect((await post(file)).status).toBe(429);
  });

  it('rejects a body over 4 MB from Content-Length', async () => {
    const file = new File([new Uint8Array([1])], 'shop.jpg', { type: 'image/jpeg' });
    const response = await post(file, 'SHOP_PHOTO', { 'content-length': String(5 * 1024 * 1024) });
    expect(response.status).toBe(413);
  });
});

describe('GET /api/preview-hub/[token]/assets', () => {
  it('lists active assets', async () => {
    loadActiveHubAssets.mockResolvedValueOnce([
      {
        id: 'asset_1',
        kind: 'LOGO',
        originalFileName: 'mark.png',
        contentType: 'image/png',
        sizeBytes: 10,
        width: 8,
        height: 8,
        caption: null,
        sortOrder: 0,
        barberId: null,
        uploadedBy: 'OWNER',
        createdAt: new Date('2026-10-31T12:00:00Z'),
        thumbPath: 't',
      },
    ]);
    const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/assets`);
    const response = await GET({ request, params: { token: TOKEN } } as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.assets[0].id).toBe('asset_1');
  });
});
