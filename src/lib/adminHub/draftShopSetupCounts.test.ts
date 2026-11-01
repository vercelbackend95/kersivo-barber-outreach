import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { draftShopCountsOrZero, EMPTY_DRAFT_SHOP_COUNTS } from './draftShopSetupCounts';

describe('draftShopCountsOrZero', () => {
  it('returns zeros when there is no draft shop', () => {
    expect(draftShopCountsOrZero(null)).toEqual(EMPTY_DRAFT_SHOP_COUNTS);
    expect(draftShopCountsOrZero(undefined)).toEqual({
      activeServices: 0,
      activeBarbers: 0,
      products: 0,
    });
  });

  it('passes through a loaded count', () => {
    expect(draftShopCountsOrZero({ activeServices: 2, activeBarbers: 1, products: 4 })).toEqual({
      activeServices: 2,
      activeBarbers: 1,
      products: 4,
    });
  });
});
