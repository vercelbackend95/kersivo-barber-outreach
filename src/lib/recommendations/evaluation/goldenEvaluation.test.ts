import { describe, expect, it } from 'vitest';

import { MATCH_SCORE_MIN, MAX_PER_PRODUCT_FAMILY, MAX_RECOMMENDATIONS } from '../constants';
import { evaluateServiceProductPair } from '../pairEvaluation';
import { buildRankedRecommendationsForService, shouldRenderRecommendations } from '../scorer';
import {
  GOLDEN_PRODUCTS,
  GOLDEN_SERVICES,
  goldenProductEntries,
  goldenProductEntriesShuffled,
} from './goldenFixtures';
import { GOLDEN_SCENARIOS } from './goldenScenarios';

function isHairDomain(areas: string[]): boolean {
  return areas.some((area) => area === 'HAIR' || area === 'SCALP');
}

function isBeardDomain(areas: string[]): boolean {
  return areas.some((area) => area === 'BEARD' || area === 'MOUSTACHE');
}

describe('golden evaluation suite', () => {
  for (const scenario of GOLDEN_SCENARIOS) {
    it(`scenario: ${scenario.id}`, () => {
      const service = GOLDEN_SERVICES[scenario.serviceId];
      expect(service).toBeDefined();

      const ranked = buildRankedRecommendationsForService(service!, goldenProductEntries());
      const selectedIds = ranked.map((candidate) => candidate.productId);

      if (scenario.expectEmpty) {
        expect(selectedIds).toHaveLength(0);
        expect(shouldRenderRecommendations(selectedIds.length)).toBe(false);
        return;
      }

      for (const productId of scenario.mustInclude ?? []) {
        expect(selectedIds).toContain(productId);
      }
      for (const productId of scenario.mustExclude ?? []) {
        expect(selectedIds).not.toContain(productId);
      }
      if (scenario.expectedTopProductId) {
        expect(selectedIds[0]).toBe(scenario.expectedTopProductId);
      }
      if (scenario.requireHairAndBeardCoverage) {
        const hasHair = selectedIds.some((id) => {
          const profile = GOLDEN_PRODUCTS[id];
          return profile && isHairDomain(profile.targetAreas);
        });
        const hasBeard = selectedIds.some((id) => {
          const profile = GOLDEN_PRODUCTS[id];
          return profile && isBeardDomain(profile.targetAreas);
        });
        expect(hasHair).toBe(true);
        expect(hasBeard).toBe(true);
      }

      for (const assertion of scenario.pairAssertions ?? []) {
        const product = GOLDEN_PRODUCTS[assertion.productId];
        expect(product).toBeDefined();
        const evaluation = evaluateServiceProductPair({
          service: service!,
          product: product!,
          productId: assertion.productId,
        });
        if (assertion.expectedEligible) {
          expect(evaluation.eligible).toBe(true);
        } else {
          expect(evaluation.eligible).toBe(false);
          if (assertion.reasonCode && !evaluation.eligible) {
            expect(evaluation.reasonCode).toBe(assertion.reasonCode);
          }
        }
      }
    });
  }

  it('global invariants across all primary services', () => {
    const primaryServices = [
      'g-skin-fade',
      'g-taper-fade',
      'g-beard-trim',
      'g-hair-beard-combo',
      'g-hot-towel-shave',
      'g-long-hair-restyle',
    ];

    for (const serviceId of primaryServices) {
      const service = GOLDEN_SERVICES[serviceId]!;
      const ranked = buildRankedRecommendationsForService(service, goldenProductEntries());

      expect(ranked.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
      const ids = ranked.map((candidate) => candidate.productId);
      expect(new Set(ids).size).toBe(ids.length);

      const familyCounts = new Map<string, number>();
      for (const candidate of ranked) {
        expect(candidate.deterministicScore).toBeGreaterThanOrEqual(MATCH_SCORE_MIN);
        expect(candidate.deterministicScore).toBeLessThanOrEqual(1);
        expect(Number.isFinite(candidate.deterministicScore)).toBe(true);
        const family = candidate.productFamily || 'UNKNOWN';
        familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
      }
      for (const count of familyCounts.values()) {
        expect(count).toBeLessThanOrEqual(MAX_PER_PRODUCT_FAMILY);
      }
    }
  });

  it('shuffle invariance for skin fade ranking', () => {
    const service = GOLDEN_SERVICES['g-skin-fade']!;
    const orderedA = buildRankedRecommendationsForService(service, goldenProductEntries());
    const orderedB = buildRankedRecommendationsForService(service, goldenProductEntriesShuffled(42));
    expect(orderedA.map((candidate) => candidate.productId)).toEqual(
      orderedB.map((candidate) => candidate.productId),
    );
  });

  it('never selects ambiguous product for primary golden services', () => {
    const primaryServices = [
      'g-skin-fade',
      'g-taper-fade',
      'g-buzz-cut',
      'g-long-hair-restyle',
      'g-beard-trim',
      'g-hair-beard-combo',
      'g-hot-towel-shave',
      'g-scalp-cleanse',
      'g-facial-grooming',
      'g-grey-blend',
    ];
    const ambiguous = GOLDEN_PRODUCTS['g-ambiguous-product']!;

    for (const serviceId of primaryServices) {
      const service = GOLDEN_SERVICES[serviceId]!;
      const ranked = buildRankedRecommendationsForService(service, goldenProductEntries());
      expect(ranked.map((candidate) => candidate.productId)).not.toContain('g-ambiguous-product');

      const evaluation = evaluateServiceProductPair({
        service,
        product: ambiguous,
        productId: 'g-ambiguous-product',
      });
      expect(evaluation.eligible).toBe(false);
      if (!evaluation.eligible) {
        expect([
          'PRODUCT_PROFILE_LOW_CONFIDENCE',
          'PRODUCT_CRITICAL_FIELD_LOW_CONFIDENCE',
          'PRODUCT_RETAIL_NEEDS_UNKNOWN',
          'NO_RETAIL_NEED_OVERLAP',
          'NO_TARGET_AREA_OVERLAP',
          'MATCH_SCORE_BELOW_THRESHOLD',
        ]).toContain(evaluation.reasonCode);
      }
    }
  });
});
