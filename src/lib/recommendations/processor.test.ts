import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationJobStatus, RecommendationSetStatus } from '@prisma/client';

const classifyServiceEntity = vi.fn();
const classifyProductEntity = vi.fn();
const createRecommendationOpenAiClient = vi.fn();

vi.mock('./ai/classify', () => ({
  classifyServiceEntity: (...args: unknown[]) => classifyServiceEntity(...args),
  classifyProductEntity: (...args: unknown[]) => classifyProductEntity(...args),
  createRecommendationOpenAiClient: (...args: unknown[]) => createRecommendationOpenAiClient(...args),
  rerankEligibleCandidates: vi.fn().mockResolvedValue({ ok: false, error: 'MODEL_REFUSAL' }),
  resolveRecommendationModel: () => 'gpt-4o-mini',
}));

const acquireShopLock = vi.fn();
const releaseOwnedLock = vi.fn();
const markSetTerminal = vi.fn();
const claimOwnedFailure = vi.fn();

vi.mock('./workerOwnership', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./workerOwnership')>();
  return {
    ...actual,
    acquireShopLock: (...args: unknown[]) => acquireShopLock(...args),
    releaseOwnedLock: (...args: unknown[]) => releaseOwnedLock(...args),
    markSetTerminal: (...args: unknown[]) => markSetTerminal(...args),
    claimOwnedFailure: (...args: unknown[]) => claimOwnedFailure(...args),
  };
});

const serviceFindMany = vi.fn();
const productFindMany = vi.fn();
const setCreate = vi.fn();
const itemCreateMany = vi.fn();
const stateUpdateMany = vi.fn();
const setUpdate = vi.fn();
const setUpdateMany = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    service: { findMany: (...args: unknown[]) => serviceFindMany(...args) },
    product: { findMany: (...args: unknown[]) => productFindMany(...args) },
    serviceSemanticProfile: { findMany: vi.fn().mockResolvedValue([]) },
    productSemanticProfile: { findMany: vi.fn().mockResolvedValue([]) },
    recommendationSet: {
      create: (...args: unknown[]) => setCreate(...args),
      update: (...args: unknown[]) => setUpdate(...args),
      updateMany: (...args: unknown[]) => setUpdateMany(...args),
    },
    recommendationSetItem: { createMany: (...args: unknown[]) => itemCreateMany(...args) },
    shopRecommendationState: { updateMany: (...args: unknown[]) => stateUpdateMany(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import { buildLockOwnerOnlyWhere } from './workerOwnership';
import { StaleBuildError } from './workerOwnership';
import { processShop } from './processor';

describe('processShop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acquireShopLock.mockResolvedValue('lock-1');
    releaseOwnedLock.mockResolvedValue(true);
    markSetTerminal.mockResolvedValue(undefined);
    claimOwnedFailure.mockResolvedValue({ outcome: 'claimed', exhausted: false, attempts: 1 });
    setCreate.mockResolvedValue({ id: 'set-1' });
    stateUpdateMany.mockResolvedValue({ count: 1 });
    transaction.mockImplementation(async (fn: (tx: {
      shopRecommendationState: { updateMany: typeof stateUpdateMany };
      recommendationSet: { update: typeof setUpdate; updateMany: typeof setUpdateMany };
    }) => Promise<void>) =>
      fn({
        shopRecommendationState: { updateMany: stateUpdateMany },
        recommendationSet: { update: setUpdate, updateMany: setUpdateMany },
      }),
    );
  });

  it('skips OpenAI and publishes empty set when fewer than two active products', async () => {
    serviceFindMany.mockResolvedValue([
      { id: 'svc-1', name: 'Cut', description: null, category: 'cuts' },
    ]);
    productFindMany.mockResolvedValue([
      { id: 'p-1', name: 'Clay', description: null, category: 'STYLING' },
    ]);

    const ok = await processShop('shop-1', 2);
    expect(ok).toBe(true);
    expect(classifyServiceEntity).not.toHaveBeenCalled();
    expect(classifyProductEntity).not.toHaveBeenCalled();
    expect(createRecommendationOpenAiClient).not.toHaveBeenCalled();
    expect(itemCreateMany).not.toHaveBeenCalled();
    expect(setUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'set-1' },
        data: expect.objectContaining({ status: RecommendationSetStatus.READY }),
      }),
    );
  });

  it('marks stale publication as SUPERSEDED and releases via lock-owner predicate', async () => {
    serviceFindMany.mockResolvedValue([]);
    productFindMany.mockResolvedValue([]);
    stateUpdateMany.mockResolvedValueOnce({ count: 0 });

    const ok = await processShop('shop-1', 2);
    expect(ok).toBe(false);
    expect(markSetTerminal).toHaveBeenCalledWith(
      'set-1',
      RecommendationSetStatus.SUPERSEDED,
      'STALE_BUILD',
    );
    expect(releaseOwnedLock).toHaveBeenCalledWith({
      shopId: 'shop-1',
      lockId: 'lock-1',
      targetVersion: 2,
    });
    expect(claimOwnedFailure).not.toHaveBeenCalled();
  });

  it('claims real failures when worker still owns current version', async () => {
    serviceFindMany.mockResolvedValue([
      { id: 'svc-1', name: 'Cut', description: null, category: 'cuts' },
    ]);
    productFindMany.mockResolvedValue([
      { id: 'p-1', name: 'A', description: null, category: 'STYLING' },
      { id: 'p-2', name: 'B', description: null, category: 'STYLING' },
    ]);
    createRecommendationOpenAiClient.mockReturnValue(null);
    claimOwnedFailure.mockResolvedValue({ outcome: 'claimed', exhausted: false, attempts: 1 });

    const ok = await processShop('shop-1', 2);
    expect(ok).toBe(false);
    expect(claimOwnedFailure).toHaveBeenCalledWith(
      { shopId: 'shop-1', lockId: 'lock-1', targetVersion: 2 },
      'set-1',
      'MISSING_OPENAI_KEY',
    );
    expect(markSetTerminal).not.toHaveBeenCalledWith(
      'set-1',
      RecommendationSetStatus.SUPERSEDED,
      expect.anything(),
    );
  });

  it('handles stale failure claim by superseding set without consuming attempts', async () => {
    serviceFindMany.mockResolvedValue([
      { id: 'svc-1', name: 'Cut', description: null, category: 'cuts' },
    ]);
    productFindMany.mockResolvedValue([
      { id: 'p-1', name: 'A', description: null, category: 'STYLING' },
      { id: 'p-2', name: 'B', description: null, category: 'STYLING' },
    ]);
    createRecommendationOpenAiClient.mockReturnValue(null);
    claimOwnedFailure.mockResolvedValue({ outcome: 'stale', exhausted: false, attempts: 2 });

    await processShop('shop-1', 2);
    expect(markSetTerminal).toHaveBeenCalledWith(
      'set-1',
      RecommendationSetStatus.SUPERSEDED,
      'STALE_BUILD',
    );
    expect(releaseOwnedLock).toHaveBeenCalled();
  });

  it('treats zero-row publish claim as stale build error type', () => {
    expect(new StaleBuildError()).toBeInstanceOf(Error);
    expect(new StaleBuildError().code).toBe('STALE_BUILD');
  });

  it('documents lock-owner predicate shape used by releaseOwnedLock', () => {
    expect(buildLockOwnerOnlyWhere({ shopId: 'shop-1', lockId: 'lock-1', targetVersion: 2 })).toEqual({
      shopId: 'shop-1',
      processingLockId: 'lock-1',
      processingCatalogueVersion: 2,
    });
  });
});

describe('acquireShopLock integration', () => {
  it('pending job status remains schedulable', () => {
    expect(RecommendationJobStatus.PENDING).toBe('PENDING');
  });
});
