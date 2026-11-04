import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { previewRequest, barber, product, service, shopSettings } = vi.hoisted(() => ({
  previewRequest: { findUnique: vi.fn() },
  barber: { findFirst: vi.fn() },
  product: { findFirst: vi.fn() },
  service: { findFirst: vi.fn() },
  shopSettings: { findUnique: vi.fn() },
}));

vi.mock('@/lib/db/client', () => ({ prisma: { previewRequest, barber, product, service, shopSettings } }));

import {
  buildRemoteImageThumb,
  lookupPackRemoteImageUrl,
  parseRemoteImageRef,
  parseThumbWidth,
  remoteImageThumbUrl,
} from './buildPackRemoteImageThumb';

const STORE = 'abc123.public.blob.vercel-storage.com';
const IMAGE_URL = `https://${STORE}/barbers/avatar.png`;

async function bigPng(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 200, g: 20, b: 20 } } })
    .png()
    .toBuffer();
}

function imageResponse(bytes: Buffer, type = 'image/png'): Response {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': type } });
}

beforeEach(() => {
  vi.clearAllMocks();
  previewRequest.findUnique.mockResolvedValue({ draftShopId: 'shop_1', anonymisedAt: null });
});

describe('parseRemoteImageRef / parseThumbWidth', () => {
  it('accepts the four pack sources only', () => {
    expect(parseRemoteImageRef('barber:clx_1')).toEqual({ source: 'barber', ownerId: 'clx_1' });
    expect(parseRemoteImageRef('shopLogo:shop_1')).toEqual({ source: 'shopLogo', ownerId: 'shop_1' });
    expect(parseRemoteImageRef('asset:abc')).toBeNull();
    expect(parseRemoteImageRef('barber:')).toBeNull();
    expect(parseRemoteImageRef('https://evil.example/x.png')).toBeNull();
    expect(parseRemoteImageRef('barber:../../x')).toBeNull();
    expect(parseRemoteImageRef(null)).toBeNull();
  });

  it('allows 96 and 240 px only', () => {
    expect(parseThumbWidth('96')).toBe(96);
    expect(parseThumbWidth('240')).toBe(240);
    expect(parseThumbWidth('2000')).toBeNull();
    expect(parseThumbWidth(null)).toBeNull();
  });

  it('builds the Overview URL from a ref, never from the image URL', () => {
    const url = remoteImageThumbUrl('req_1', { source: 'product', ownerId: 'p1' }, 96);
    expect(url).toBe('/api/ops/preview-requests/req_1/remote-image?ref=product%3Ap1&w=96');
  });
});

describe('lookupPackRemoteImageUrl', () => {
  it('scopes the row to the request draft shop with the pack filters', async () => {
    barber.findFirst.mockResolvedValueOnce({ avatarUrl: ` ${IMAGE_URL} ` });
    await expect(lookupPackRemoteImageUrl('req_1', { source: 'barber', ownerId: 'b1' })).resolves.toEqual({
      ok: true,
      url: IMAGE_URL,
    });
    expect(barber.findFirst).toHaveBeenCalledWith({
      where: { id: 'b1', shopId: 'shop_1', active: true, showOnWebsite: true },
      select: { avatarUrl: true },
    });
  });

  it('refuses a shop logo ref for another shop without querying', async () => {
    await expect(lookupPackRemoteImageUrl('req_1', { source: 'shopLogo', ownerId: 'shop_other' })).resolves.toEqual({
      ok: false,
      reason: 'image_not_found',
    });
    expect(shopSettings.findUnique).not.toHaveBeenCalled();
  });

  it('410s an anonymised request and 404s a request with no draft shop', async () => {
    previewRequest.findUnique.mockResolvedValueOnce({ draftShopId: 'shop_1', anonymisedAt: new Date() });
    expect(await lookupPackRemoteImageUrl('req_1', { source: 'product', ownerId: 'p1' })).toEqual({ ok: false, reason: 'gone' });
    previewRequest.findUnique.mockResolvedValueOnce({ draftShopId: null, anonymisedAt: null });
    expect(await lookupPackRemoteImageUrl('req_1', { source: 'product', ownerId: 'p1' })).toEqual({
      ok: false,
      reason: 'image_not_found',
    });
  });
});

describe('buildRemoteImageThumb', () => {
  it('resizes a large PNG to a small WebP', async () => {
    product.findFirst.mockResolvedValueOnce({ imageUrl: IMAGE_URL });
    const fetchImpl = vi.fn().mockResolvedValue(imageResponse(await bigPng()));
    const result = await buildRemoteImageThumb('req_1', { source: 'product', ownerId: 'p1' }, 96, { fetchImpl, storeHost: STORE });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.bytes).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(96);
    expect(meta.height).toBe(64);
    expect(fetchImpl).toHaveBeenCalledWith(IMAGE_URL, expect.objectContaining({ redirect: 'error' }));
  });

  it('never enlarges a small image', async () => {
    service.findFirst.mockResolvedValueOnce({ imageUrl: IMAGE_URL });
    const small = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#000' } }).png().toBuffer();
    const result = await buildRemoteImageThumb('req_1', { source: 'service', ownerId: 's1' }, 240, {
      fetchImpl: vi.fn().mockResolvedValue(imageResponse(small)),
      storeHost: STORE,
    });
    expect(result.ok && (await sharp(result.bytes).metadata()).width).toBe(40);
  });

  it('does not fetch a URL outside the allowlisted store', async () => {
    barber.findFirst.mockResolvedValueOnce({ avatarUrl: 'https://evil.example/a.png' });
    const fetchImpl = vi.fn();
    const result = await buildRemoteImageThumb('req_1', { source: 'barber', ownerId: 'b1' }, 96, { fetchImpl, storeHost: STORE });
    expect(result).toEqual({ ok: false, status: 502, reason: 'external URL not fetched' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports a non-image body as unreadable', async () => {
    product.findFirst.mockResolvedValueOnce({ imageUrl: IMAGE_URL });
    const result = await buildRemoteImageThumb('req_1', { source: 'product', ownerId: 'p1' }, 96, {
      fetchImpl: vi.fn().mockResolvedValue(imageResponse(Buffer.from('not really a png'))),
      storeHost: STORE,
    });
    expect(result).toEqual({ ok: false, status: 422, reason: 'not a readable image' });
  });
});
