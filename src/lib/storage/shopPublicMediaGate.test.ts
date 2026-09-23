import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const findUnique = vi.fn();
const transaction = vi.fn();
const queryRaw = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...args: unknown[]) => findUnique(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import {
  assertShopAllowsPublicMediaMutation,
  lockShopForPublicMediaAssociation,
  ShopMediaMutationBlockedError,
} from './shopPublicMediaGate';

describe('shopPublicMediaGate', () => {
  it('assert blocks when purgeStartedAt set or shop missing', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(assertShopAllowsPublicMediaMutation('shop-1')).rejects.toBeInstanceOf(
      ShopMediaMutationBlockedError,
    );

    findUnique.mockResolvedValueOnce({ id: 'shop-1', purgeStartedAt: new Date() });
    await expect(assertShopAllowsPublicMediaMutation('shop-1')).rejects.toBeInstanceOf(
      ShopMediaMutationBlockedError,
    );

    findUnique.mockResolvedValueOnce({ id: 'shop-1', purgeStartedAt: null });
    await expect(assertShopAllowsPublicMediaMutation('shop-1')).resolves.toBeUndefined();
  });

  it('lockShopForPublicMediaAssociation uses FOR UPDATE purgeStartedAt IS NULL', async () => {
    queryRaw.mockResolvedValue([{ id: 'shop-1' }]);
    const tx = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;
    await lockShopForPublicMediaAssociation(tx, 'shop-1');
    expect(queryRaw).toHaveBeenCalled();
    const sql = queryRaw.mock.calls[0]?.[0];
    expect(String(sql?.strings?.join?.(' ') ?? sql)).toMatch(/FOR UPDATE/i);
    expect(String(sql?.strings?.join?.(' ') ?? sql)).toMatch(/purgeStartedAt/i);
  });

  it('lock throws when no row', async () => {
    queryRaw.mockResolvedValue([]);
    const tx = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;
    await expect(lockShopForPublicMediaAssociation(tx, 'shop-1')).rejects.toBeInstanceOf(
      ShopMediaMutationBlockedError,
    );
  });
});
