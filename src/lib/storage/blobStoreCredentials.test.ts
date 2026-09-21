import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();
const get = vi.fn();
const del = vi.fn();

vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => put(...args),
  get: (...args: unknown[]) => get(...args),
  del: (...args: unknown[]) => del(...args),
}));

describe('Blob store credential split (public vs private)', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    put.mockReset();
    get.mockReset();
    del.mockReset();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    delete process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('public helper resolves BLOB_READ_WRITE_TOKEN and VERCEL_BLOB alias only', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'public-token-a';
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'private-token-b';
    const { getBlobReadWriteToken, getPrivateBlobReadWriteToken } = await import('./vercelBlob');
    expect(getBlobReadWriteToken()).toBe('public-token-a');
    expect(getPrivateBlobReadWriteToken()).toBe('private-token-b');
  });

  it('public helper accepts VERCEL_BLOB_READ_WRITE_TOKEN alias', async () => {
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN = 'public-alias';
    const { getBlobReadWriteToken, getPrivateBlobReadWriteToken } = await import('./vercelBlob');
    expect(getBlobReadWriteToken()).toBe('public-alias');
    expect(getPrivateBlobReadWriteToken()).toBeNull();
  });

  it('private helper never falls back to public tokens', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'public-only';
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN = 'public-alias-only';
    const { getPrivateBlobReadWriteToken } = await import('./vercelBlob');
    expect(getPrivateBlobReadWriteToken()).toBeNull();
  });

  it('public upload uses public token and access public, not private token', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'public-token';
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'private-token';

    // Force HTTP fallback path so we do not depend on dynamic @vercel/blob import.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://example.public.blob.vercel-storage.com/products/x.webp' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { uploadPublicImageToBlob } = await import('./vercelBlob');
    const file = new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' });
    const url = await uploadPublicImageToBlob(file, 'products/x.png');
    expect(url).toContain('public.blob.vercel-storage.com');
    expect(fetchMock).toHaveBeenCalled();
    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toContain('access=public');
    expect(String(init.headers && (init.headers as Record<string, string>).Authorization)).toBe(
      'Bearer public-token',
    );
    expect(String(init.headers && (init.headers as Record<string, string>).Authorization)).not.toContain(
      'private-token',
    );

    vi.unstubAllGlobals();
  });

  it('private put/get/del all use PRIVATE_BLOB_READ_WRITE_TOKEN', async () => {
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'private-token';
    process.env.BLOB_READ_WRITE_TOKEN = 'public-token-must-not-be-used';

    put.mockResolvedValue({ pathname: 'client-onboarding/shop/m.csv' });
    get.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream(),
      blob: { contentType: 'text/csv' },
    });
    del.mockResolvedValue(undefined);

    const {
      uploadPrivateOnboardingFile,
      retrievePrivateOnboardingFile,
      deletePrivateOnboardingFile,
    } = await import('./privateOnboardingBlob');

    const file = new File([new Uint8Array([1])], 'm.csv', { type: 'text/csv' });
    await uploadPrivateOnboardingFile(file, 'client-onboarding/shop/m.csv', 'text/csv');
    await retrievePrivateOnboardingFile('client-onboarding/shop/m.csv');
    await deletePrivateOnboardingFile('client-onboarding/shop/m.csv');

    expect(put).toHaveBeenCalledWith(
      'client-onboarding/shop/m.csv',
      file,
      expect.objectContaining({
        access: 'private',
        token: 'private-token',
      }),
    );
    expect(get).toHaveBeenCalledWith(
      'client-onboarding/shop/m.csv',
      expect.objectContaining({
        access: 'private',
        token: 'private-token',
      }),
    );
    expect(del).toHaveBeenCalledWith(
      'client-onboarding/shop/m.csv',
      expect.objectContaining({ token: 'private-token' }),
    );

    for (const call of [...put.mock.calls, ...get.mock.calls, ...del.mock.calls]) {
      const opts = call[call.length - 1] as { token?: string; access?: string };
      expect(opts.token).toBe('private-token');
      expect(opts.token).not.toBe('public-token-must-not-be-used');
      if ('access' in opts && opts.access !== undefined) {
        expect(opts.access).toBe('private');
      }
    }
  });

  it('private ops fail closed when PRIVATE_BLOB_READ_WRITE_TOKEN is missing', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'public-token-present';
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN = 'public-alias-present';

    const {
      uploadPrivateOnboardingFile,
      retrievePrivateOnboardingFile,
      deletePrivateOnboardingFile,
    } = await import('./privateOnboardingBlob');

    const file = new File([new Uint8Array([1])], 'm.csv', { type: 'text/csv' });
    await expect(
      uploadPrivateOnboardingFile(file, 'client-onboarding/shop/m.csv'),
    ).rejects.toThrow(/PRIVATE_BLOB_READ_WRITE_TOKEN/);
    await expect(retrievePrivateOnboardingFile('client-onboarding/shop/m.csv')).rejects.toThrow(
      /PRIVATE_BLOB_READ_WRITE_TOKEN/,
    );
    await expect(deletePrivateOnboardingFile('client-onboarding/shop/m.csv')).rejects.toThrow(
      /PRIVATE_BLOB_READ_WRITE_TOKEN/,
    );

    expect(put).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('private source never uses access public', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(new URL('./privateOnboardingBlob.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/access:\s*['"]public['"]/);
    expect(src).toMatch(/access:\s*['"]private['"]/);
    expect(src).toMatch(/getPrivateBlobReadWriteToken/);
    expect(src).not.toMatch(/getBlobReadWriteToken/);
  });

  it('client-note image upload ultimately uses private credential', async () => {
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'private-note-token';
    process.env.BLOB_READ_WRITE_TOKEN = 'public-must-not-be-used';

    put.mockImplementation(async (pathname: string) => ({ pathname }));

    vi.doMock('@/lib/storage/convertImageToWebp', () => ({
      convertImageFileToWebp: vi.fn(async () => Buffer.from([1, 2, 3])),
    }));

    const { storeNoteImage } = await import('./storeNoteImage');
    const file = new File([new Uint8Array([9])], 'note.jpg', { type: 'image/jpeg' });
    const pathname = await storeNoteImage(file, 'shop', 'client', 'note', 0);
    expect(pathname).toBe('client-notes/shop/client/note-0.webp');
    expect(put).toHaveBeenCalledWith(
      'client-notes/shop/client/note-0.webp',
      expect.any(File),
      expect.objectContaining({
        access: 'private',
        token: 'private-note-token',
        contentType: 'image/webp',
      }),
    );
  });
});
