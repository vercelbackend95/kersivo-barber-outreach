import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueShop = vi.fn();
const findManyServices = vi.fn();
const findUniqueState = vi.fn();
const findFirstSet = vi.fn();
const findManyItems = vi.fn();
const findManyProducts = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...args: unknown[]) => findUniqueShop(...args) },
    service: { findMany: (...args: unknown[]) => findManyServices(...args) },
    shopRecommendationState: { findUnique: (...args: unknown[]) => findUniqueState(...args) },
    recommendationSet: { findFirst: (...args: unknown[]) => findFirstSet(...args) },
    recommendationSetItem: { findMany: (...args: unknown[]) => findManyItems(...args) },
    product: { findMany: (...args: unknown[]) => findManyProducts(...args) },
  },
}));

vi.mock('@/lib/db/shopScope', () => ({
  DEMO_SHOP_ID: 'blackline-barbers-demo',
}));

vi.mock('@/lib/shop/cardPaymentsGate', () => ({
  canSellRetail: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/admin/shopPublicActivity', () => ({
  isPauseActiveNow: vi.fn().mockReturnValue(false),
}));

import { canSellRetail } from '@/lib/shop/cardPaymentsGate';
import { readPublishedRecommendations } from './reader';

const readyShop = {
  id: 'shop-1',
  shopPaidAt: new Date(),
  smsRemindersEnabled: false,
  retailEnabled: true,
  stripeConnectAccountId: 'acct',
  stripeConnectChargesEnabled: true,
  publicActivityPaused: false,
  publicActivityPauseFrom: null,
  publicActivityPauseUntil: null,
  publicActivityPauseReason: null,
  timezone: 'Europe/London',
};

describe('readPublishedRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canSellRetail).mockReturnValue(true);
    findUniqueShop.mockResolvedValue(readyShop);
    findManyServices.mockResolvedValue([{ id: 'svc-1' }]);
    findUniqueState.mockResolvedValue({ publishedSetId: 'set-1' });
    findFirstSet.mockResolvedValue({ id: 'set-1' });
    findManyItems.mockResolvedValue([
      { productId: 'p-1', rank: 1, deterministicScore: 0.9 },
      { productId: 'p-2', rank: 2, deterministicScore: 0.8 },
    ]);
    findManyProducts.mockResolvedValue([
      {
        id: 'p-1',
        name: 'Clay',
        pricePence: 1200,
        category: 'STYLING',
        imageUrl: '/img/clay.webp',
      },
      {
        id: 'p-2',
        name: 'Pomade',
        pricePence: 1400,
        category: 'STYLING',
        imageUrl: '/img/pomade.webp',
      },
    ]);
  });

  it('rejects demo shop id', async () => {
    const result = await readPublishedRecommendations({
      shopId: 'blackline-barbers-demo',
      serviceIds: ['svc-1'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('returns empty products when no published set exists', async () => {
    findUniqueState.mockResolvedValue({ publishedSetId: null });
    const result = await readPublishedRecommendations({
      shopId: 'shop-1',
      serviceIds: ['svc-1'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.products).toEqual([]);
    }
  });

  it('returns active products in rank order when set is published and ready', async () => {
    const result = await readPublishedRecommendations({
      shopId: 'shop-1',
      serviceIds: ['svc-1'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.products.map((p) => p.id)).toEqual(['p-1', 'p-2']);
    }
  });

  it('returns empty response when service is inactive for shop', async () => {
    findManyServices.mockResolvedValue([]);
    const result = await readPublishedRecommendations({
      shopId: 'shop-1',
      serviceIds: ['svc-1'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response.products).toEqual([]);
  });

  it('returns empty when published set is not READY or wrong shop', async () => {
    findFirstSet.mockResolvedValue(null);
    const result = await readPublishedRecommendations({
      shopId: 'shop-1',
      serviceIds: ['svc-1'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response.products).toEqual([]);
    expect(findManyItems).not.toHaveBeenCalled();
  });

  it('returns empty when retail is not sellable', async () => {
    vi.mocked(canSellRetail).mockReturnValue(false);
    const result = await readPublishedRecommendations({
      shopId: 'shop-1',
      serviceIds: ['svc-1'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response.products).toEqual([]);
  });

  it('rejects more than MAX_SERVICE_IDS serviceId values', async () => {
    const result = await readPublishedRecommendations({
      shopId: 'shop-1',
      serviceIds: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
