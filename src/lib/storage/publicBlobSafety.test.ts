import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deletePublicBlobObject = vi.fn();
const listPublicBlobsByPrefix = vi.fn();

vi.mock('@/lib/storage/vercelBlob', () => ({
  deletePublicBlobObject: (...args: unknown[]) => deletePublicBlobObject(...args),
  listPublicBlobsByPrefix: (...args: unknown[]) => listPublicBlobsByPrefix(...args),
}));

import {
  assertUserSuppliedPublicMediaUrlAllowed,
  buildForeignPublicBlobCanonicalSet,
  compensateFreshPublicBlobUpload,
  evaluateShopPurgePublicBlobCandidate,
  evaluateUserSuppliedPublicMediaUrlAssignment,
  getConfiguredPublicBlobStoreHost,
  normalizePublicBlobHttpsUrl,
  UserSuppliedPublicMediaUrlRejectedError,
} from './publicBlobSafety';

const HOST = 'store123.public.blob.vercel-storage.com';

describe('publicBlobSafety', () => {
  const prev = process.env.PUBLIC_BLOB_STORE_HOST;

  beforeEach(() => {
    process.env.PUBLIC_BLOB_STORE_HOST = HOST;
    deletePublicBlobObject.mockReset();
    listPublicBlobsByPrefix.mockReset();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.PUBLIC_BLOB_STORE_HOST;
    else process.env.PUBLIC_BLOB_STORE_HOST = prev;
  });

  it('fail-closed when PUBLIC_BLOB_STORE_HOST missing', () => {
    delete process.env.PUBLIC_BLOB_STORE_HOST;
    expect(getConfiguredPublicBlobStoreHost()).toBeNull();
    expect(normalizePublicBlobHttpsUrl(`https://${HOST}/shops/a/logo.webp`)).toBeNull();
  });

  it('rejects foreign host, http, pathname-only, wrong store host', () => {
    expect(normalizePublicBlobHttpsUrl('https://evil.example/shops/a/x.webp')).toBeNull();
    expect(normalizePublicBlobHttpsUrl(`http://${HOST}/shops/a/x.webp`)).toBeNull();
    expect(normalizePublicBlobHttpsUrl('shops/a/x.webp')).toBeNull();
    expect(
      normalizePublicBlobHttpsUrl('https://other.public.blob.vercel-storage.com/shops/a/x.webp'),
    ).toBeNull();
    expect(normalizePublicBlobHttpsUrl(`https://${HOST.replace('.public.', '.private.')}/shops/a/x.webp`)).toBeNull();
  });

  it('accepts correct public host and strips query/hash in canonical form', () => {
    const n = normalizePublicBlobHttpsUrl(`https://${HOST}/shops/shop-a/products/x.webp?download=1#h`);
    expect(n).toEqual({
      host: HOST,
      pathname: 'shops/shop-a/products/x.webp',
      canonicalUrl: `https://${HOST}/shops/shop-a/products/x.webp`,
    });
  });

  it('rejects wrong shops/{otherShopId} for purge candidate', () => {
    const decision = evaluateShopPurgePublicBlobCandidate(
      `https://${HOST}/shops/other/products/x.webp`,
      'shop-a',
    );
    expect(decision.ok).toBe(false);
  });

  it('accepts legacy namespace for DB-owned purge candidate when shop-prefixed id matches or legacy', () => {
    expect(
      evaluateShopPurgePublicBlobCandidate(`https://${HOST}/barbers/avatar.webp`, 'shop-a').ok,
    ).toBe(true);
    expect(
      evaluateShopPurgePublicBlobCandidate(`https://${HOST}/shops/shop-a/logo.webp`, 'shop-a').ok,
    ).toBe(true);
    expect(evaluateShopPurgePublicBlobCandidate('/demo/products/x.webp', 'shop-a').ok).toBe(false);
  });

  it('buildForeignPublicBlobCanonicalSet normalizes other-shop refs', async () => {
    const db = {
      shopSettings: {
        findMany: vi.fn().mockResolvedValue([{ logoUrl: `https://${HOST}/shops/b/logo.webp?x=1` }]),
      },
      product: { findMany: vi.fn().mockResolvedValue([]) },
      service: { findMany: vi.fn().mockResolvedValue([]) },
      barber: {
        findMany: vi.fn().mockResolvedValue([{ avatarUrl: `https://${HOST}/barbers/shared.webp` }]),
      },
      client: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const set = await buildForeignPublicBlobCanonicalSet('shop-a', db as never);
    expect(set.has(`https://${HOST}/shops/b/logo.webp`)).toBe(true);
    expect(set.has(`https://${HOST}/barbers/shared.webp`)).toBe(true);
  });

  it('compensateFreshPublicBlobUpload deletes validated fresh URL', async () => {
    deletePublicBlobObject.mockResolvedValue(undefined);
    await compensateFreshPublicBlobUpload(`https://${HOST}/products/new.webp`, {
      shopId: 'shop-a',
      expectedPathPrefix: 'products/',
    });
    expect(deletePublicBlobObject).toHaveBeenCalledWith(`https://${HOST}/products/new.webp`);
  });

  describe('user-supplied public media URL assignment', () => {
    it('rejects foreign shop prefix for Shop B', () => {
      const d = evaluateUserSuppliedPublicMediaUrlAssignment({
        shopId: 'shop-b',
        proposedUrl: `https://${HOST}/shops/shop-a/products/x.webp`,
      });
      expect(d.ok).toBe(false);
    });

    it('allows own shop detached product/service URLs', () => {
      expect(
        evaluateUserSuppliedPublicMediaUrlAssignment({
          shopId: 'shop-a',
          proposedUrl: `https://${HOST}/shops/shop-a/products/x.webp`,
        }).ok,
      ).toBe(true);
      expect(
        evaluateUserSuppliedPublicMediaUrlAssignment({
          shopId: 'shop-a',
          proposedUrl: `https://${HOST}/shops/shop-a/services/y.webp`,
        }).ok,
      ).toBe(true);
    });

    it('rejects user-supplied legacy products/barbers/clients namespaces', () => {
      for (const path of ['products/legacy.webp', 'barbers/legacy.webp', 'clients/legacy.webp']) {
        expect(
          evaluateUserSuppliedPublicMediaUrlAssignment({
            shopId: 'shop-b',
            proposedUrl: `https://${HOST}/${path}`,
          }).ok,
        ).toBe(false);
      }
    });

    it('allows exact unchanged legacy URL on the same entity', () => {
      const legacy = `https://${HOST}/products/legacy.webp`;
      expect(
        evaluateUserSuppliedPublicMediaUrlAssignment({
          shopId: 'shop-a',
          proposedUrl: `${legacy}?x=1`,
          existingUrl: legacy,
        }),
      ).toEqual({ ok: true, reason: 'unchanged_existing' });
    });

    it('rejects copying legacy URL to a different entity (no existing match)', () => {
      expect(() =>
        assertUserSuppliedPublicMediaUrlAllowed({
          shopId: 'shop-a',
          proposedUrl: `https://${HOST}/barbers/legacy.webp`,
          existingUrl: `https://${HOST}/barbers/other.webp`,
        }),
      ).toThrow(UserSuppliedPublicMediaUrlRejectedError);
    });

    it('allows external HTTPS image URLs', () => {
      expect(
        evaluateUserSuppliedPublicMediaUrlAssignment({
          shopId: 'shop-a',
          proposedUrl: 'https://cdn.example.com/img.webp',
        }),
      ).toEqual({ ok: true, reason: 'external' });
    });

    it('treats foreign Vercel public store as external (not KERSIVO-owned)', () => {
      expect(
        evaluateUserSuppliedPublicMediaUrlAssignment({
          shopId: 'shop-a',
          proposedUrl: 'https://other.public.blob.vercel-storage.com/shops/a/x.webp',
        }),
      ).toEqual({ ok: true, reason: 'external' });
    });

    it('fail-closed for malformed URL on configured public host', () => {
      expect(
        evaluateUserSuppliedPublicMediaUrlAssignment({
          shopId: 'shop-a',
          proposedUrl: `https://${HOST}/%2e%2e/escape.webp`,
        }).ok,
      ).toBe(false);
    });

    it('rejects foreign detached product/service shop prefix', () => {
      expect(
        evaluateUserSuppliedPublicMediaUrlAssignment({
          shopId: 'shop-a',
          proposedUrl: `https://${HOST}/shops/shop-b/products/x.webp`,
        }).ok,
      ).toBe(false);
      expect(
        evaluateUserSuppliedPublicMediaUrlAssignment({
          shopId: 'shop-a',
          proposedUrl: `https://${HOST}/shops/shop-b/services/y.webp`,
        }).ok,
      ).toBe(false);
    });
  });
});
