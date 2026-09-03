import { describe, expect, it } from 'vitest';

import { buildCalibrationStubProfiles, calibrationProductEntries } from './calibration/dataset/stubProfiles';
import { evaluateServiceProductPair } from './pairEvaluation';
import { buildRankedRecommendationsForService } from './scorer';

describe('curl-specific retail semantics', () => {
  const stubs = buildCalibrationStubProfiles();
  const products = calibrationProductEntries(stubs);

  const skinFade = stubs.services.get('cal-svc-skin-fade')!;
  const curlyCut = stubs.services.get('cal-svc-curly-cut')!;
  const scissorCut = stubs.services.get('cal-svc-scissor-cut')!;
  const buzzCut = stubs.services.get('cal-svc-buzz-cut')!;
  const curlCream = stubs.products.get('cal-prod-curl-cream')!;
  const matteClay = stubs.products.get('cal-prod-matte-clay')!;
  const fibre = stubs.products.get('cal-prod-fibre')!;
  const powder = stubs.products.get('cal-prod-powder')!;
  const giftSet = stubs.products.get('cal-prod-gift-set')!;

  it('curl cream is eligible for curly hair cut', () => {
    const result = evaluateServiceProductPair({
      service: curlyCut,
      product: curlCream,
      productId: 'cal-prod-curl-cream',
    });
    expect(result.eligible).toBe(true);
  });

  it('curl cream is not eligible for skin fade', () => {
    const result = evaluateServiceProductPair({
      service: skinFade,
      product: curlCream,
      productId: 'cal-prod-curl-cream',
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reasonCode).toBe('NO_RETAIL_NEED_OVERLAP');
    }
  });

  it('curl cream is not eligible for generic scissor cut without curl context', () => {
    const result = evaluateServiceProductPair({
      service: scissorCut,
      product: curlCream,
      productId: 'cal-prod-curl-cream',
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reasonCode).toBe('NO_RETAIL_NEED_OVERLAP');
    }
  });

  it('matte clay, fibre and powder cannot satisfy curly cut via HAIR_CURL_DEFINITION alone', () => {
    for (const [productId, product] of [
      ['cal-prod-matte-clay', matteClay],
      ['cal-prod-fibre', fibre],
      ['cal-prod-powder', powder],
    ] as const) {
      const result = evaluateServiceProductPair({
        service: curlyCut,
        product,
        productId,
      });
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasonCode).toBe('NO_RETAIL_NEED_OVERLAP');
      }
    }
  });

  it('buzz cut returns an empty recommendation rail without manufacturing styling needs', () => {
    expect(buzzCut.retailNeeds).toEqual(['UNKNOWN']);
    expect(buzzCut.confidence).toBeGreaterThanOrEqual(0.85);

    const ranked = buildRankedRecommendationsForService(buzzCut, products);
    expect(ranked).toHaveLength(0);
  });

  it('gift set pair assertion remains rejected for buzz cut', () => {
    const result = evaluateServiceProductPair({
      service: buzzCut,
      product: giftSet,
      productId: 'cal-prod-gift-set',
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(['NO_RETAIL_NEED_OVERLAP', 'SERVICE_RETAIL_NEEDS_UNKNOWN']).toContain(result.reasonCode);
    }
  });
});
