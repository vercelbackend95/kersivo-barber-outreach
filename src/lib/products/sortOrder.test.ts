import { describe, expect, it } from 'vitest';

import { moveProductIdToSortOrder, normalizeRequestedProductSortOrder } from './sortOrder';

describe('normalizeRequestedProductSortOrder', () => {
  it('clamps invalid and out-of-range values', () => {
    expect(normalizeRequestedProductSortOrder(undefined, 3)).toBe(3);
    expect(normalizeRequestedProductSortOrder(Number.NaN, 2)).toBe(2);
    expect(normalizeRequestedProductSortOrder(-10)).toBe(0);
    expect(normalizeRequestedProductSortOrder(12.9)).toBe(12);
    expect(normalizeRequestedProductSortOrder(20000)).toBe(9999);
  });
});

describe('moveProductIdToSortOrder', () => {
  it('moves a product down and shifts the range up', () => {
    expect(moveProductIdToSortOrder({
      productIds: ['a', 'b', 'c', 'd', 'e'],
      productId: 'b',
      requestedSortOrder: 3
    })).toEqual(['a', 'c', 'd', 'b', 'e']);
  });

  it('moves a product up and shifts the range down', () => {
    expect(moveProductIdToSortOrder({
      productIds: ['a', 'b', 'c', 'd', 'e'],
      productId: 'd',
      requestedSortOrder: 1
    })).toEqual(['a', 'd', 'b', 'c', 'e']);
  });

  it('keeps the same order when moving to the same position', () => {
    expect(moveProductIdToSortOrder({
      productIds: ['a', 'b', 'c'],
      productId: 'b',
      requestedSortOrder: 1
    })).toEqual(['a', 'b', 'c']);
  });

  it('clamps positions beyond the current range', () => {
    expect(moveProductIdToSortOrder({
      productIds: ['a', 'b', 'c'],
      productId: 'a',
      requestedSortOrder: 99
    })).toEqual(['b', 'c', 'a']);
  });
});
