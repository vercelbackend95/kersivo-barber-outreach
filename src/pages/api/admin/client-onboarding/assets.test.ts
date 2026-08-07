import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { ClientOnboardingAssetKind, ClientOnboardingStatus } from '@prisma/client';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const isPaidShop = vi.fn();
const ensureUpsert = vi.fn();
const assetCreate = vi.fn();
const assetFindFirst = vi.fn();
const assetDelete = vi.fn();
const uploadPrivate = vi.fn();
const deletePrivate = vi.fn();
const shopSettingsFindUnique = vi.fn();
const saasFindFirst = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/shop/paidShop', () => ({
  isPaidShop: (...args: unknown[]) => isPaidShop(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => shopSettingsFindUnique(...args),
    },
    saasSubscription: {
      findFirst: (...args: unknown[]) => saasFindFirst(...args),
    },
    clientOnboarding: {
      upsert: (...args: unknown[]) => ensureUpsert(...args),
      findUnique: (...args: unknown[]) => ensureUpsert(...args),
    },
    clientOnboardingAsset: {
      create: (...args: unknown[]) => assetCreate(...args),
      findFirst: (...args: unknown[]) => assetFindFirst(...args),
      delete: (...args: unknown[]) => assetDelete(...args),
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
    deletePrivateOnboardingFile: (...args: unknown[]) => deletePrivate(...args),
  };
});

import { POST, DELETE } from './assets';
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

function draftOnboarding(status: ClientOnboardingStatus = ClientOnboardingStatus.DRAFT) {
  return { id: 'onb_1', shopId: 'shop_1', status };
}

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

function makeDeleteContext(id: string): APIContext {
  return {
    request: new Request('https://kersivo.test/api/admin/client-onboarding/assets', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    }),
  } as unknown as APIContext;
}

describe('POST/DELETE /api/admin/client-onboarding/assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAdminAccess.mockResolvedValue(OWNER);
    requirePermission.mockReturnValue(null);
    isPaidShop.mockReturnValue(true);
    shopSettingsFindUnique.mockResolvedValue({
      id: 'shop_1',
      shopPaidAt: new Date(),
      smsRemindersEnabled: true,
    });
    saasFindFirst.mockResolvedValue({
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 86400000),
      pastDueSince: null,
    });
    ensureUpsert.mockResolvedValue(draftOnboarding());
  });

  it('rejects image uploads for migration CSV', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', {
      type: 'image/png',
    });
    const res = await POST(
      makeFormContext(file, ClientOnboardingAssetKind.MIGRATION_CSV) as never,
    );
    expect(res.status).toBe(400);
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
    expect(looksLikePublicBlobUrl(body.asset.storagePath)).toBe(false);
  });

  it('cleans up orphan blob when DB create fails', async () => {
    const file = new File(['a,b\n1,2\n'], 'clients.csv', { type: 'text/csv' });
    uploadPrivate.mockResolvedValue({
      pathname: 'client-onboarding/shop_1/migration_csv/orphan.csv',
      contentType: 'text/csv',
      sizeBytes: file.size,
    });
    assetCreate.mockRejectedValue(new Error('unique conflict'));
    deletePrivate.mockResolvedValue(undefined);

    const res = await POST(
      makeFormContext(file, ClientOnboardingAssetKind.MIGRATION_CSV) as never,
    );
    expect(res.status).toBe(500);
    expect(deletePrivate).toHaveBeenCalledWith(
      'client-onboarding/shop_1/migration_csv/orphan.csv',
    );
  });

  it('does not delete DB row when blob delete fails', async () => {
    assetFindFirst.mockResolvedValue({
      id: 'asset_1',
      shopId: 'shop_1',
      storagePath: 'client-onboarding/shop_1/x.csv',
    });
    deletePrivate.mockRejectedValue(new Error('blob down'));

    const res = await DELETE(makeDeleteContext('asset_1') as never);
    expect(res.status).toBe(503);
    expect(assetDelete).not.toHaveBeenCalled();
  });

  it('rejects unpaid owner upload', async () => {
    isPaidShop.mockReturnValue(false);
    const file = new File(['a,b\n'], 'clients.csv', { type: 'text/csv' });
    const res = await POST(
      makeFormContext(file, ClientOnboardingAssetKind.MIGRATION_CSV) as never,
    );
    expect(res.status).toBe(403);
  });

  it('rejects upload when SUBMITTED (write lock)', async () => {
    ensureUpsert.mockResolvedValue(draftOnboarding(ClientOnboardingStatus.SUBMITTED));
    const file = new File(['a,b\n'], 'clients.csv', { type: 'text/csv' });
    const res = await POST(
      makeFormContext(file, ClientOnboardingAssetKind.MIGRATION_CSV) as never,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CLIENT_ONBOARDING_LOCKED');
  });
});
