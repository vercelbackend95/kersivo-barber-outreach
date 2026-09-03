import { describe, expect, it } from 'vitest';

import { getDemoRecommendationProducts } from './fixtures';

describe('demo recommendations fixtures', () => {
  it('returns at least two styling products for skin fade', () => {
    const products = getDemoRecommendationProducts('bl-svc-skin-fade');
    expect(products.length).toBeGreaterThanOrEqual(2);
    expect(products.some((p) => p.id === 'bl-product-matte-clay')).toBe(true);
  });

  it('returns beard care for beard trim', () => {
    const products = getDemoRecommendationProducts('bl-svc-beard-trim');
    expect(products.length).toBeGreaterThanOrEqual(2);
    expect(products.some((p) => p.id === 'bl-product-beard-oil')).toBe(true);
    expect(products.some((p) => p.id === 'bl-product-daily-conditioner')).toBe(false);
  });

  it('returns aftershave balm for hot towel shave', () => {
    const products = getDemoRecommendationProducts('bl-svc-hot-towel-shave');
    expect(products.length).toBeGreaterThanOrEqual(2);
    expect(products[0]?.id).toBe('bl-product-aftershave-balm');
  });

  it('returns styling cream for long hair restyle', () => {
    const products = getDemoRecommendationProducts('bl-svc-restyle');
    expect(products.length).toBeGreaterThanOrEqual(2);
    expect(products.some((p) => p.id === 'bl-product-styling-cream')).toBe(true);
  });
});
