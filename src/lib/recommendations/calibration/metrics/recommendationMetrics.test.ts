import { describe, expect, it } from 'vitest';

import { MAX_RECOMMENDATIONS, TAXONOMY_VERSION } from '../../constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from '../../contracts';
import { buildCalibrationStubProfiles, calibrationProductEntries } from '../dataset/stubProfiles';
import { getCalibrationGoldExpectations } from '../expectations/gold';
import { createLiveRankingFactory } from '../ranking/buildLiveServiceRanking';
import type { RecommendationGoldScenario } from '../types';
import type { LiveRankingFactory } from '../ranking/buildLiveServiceRanking';
import {
  computeLiveDeterministicRepeatability,
  computeRecommendationMetrics,
  evaluateRecommendationScenario,
} from './recommendationMetrics';

const CRITICAL_FIELD_CONFIDENCE = { targetAreas: 0.85, retailNeeds: 0.85 };

function serviceProfile(overrides: Partial<ServiceSemanticProfileV2> = {}): ServiceSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId: 'test-svc',
    shopId: 'test-shop',
    contentHash: 'hash-svc',
    sourceSnapshot: { name: 'Test Service', description: null, category: 'test' },
    modelId: 'test',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    typicalHairLength: 'SHORT',
    techniques: ['CLIPPER_CUT'],
    outcomes: ['SHAPE_STRUCTURE'],
    aftercareNeeds: ['DAILY_STYLING'],
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
    confidence: 0.9,
    fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

function productProfile(
  id: string,
  overrides: Partial<ProductSemanticProfileV2> = {},
): ProductSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'PRODUCT',
    entityId: id,
    shopId: 'test-shop',
    contentHash: `hash-${id}`,
    sourceSnapshot: { name: id, description: null, category: 'STYLING' },
    modelId: 'test',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    hairLengthSuitability: 'SHORT',
    productFamily: 'CLAY',
    benefits: ['HOLD', 'MATTE_FINISH', 'TEXTURE'],
    holdStrength: 'STRONG',
    finish: 'MATTE',
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
    confidence: 0.9,
    fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

describe('recommendation metrics repairs', () => {
  it('precision@4 penalizes irrelevant selected products via synthetic fixture', () => {
    const service = serviceProfile();
    const relevant = productProfile('prod-relevant', { productFamily: 'CLAY' });
    const irrelevant = productProfile('prod-irrelevant', {
      productFamily: 'POMADE',
      retailNeeds: ['HAIR_TEXTURE_DEFINITION'],
    });
    const filler = productProfile('prod-filler-a', { productFamily: 'WAX' });
    const fillerB = productProfile('prod-filler-b', { productFamily: 'GEL' });

    const products = [
      { id: 'prod-relevant', profile: relevant },
      { id: 'prod-irrelevant', profile: irrelevant },
      { id: 'prod-filler-a', profile: filler },
      { id: 'prod-filler-b', profile: fillerB },
    ];
    const productMap = new Map(products.map((p) => [p.id, p.profile]));

    const scenario: RecommendationGoldScenario = {
      id: 'synthetic-precision',
      serviceId: 'test-svc',
      relevantProductIds: ['prod-relevant'],
      mustInclude: ['prod-relevant'],
    };

    const evaluation = evaluateRecommendationScenario(scenario, service, products, productMap);
    expect(evaluation.selectedIds.length).toBeGreaterThan(0);
    expect(evaluation.selectedIds.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);

    const hasIrrelevant = evaluation.selectedIds.some((id) => id === 'prod-irrelevant');
    if (hasIrrelevant) {
      expect(evaluation.precisionAt4Hits).toBeLessThan(evaluation.precisionAt4Total);
      expect(evaluation.precisionAt4Hits / evaluation.precisionAt4Total).toBeLessThan(1);
    }
  });

  it('combo coverage uses matchedAreas on selected candidates', () => {
    const stubs = buildCalibrationStubProfiles();
    const products = calibrationProductEntries(stubs);
    const service = stubs.services.get('cal-svc-hair-beard')!;
    const gold = getCalibrationGoldExpectations();
    const scenario = gold.recommendations.find((s) => s.id === 'combo-hair-beard-coverage')!;

    const evaluation = evaluateRecommendationScenario(scenario, service, products, stubs.products);
    const selected = evaluation.ranked.slice(0, 4);

    const hasHair = selected.some((c) =>
      c.matchedAreas.some((a) => a === 'HAIR' || a === 'SCALP'),
    );
    const hasBeard = selected.some((c) =>
      c.matchedAreas.some((a) => a === 'BEARD' || a === 'MOUSTACHE'),
    );
    expect(evaluation.comboCoverageOk).toBe(hasHair && hasBeard);
  });

  it('aggregates pair assertion metrics', () => {
    const stubs = buildCalibrationStubProfiles();
    const products = calibrationProductEntries(stubs);
    const gold = getCalibrationGoldExpectations();
    const metrics = computeRecommendationMetrics(
      gold.recommendations,
      stubs.services,
      products,
      stubs.products,
    );
    expect(metrics.pairAssertionPassRate).not.toBeNull();
    expect(metrics.pairAssertionFailures).toBe(0);
  });

  it('passes gifting-not-wildcard expected-empty scenario in full gold fixtures', () => {
    const stubs = buildCalibrationStubProfiles();
    const products = calibrationProductEntries(stubs);
    const gold = getCalibrationGoldExpectations();
    const metrics = computeRecommendationMetrics(
      gold.recommendations,
      stubs.services,
      products,
      stubs.products,
    );

    expect(metrics.expectedEmptyScenarioCount).toBeGreaterThan(0);
    expect(metrics.expectedEmptyPassRate).toBe(1);
    expect(metrics.mismatchedScenarioIds).not.toContain('gifting-not-wildcard');
  });

  it('detects buzz-cut mutation that incorrectly selects a styling product', () => {
    const stubs = buildCalibrationStubProfiles();
    const products = calibrationProductEntries(stubs);
    const buzzCut = stubs.services.get('cal-svc-buzz-cut')!;
    const mutatedService = {
      ...buzzCut,
      retailNeeds: ['HAIR_STYLING_CONTROL'] as typeof buzzCut.retailNeeds,
    };
    const mutatedServices = new Map(stubs.services);
    mutatedServices.set('cal-svc-buzz-cut', mutatedService);

    const gold = getCalibrationGoldExpectations();
    const emptyScenario = gold.recommendations.find((s) => s.id === 'gifting-not-wildcard')!;
    const metrics = computeRecommendationMetrics(
      [emptyScenario],
      mutatedServices,
      products,
      stubs.products,
    );

    expect(metrics.expectedEmptyPassRate).toBe(0);
    expect(metrics.mismatchedScenarioIds).toContain('gifting-not-wildcard');
    expect(metrics.unexpectedEmptyScenarioSelections[0]?.productIds.length).toBeGreaterThan(0);
  });

  it('computeLiveDeterministicRepeatability returns 1 for deterministic factory', () => {
    const stubs = buildCalibrationStubProfiles();
    const products = calibrationProductEntries(stubs);
    const gold = getCalibrationGoldExpectations();
    const factory = createLiveRankingFactory(stubs.services, products, new Map());

    const rate = computeLiveDeterministicRepeatability(
      gold.recommendations,
      stubs.services,
      factory,
    );
    expect(rate).toBe(1);
  });

  it('computeLiveDeterministicRepeatability includes expectEmpty scenarios', () => {
    const stubs = buildCalibrationStubProfiles();
    const products = calibrationProductEntries(stubs);
    const gold = getCalibrationGoldExpectations();
    const factory = createLiveRankingFactory(stubs.services, products, new Map());
    const emptyScenario = gold.recommendations.find((s) => s.expectEmpty)!;

    const rate = computeLiveDeterministicRepeatability(
      [emptyScenario],
      stubs.services,
      factory,
    );
    expect(rate).toBe(1);
  });

  it('computeLiveDeterministicRepeatability detects nondeterministic factory', () => {
    const stubs = buildCalibrationStubProfiles();
    const products = calibrationProductEntries(stubs);
    const gold = getCalibrationGoldExpectations();
    const scenario = gold.recommendations.find((s) => s.id === 'combo-hair-beard-coverage')!;
    const deterministicFactory = createLiveRankingFactory(stubs.services, products, new Map());

    let flip = false;
    const nondeterministicFactory: LiveRankingFactory = (serviceId) => {
      const ranking = deterministicFactory(serviceId);
      if (ranking.finalRanked.length < 2) return ranking;
      flip = !flip;
      const reversed = [...ranking.finalRanked].reverse();
      return { ...ranking, finalRanked: flip ? ranking.finalRanked : reversed };
    };

    const rate = computeLiveDeterministicRepeatability(
      [scenario],
      stubs.services,
      nondeterministicFactory,
    );
    expect(rate).toBeLessThan(1);
  });
});
