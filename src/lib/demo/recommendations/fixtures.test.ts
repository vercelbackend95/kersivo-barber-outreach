import { describe, expect, it } from 'vitest';

import { DEMO_PRODUCTS } from '@/lib/demo/products';
import { DEMO_FEATURED_SERVICE_IDS, DEMO_SERVICES } from '@/lib/demo/services';
import {
  validateStoredProductProfileConsistency,
  validateStoredServiceProfileConsistency,
} from '@/lib/recommendations/semanticConsistency';

import {
  DEMO_PRODUCT_PROFILES,
  DEMO_SERVICE_PROFILES,
  getDemoRecommendationProductIds,
  getDemoRecommendationProducts,
  rankDemoRecommendationsWithProductOrder,
} from './fixtures';

const BEARD_ONLY_IDS = [
  'bl-product-beard-oil',
  'bl-product-beard-balm',
  'bl-product-beard-wash',
  'bl-product-beard-butter',
  'bl-product-moustache-wax',
] as const;

const FACE_OR_SHAVE_ONLY_IDS = [
  'bl-product-face-wash',
  'bl-product-daily-moisturiser',
  'bl-product-shave-cream',
  'bl-product-aftershave-balm',
] as const;

const GIFT_IDS = [
  'bl-product-essential-styling-set',
  'bl-product-beard-kit',
  'bl-product-travel-grooming-set',
  'bl-product-shop-gift-box',
  'bl-product-hot-towel-kit',
] as const;

const LONG_HAIR_ONLY_IDS = ['bl-product-styling-cream'] as const;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = (i * 17 + 3) % (i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

describe('demo recommendation fixture completeness', () => {
  it('covers every demo service exactly once with no orphan profiles', () => {
    const serviceIds = DEMO_SERVICES.map((s) => s.id).sort();
    const profileIds = Object.keys(DEMO_SERVICE_PROFILES).sort();
    expect(profileIds).toEqual(serviceIds);
    expect(profileIds).toHaveLength(18);
  });

  it('covers every active demo product exactly once with no orphan profiles', () => {
    const activeIds = DEMO_PRODUCTS.filter((p) => p.active)
      .map((p) => p.id)
      .sort();
    const profileIds = Object.keys(DEMO_PRODUCT_PROFILES).sort();
    expect(profileIds).toEqual(activeIds);
    expect(profileIds).toHaveLength(29);
  });

  it('passes production semantic consistency for all service fixtures', () => {
    for (const profile of Object.values(DEMO_SERVICE_PROFILES)) {
      expect(validateStoredServiceProfileConsistency(profile).ok).toBe(true);
    }
  });

  it('passes production semantic consistency for all product fixtures', () => {
    for (const profile of Object.values(DEMO_PRODUCT_PROFILES)) {
      expect(validateStoredProductProfileConsistency(profile).ok).toBe(true);
    }
  });
});

describe('featured demo recommendation rails', () => {
  it.each([...DEMO_FEATURED_SERVICE_IDS])(
    '%s returns between 2 and 4 products',
    (serviceId) => {
      const products = getDemoRecommendationProducts(serviceId);
      expect(products.length).toBeGreaterThanOrEqual(2);
      expect(products.length).toBeLessThanOrEqual(4);
    },
  );

  it('Skin Fade includes Matte Clay and excludes cross-domain mistakes', () => {
    const ids = getDemoRecommendationProductIds('bl-svc-skin-fade');
    expect(ids).toContain('bl-product-matte-clay');
    for (const id of [...BEARD_ONLY_IDS, ...FACE_OR_SHAVE_ONLY_IDS, ...GIFT_IDS, ...LONG_HAIR_ONLY_IDS]) {
      expect(ids).not.toContain(id);
    }
  });

  it('Classic Cut & Finish excludes beard/shave/face-only and gifts', () => {
    const ids = getDemoRecommendationProductIds('bl-svc-haircut-finish');
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (const id of [...BEARD_ONLY_IDS, ...FACE_OR_SHAVE_ONLY_IDS, ...GIFT_IDS]) {
      expect(ids).not.toContain(id);
    }
  });

  it('Haircut & Beard covers hair and beard domains without face/shave-only', () => {
    const ids = getDemoRecommendationProductIds('bl-svc-haircut-beard');
    const hairIds = ids.filter((id) => DEMO_PRODUCT_PROFILES[id]?.targetAreas.includes('HAIR'));
    const beardIds = ids.filter((id) => DEMO_PRODUCT_PROFILES[id]?.targetAreas.includes('BEARD'));
    expect(hairIds.length).toBeGreaterThanOrEqual(1);
    expect(beardIds.length).toBeGreaterThanOrEqual(1);
    for (const id of FACE_OR_SHAVE_ONLY_IDS) {
      expect(ids).not.toContain(id);
    }
  });

  it('remains deterministic after product input shuffle', () => {
    for (const serviceId of DEMO_FEATURED_SERVICE_IDS) {
      const baseline = getDemoRecommendationProductIds(serviceId);
      const activeIds = DEMO_PRODUCTS.filter((p) => p.active).map((p) => p.id);
      const shuffled = rankDemoRecommendationsWithProductOrder(serviceId, shuffle(activeIds));
      expect(shuffled).toEqual(baseline);
    }
  });
});

describe('example demo recommendation behaviour', () => {
  it('Beard Trim returns beard care and excludes conditioner', () => {
    const ids = getDemoRecommendationProductIds('bl-svc-beard-trim');
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.some((id) => id === 'bl-product-beard-oil' || id === 'bl-product-beard-balm')).toBe(
      true,
    );
    expect(ids).not.toContain('bl-product-daily-conditioner');
  });

  it('Hot Towel Wet Shave ranks Aftershave Balm strongly', () => {
    const ids = getDemoRecommendationProductIds('bl-svc-hot-towel-shave');
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids[0]).toBe('bl-product-aftershave-balm');
  });

  it('Scissor Cut / Restyle favour longer-hair styling and conditioning', () => {
    for (const serviceId of ['bl-svc-scissor-cut', 'bl-svc-restyle'] as const) {
      const ids = getDemoRecommendationProductIds(serviceId);
      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(
        ids.some((id) => id === 'bl-product-styling-cream' || id === 'bl-product-daily-conditioner'),
      ).toBe(true);
    }
  });

  it('Buzz Cut does not recommend long-hair-only styling cream', () => {
    const ids = getDemoRecommendationProductIds('bl-svc-buzz-cut');
    expect(ids).not.toContain('bl-product-styling-cream');
  });

  it('Scalp Cleanse recommends scrub/rinse cleansing', () => {
    const ids = getDemoRecommendationProductIds('bl-svc-scalp-treatment');
    expect(ids).toEqual(
      expect.arrayContaining(['bl-product-scalp-scrub', 'bl-product-clarifying-rinse']),
    );
  });

  it('Express Facial recommends face wash and moisturiser', () => {
    const ids = getDemoRecommendationProductIds('bl-svc-express-facial');
    expect(ids).toEqual(
      expect.arrayContaining(['bl-product-face-wash', 'bl-product-daily-moisturiser']),
    );
  });

  it('Wash, Style & Finish returns cleansing/conditioning/styling products', () => {
    const ids = getDemoRecommendationProductIds('bl-svc-wash-style-finish');
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const families = ids.map((id) => DEMO_PRODUCT_PROFILES[id]?.productFamily);
    expect(
      families.some((f) => f === 'WASH_SHAMPOO' || f === 'CONDITIONER' || f === 'POMADE' || f === 'CLAY' || f === 'CREAM' || f === 'SPRAY'),
    ).toBe(true);
  });

  it('Grey Blending may return empty when catalogue lacks colour products', () => {
    const products = getDemoRecommendationProducts('bl-svc-grey-blending');
    expect(products.length).toBeLessThan(2);
  });
});
