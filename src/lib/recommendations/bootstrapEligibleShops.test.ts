import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationJobStatus } from '@prisma/client';

const scheduleCatalogueRebuild = vi.fn();
const shopSettingsFindMany = vi.fn();
const stateFindUnique = vi.fn();

vi.mock('./scheduleCatalogueRebuild', () => ({
  scheduleCatalogueRebuild: (...args: unknown[]) => scheduleCatalogueRebuild(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findMany: (...args: unknown[]) => shopSettingsFindMany(...args) },
    shopRecommendationState: { findUnique: (...args: unknown[]) => stateFindUnique(...args) },
  },
}));

import {
  RECOMMENDATION_BOOTSTRAP_BATCH_SIZE,
  bootstrapEligibleRecommendationShops,
} from './bootstrapEligibleShops';
import { TAXONOMY_VERSION } from './constants';

const eligibleShop = {
  id: 'shop-eligible-1',
  shopPaidAt: new Date('2026-01-01T00:00:00.000Z'),
  smsRemindersEnabled: true,
  stripeConnectAccountId: 'acct_123',
  stripeConnectChargesEnabled: true,
  retailEnabled: true,
};

describe('bootstrapEligibleRecommendationShops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduleCatalogueRebuild.mockResolvedValue(undefined);
    stateFindUnique.mockResolvedValue(null);
  });

  it('bootstraps an eligible retail shop without OpenAI', async () => {
    shopSettingsFindMany.mockResolvedValue([eligibleShop]);

    const result = await bootstrapEligibleRecommendationShops(new Date('2026-09-04T12:00:00.000Z'));

    expect(result.bootstrapped).toBe(1);
    expect(result.shopIds).toEqual(['shop-eligible-1']);
    expect(scheduleCatalogueRebuild).toHaveBeenCalledTimes(1);
    expect(scheduleCatalogueRebuild).toHaveBeenCalledWith(
      'shop-eligible-1',
      expect.anything(),
      new Date('2026-09-04T12:00:00.000Z'),
    );
    expect(TAXONOMY_VERSION).toBe('2026-09-v2');
  });

  it('ignores unpaid, demo-shaped, and retail-disabled candidates via canSellRetail', async () => {
    shopSettingsFindMany.mockResolvedValue([
      {
        ...eligibleShop,
        id: 'shop-unpaid',
        shopPaidAt: null,
        smsRemindersEnabled: false,
      },
      {
        ...eligibleShop,
        id: 'shop-retail-off',
        retailEnabled: false,
      },
    ]);

    const result = await bootstrapEligibleRecommendationShops();
    expect(result.bootstrapped).toBe(0);
    expect(scheduleCatalogueRebuild).not.toHaveBeenCalled();
  });

  it('preserves existing recommendation state', async () => {
    shopSettingsFindMany.mockResolvedValue([eligibleShop]);
    stateFindUnique.mockResolvedValue({ shopId: 'shop-eligible-1' });

    const result = await bootstrapEligibleRecommendationShops();
    expect(result.bootstrapped).toBe(0);
    expect(result.skippedExisting).toBe(1);
    expect(scheduleCatalogueRebuild).not.toHaveBeenCalled();
  });

  it('creates only one schedule when concurrent bootstrap races see no state then schedule', async () => {
    shopSettingsFindMany.mockResolvedValue([eligibleShop]);
    stateFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ shopId: 'shop-eligible-1' });

    const first = bootstrapEligibleRecommendationShops();
    const second = bootstrapEligibleRecommendationShops();
    const [a, b] = await Promise.all([first, second]);

    expect(a.bootstrapped + b.bootstrapped).toBe(1);
    expect(scheduleCatalogueRebuild).toHaveBeenCalledTimes(1);
  });

  it('limits candidates to the bootstrap batch size', async () => {
    shopSettingsFindMany.mockResolvedValue([eligibleShop]);

    await bootstrapEligibleRecommendationShops(new Date(), { batchSize: 2 });

    expect(shopSettingsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
      }),
    );
    expect(RECOMMENDATION_BOOTSTRAP_BATCH_SIZE).toBe(5);
  });

  it('excludes demo shop ids in the candidate query', async () => {
    shopSettingsFindMany.mockResolvedValue([]);
    await bootstrapEligibleRecommendationShops();
    const arg = shopSettingsFindMany.mock.calls[0]?.[0] as {
      where: { id: { notIn: string[] }; recommendationState: null };
    };
    expect(arg.where.id.notIn).toEqual(expect.arrayContaining(['demo-shop', 'blackline-barbers-demo']));
    expect(arg.where.recommendationState).toBeNull();
  });

  it('schedules pending work that the normal worker can pick up', async () => {
    shopSettingsFindMany.mockResolvedValue([eligibleShop]);
    scheduleCatalogueRebuild.mockImplementation(async () => {
      // scheduleCatalogueRebuild is responsible for PENDING + version bump.
      return undefined;
    });

    const result = await bootstrapEligibleRecommendationShops();
    expect(result.bootstrapped).toBe(1);
    expect(scheduleCatalogueRebuild).toHaveBeenCalledWith(
      'shop-eligible-1',
      expect.anything(),
      expect.any(Date),
    );
    expect(RecommendationJobStatus.PENDING).toBe('PENDING');
  });
});
