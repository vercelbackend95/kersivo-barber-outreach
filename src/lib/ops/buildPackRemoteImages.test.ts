import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import {
  REMOTE_IMAGE_NOT_FETCHED,
  collectRemoteImages,
  extensionForContentType,
  fetchRemoteImage,
  isAllowedRemoteImageUrl,
  remoteImageExtension,
  remoteImageStoreHost,
} from './buildPackRemoteImages';

const HOST = 'abc123store.public.blob.vercel-storage.com';
const URL_OK = `https://${HOST}/shops/shop_1/products/wax-AbC.png`;

function imageResponse(bytes: number, init: { type?: string; length?: boolean; status?: number } = {}) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Two chunks, so the cap is checked while reading, not only from Content-Length.
      const half = Math.floor(bytes / 2);
      controller.enqueue(new Uint8Array(half).fill(1));
      controller.enqueue(new Uint8Array(bytes - half).fill(2));
      controller.close();
    },
  });
  const headers: Record<string, string> = { 'content-type': init.type ?? 'image/png' };
  if (init.length) headers['content-length'] = String(bytes);
  return new Response(body, { status: init.status ?? 200, headers });
}

describe('remote image store host', () => {
  it('uses PUBLIC_BLOB_STORE_HOST when it is a public store host', () => {
    expect(remoteImageStoreHost({ PUBLIC_BLOB_STORE_HOST: ` ${HOST.toUpperCase()} ` })).toBe(HOST);
  });

  it('falls back to the store id of the read-write token (preview deployments)', () => {
    expect(remoteImageStoreHost({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_AbC123Store_secretPart' })).toBe(HOST);
  });

  it('fails closed without config or with a bad host', () => {
    expect(remoteImageStoreHost({})).toBeNull();
    expect(remoteImageStoreHost({ PUBLIC_BLOB_STORE_HOST: 'evil.com' })).toBeNull();
    expect(remoteImageStoreHost({ BLOB_READ_WRITE_TOKEN: 'not-a-token' })).toBeNull();
  });
});

describe('remote image allowlist', () => {
  it('accepts https URLs on this project store', () => {
    expect(isAllowedRemoteImageUrl(URL_OK, HOST)).toBe(true);
    expect(isAllowedRemoteImageUrl(`https://${HOST}:443/barbers/a.jpg`, HOST)).toBe(true);
  });

  it.each([
    ['http scheme', `http://${HOST}/a.png`],
    ['another store', 'https://otherstore.public.blob.vercel-storage.com/a.png'],
    ['suffix attack', `https://${HOST}.evil.com/a.png`],
    ['vercel-storage lookalike', 'https://abc123store.public.blob.vercel-storage.com.evil.com/a.png'],
    ['other host', 'https://example.com/a.png'],
    ['IPv4 literal', 'https://127.0.0.1/a.png'],
    ['IPv6 literal', 'https://[::1]/a.png'],
    ['metadata IP', 'https://169.254.169.254/latest/meta-data'],
    ['localhost', 'https://localhost/a.png'],
    ['credentials', `https://user:pass@${HOST}/a.png`],
    ['odd port', `https://${HOST}:8443/a.png`],
    ['not a URL', 'shops/shop_1/a.png'],
    ['javascript', 'javascript:alert(1)'],
  ])('rejects %s', (_label, url) => {
    expect(isAllowedRemoteImageUrl(url, HOST)).toBe(false);
  });

  it('rejects everything when no store host is known', () => {
    expect(isAllowedRemoteImageUrl(URL_OK, null)).toBe(false);
  });
});

describe('fetchRemoteImage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads an allowlisted image without following redirects', async () => {
    const fetchImpl = vi.fn(async () => imageResponse(10));
    const result = await fetchRemoteImage(URL_OK, { storeHost: HOST, fetchImpl: fetchImpl as never });
    expect(result).toMatchObject({ ok: true, contentType: 'image/png' });
    expect(result.ok && result.bytes.byteLength).toBe(10);
    expect(fetchImpl).toHaveBeenCalledWith(URL_OK, expect.objectContaining({ redirect: 'error' }));
  });

  it('never calls fetch for a URL outside the allowlist', async () => {
    const fetchImpl = vi.fn();
    const result = await fetchRemoteImage('https://example.com/a.png', { storeHost: HOST, fetchImpl: fetchImpl as never });
    expect(result).toEqual({ ok: false, reason: REMOTE_IMAGE_NOT_FETCHED });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a body over the size cap while reading (no Content-Length)', async () => {
    const result = await fetchRemoteImage(URL_OK, { storeHost: HOST, maxBytes: 8, fetchImpl: (async () => imageResponse(20)) as never });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/^larger than/);
  });

  it('refuses a declared Content-Length over the cap', async () => {
    const result = await fetchRemoteImage(URL_OK, {
      storeHost: HOST,
      maxBytes: 8,
      fetchImpl: (async () => imageResponse(20, { length: true })) as never,
    });
    expect(!result.ok && result.reason).toMatch(/^larger than/);
  });

  it('refuses a non-image content type', async () => {
    const result = await fetchRemoteImage(URL_OK, { storeHost: HOST, fetchImpl: (async () => imageResponse(5, { type: 'text/html' })) as never });
    expect(result).toEqual({ ok: false, reason: 'not an image (text/html)' });
  });

  it('reports HTTP errors, redirects and timeouts as reasons', async () => {
    const notFound = await fetchRemoteImage(URL_OK, { storeHost: HOST, fetchImpl: (async () => imageResponse(1, { status: 404 })) as never });
    expect(notFound).toEqual({ ok: false, reason: 'download failed (HTTP 404)' });

    const redirect = await fetchRemoteImage(URL_OK, {
      storeHost: HOST,
      fetchImpl: (async () => {
        throw new TypeError('unexpected redirect');
      }) as never,
    });
    expect(redirect).toEqual({ ok: false, reason: 'download failed (unexpected redirect)' });

    const slow = await fetchRemoteImage(URL_OK, {
      storeHost: HOST,
      timeoutMs: 5,
      fetchImpl: ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))))) as never,
    });
    expect(slow).toEqual({ ok: false, reason: 'timed out' });
  });
});

describe('collectRemoteImages and extensions', () => {
  it('collects avatars, product, service and shop logo images with stable ids', () => {
    const images = collectRemoteImages({
      team: [{ id: 'b1', name: 'Jess', avatarUrl: URL_OK }, { id: 'b2', name: 'Sam', avatarUrl: null }],
      products: [{ id: 'p1', name: 'Wax', imageUrl: ' ' }],
      services: [{ id: 's1', name: 'Haircut', imageUrl: URL_OK }],
      shop: { id: 'shop_1', name: 'Fade', logoUrl: URL_OK },
    });
    expect(images.map((image) => image.id)).toEqual(['barber:b1', 'service:s1', 'shopLogo:shop_1']);
  });

  it('takes the extension from the URL, else from the content type', () => {
    expect(remoteImageExtension(URL_OK)).toBe('png');
    expect(remoteImageExtension(`https://${HOST}/a/b`)).toBeNull();
    expect(extensionForContentType('image/jpeg; charset=binary')).toBe('jpg');
    expect(extensionForContentType('image/x-unknown')).toBe('img');
  });
});
