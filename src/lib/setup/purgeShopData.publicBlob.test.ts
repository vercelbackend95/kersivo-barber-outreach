import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deletePrivateOnboardingFile = vi.fn();
const deletePublicBlobObject = vi.fn();
const listPublicBlobsByPrefix = vi.fn();
const captureOpsMessage = vi.fn();

vi.mock('@/lib/storage/privateOnboardingBlob', () => ({
  deletePrivateOnboardingFile: (...args: unknown[]) => deletePrivateOnboardingFile(...args),
}));

vi.mock('@/lib/storage/vercelBlob', () => ({
  deletePublicBlobObject: (...args: unknown[]) => deletePublicBlobObject(...args),
  listPublicBlobsByPrefix: (...args: unknown[]) => listPublicBlobsByPrefix(...args),
}));

vi.mock('@/lib/ops/sentry', () => ({
  captureOpsMessage: (...args: unknown[]) => captureOpsMessage(...args),
}));

const queryRaw = vi.fn();
const shopSettingsUpdate = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transaction(...args),
    shopSettings: {
      update: (...args: unknown[]) => shopSettingsUpdate(...args),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    product: { findMany: vi.fn() },
    service: { findMany: vi.fn() },
    barber: { findMany: vi.fn() },
    client: { findMany: vi.fn() },
    clientOnboardingAsset: { findMany: vi.fn() },
    clientNoteImage: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/db/client';
import {
  beginShopPurgeGate,
  deletePublicBlobUrlsBestEffort,
  listPublicBlobUrlsForShopPurge,
  purgeShopData,
  sweepShopPrefixedPublicBlobsBestEffort,
} from './purgeShopData';

const HOST = 'store123.public.blob.vercel-storage.com';

describe('purgeShopData public blob helpers', () => {
  const prev = process.env.PUBLIC_BLOB_STORE_HOST;

  beforeEach(() => {
    process.env.PUBLIC_BLOB_STORE_HOST = HOST;
    deletePrivateOnboardingFile.mockReset();
    deletePublicBlobObject.mockReset();
    listPublicBlobsByPrefix.mockReset();
    captureOpsMessage.mockReset();
    queryRaw.mockReset();
    shopSettingsUpdate.mockReset();
    transaction.mockReset();
    vi.mocked(prisma.shopSettings.findUnique).mockReset();
    vi.mocked(prisma.shopSettings.findMany).mockReset();
    vi.mocked(prisma.product.findMany).mockReset();
    vi.mocked(prisma.service.findMany).mockReset();
    vi.mocked(prisma.barber.findMany).mockReset();
    vi.mocked(prisma.client.findMany).mockReset();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.PUBLIC_BLOB_STORE_HOST;
    else process.env.PUBLIC_BLOB_STORE_HOST = prev;
  });

  it('beginShopPurgeGate is idempotent when already started', async () => {
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: queryRaw,
        shopSettings: { update: shopSettingsUpdate },
      };
      return fn(tx);
    });
    queryRaw.mockResolvedValue([{ id: 'shop-1', purgeStartedAt: new Date('2026-01-01') }]);

    const result = await beginShopPurgeGate('shop-1');
    expect(result.alreadyStarted).toBe(true);
    expect(shopSettingsUpdate).not.toHaveBeenCalled();
  });

  it('beginShopPurgeGate sets purgeStartedAt when null', async () => {
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: queryRaw,
        shopSettings: { update: shopSettingsUpdate },
      };
      return fn(tx);
    });
    queryRaw.mockResolvedValue([{ id: 'shop-1', purgeStartedAt: null }]);
    shopSettingsUpdate.mockResolvedValue({ id: 'shop-1' });

    const result = await beginShopPurgeGate('shop-1', new Date('2026-09-23T00:00:00.000Z'));
    expect(result.alreadyStarted).toBe(false);
    expect(shopSettingsUpdate).toHaveBeenCalledWith({
      where: { id: 'shop-1' },
      data: { purgeStartedAt: new Date('2026-09-23T00:00:00.000Z') },
    });
  });

  it('lists validated public URLs and skips foreign-shop referenced + invalid', async () => {
    const owned = `https://${HOST}/shops/shop-1/products/a.webp`;
    const shared = `https://${HOST}/barbers/shared.webp`;
    const external = 'https://cdn.example/x.webp';

    vi.mocked(prisma.shopSettings.findUnique).mockResolvedValue({ logoUrl: null } as never);
    vi.mocked(prisma.shopSettings.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.findMany).mockImplementation((async (args?: { where?: { shopId?: unknown } }) => {
      if (args?.where && 'shopId' in args.where && typeof args.where.shopId === 'string') {
        return [{ imageUrl: owned }, { imageUrl: owned }];
      }
      return [];
    }) as never);
    vi.mocked(prisma.service.findMany).mockImplementation((async (args?: { where?: { shopId?: unknown } }) => {
      if (args?.where && 'shopId' in args.where && typeof args.where.shopId === 'string') {
        return [{ imageUrl: shared }];
      }
      return [{ imageUrl: shared }];
    }) as never);
    vi.mocked(prisma.barber.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.client.findMany).mockImplementation((async (args?: { where?: { shopId?: unknown } }) => {
      if (args?.where && 'shopId' in args.where && typeof args.where.shopId === 'string') {
        return [{ avatarUrl: external }];
      }
      return [];
    }) as never);

    const urls = await listPublicBlobUrlsForShopPurge('shop-1');
    expect(urls).toEqual([owned]);
  });

  it('does not delete collected URL referenced by another live shop', async () => {
    const shared = `https://${HOST}/barbers/shared.webp`;
    vi.mocked(prisma.shopSettings.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.service.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.barber.findMany).mockResolvedValue([{ avatarUrl: shared }] as never);
    vi.mocked(prisma.client.findMany).mockResolvedValue([] as never);

    const stats = await deletePublicBlobUrlsBestEffort([shared], 'shop-1');
    expect(stats.skippedCrossShop).toBe(1);
    expect(deletePublicBlobObject).not.toHaveBeenCalled();
  });

  it('prefix sweep paginates, skips cross-shop, continues after delete failure', async () => {
    const a = `https://${HOST}/shops/shop-1/products/a.webp`;
    const b = `https://${HOST}/shops/shop-1/services/b.webp`;
    const shared = `https://${HOST}/shops/shop-1/products/shared.webp`;

    listPublicBlobsByPrefix
      .mockResolvedValueOnce({
        blobs: [
          { url: a, pathname: 'shops/shop-1/products/a.webp' },
          { url: shared, pathname: 'shops/shop-1/products/shared.webp' },
        ],
        cursor: 'c2',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        blobs: [{ url: b, pathname: 'shops/shop-1/services/b.webp' }],
        hasMore: false,
      });

    vi.mocked(prisma.shopSettings.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([{ imageUrl: shared }] as never);
    vi.mocked(prisma.service.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.barber.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.client.findMany).mockResolvedValue([] as never);

    deletePublicBlobObject
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);

    const stats = await sweepShopPrefixedPublicBlobsBestEffort('shop-1');
    expect(listPublicBlobsByPrefix).toHaveBeenCalledWith('shops/shop-1/', {
      cursor: undefined,
      limit: 100,
    });
    expect(listPublicBlobsByPrefix).toHaveBeenCalledWith('shops/shop-1/', {
      cursor: 'c2',
      limit: 100,
    });
    expect(stats.pages).toBe(2);
    expect(stats.skippedCrossShop).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.deleted).toBe(1);
  });

  it('stops safely when cursor does not advance', async () => {
    listPublicBlobsByPrefix.mockResolvedValue({
      blobs: [],
      cursor: 'same',
      hasMore: true,
    });
    const stats = await sweepShopPrefixedPublicBlobsBestEffort('shop-1');
    expect(stats.listFailed).toBe(true);
    expect(captureOpsMessage).toHaveBeenCalled();
  });

  it('purgeShopData order unchanged', async () => {
    const calls: string[] = [];
    const tx = {
      emailOutbound: { deleteMany: vi.fn(async () => { calls.push('email'); }) },
      smsOutbound: { deleteMany: vi.fn(async () => { calls.push('sms'); }) },
      booking: { deleteMany: vi.fn(async () => { calls.push('booking'); }) },
      order: { deleteMany: vi.fn(async () => { calls.push('order'); }) },
      shopSettings: { delete: vi.fn(async () => { calls.push('shop'); }) },
    };
    await purgeShopData(tx as never, 'shop-1');
    expect(calls).toEqual(['email', 'sms', 'booking', 'order', 'shop']);
  });
});
