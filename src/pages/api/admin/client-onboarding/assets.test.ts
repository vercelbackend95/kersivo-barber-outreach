import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { ClientOnboardingAssetKind } from '@prisma/client';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const ensureFindUnique = vi.fn();
const ensureCreate = vi.fn();
const assetCreate = vi.fn();
const uploadPrivate = vi.fn();
const validateCsv = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    clientOnboarding: {
      findUnique: (...args: unknown[]) => ensureFindUnique(...args),
      create: (...args: unknown[]) => ensureCreate(...args),
    },
    clientOnboardingAsset: {
      create: (...args: unknown[]) => assetCreate(...args),
    },
  },
}));

vi.mock('@/lib/storage/privateOnboardingBlob', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/storage/privateOnboardingBlob')
  >('@/lib/storage/privateOnboardingBlob');
  return {
    ...actual,
    uploadPrivateOnboardingFile: (...args: unknown[]) => uploadPrivate(...args),
    validateMigrationCsvFile: (...args: unknown[]) => validateCsv(...args),
  };
});

import { POST } from './assets';
import { looksLikePublicBlobUrl } from '@/lib/storage/privateOnboardingBlob';

const OWNER = {
  shopId: 'shop_1',
  userId: 'user_1',
  userName: 'Alex',
  userEmail: 'alex@example.com',
  emailVerified: true,
  userImage: null,
  via: 'session' as const,
  role: 'OWNER' as const,
  memberId: 'mem_1',
  barberId: null,
  permissions: ['billing.manage'] as const,
};

function makeFormContext(file: File, kind: string): APIContext {
  const form = new FormData();
  form.set('kind', kind);
  form.set('file', file);
  return {
    request: new Request('https://kersivo.test/api/admin/client-onboarding/assets', {
      method: 'POST',
      body: form,
    }),
  } as unknown as APIContext;
}

describe('POST /api/admin/client-onboarding/assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAdminAccess.mockResolvedValue(OWNER);
    requirePermission.mockReturnValue(null);
    ensureFindUnique.mockResolvedValue({ id: 'onb_1', shopId: 'shop_1' });
    validateCsv.mockImplementation(
      (file: { name: string; type: string; size: number }) => {
        if (file.type.startsWith('image/')) return 'mime';
        if (file.size > 10 * 1024 * 1024) return 'oversized';
        if (!file.name.toLowerCase().endsWith('.csv')) return 'extension';
        return null;
      },
    );
  });

  it('rejects image uploads for migration CSV', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', {
      type: 'image/png',
    });
    const res = await POST(
      makeFormContext(file, ClientOnboardingAssetKind.MIGRATION_CSV) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('mime');
    expect(uploadPrivate).not.toHaveBeenCalled();
  });

  it('rejects oversize CSV', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    const file = new File([big], 'big.csv', { type: 'text/csv' });
    const res = await POST(
      makeFormContext(file, ClientOnboardingAssetKind.MIGRATION_CSV) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('oversized');
  });

  it('uploads valid CSV and returns pathname metadata without public URL', async () => {
    const file = new File(['a,b\n1,2\n'], 'clients.csv', { type: 'text/csv' });
    uploadPrivate.mockResolvedValue({
      pathname: 'client-onboarding/shop_1/migration_csv/x-clients.csv',
      contentType: 'text/csv',
      sizeBytes: file.size,
    });
    assetCreate.mockResolvedValue({
      id: 'asset_1',
      kind: ClientOnboardingAssetKind.MIGRATION_CSV,
      storagePath: 'client-onboarding/shop_1/migration_csv/x-clients.csv',
      originalFileName: 'clients.csv',
      contentType: 'text/csv',
      sizeBytes: file.size,
      createdAt: new Date(),
    });

    const res = await POST(
      makeFormContext(file, ClientOnboardingAssetKind.MIGRATION_CSV) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.asset.storagePath).toContain('client-onboarding/');
    expect(looksLikePublicBlobUrl(body.asset.storagePath)).toBe(false);
    expect(JSON.stringify(body)).not.toContain('public.blob.vercel-storage.com');
  });
});
