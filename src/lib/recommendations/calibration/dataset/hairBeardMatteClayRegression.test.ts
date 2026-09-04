import { describe, expect, it } from 'vitest';

import { MATCH_SCORE_MIN } from '../../constants';
import { evaluateHardEligibility } from '../../hardEligibility';
import { computeDeterministicScore } from '../../scoreComponents';
import { buildCalibrationStubProfiles } from './stubProfiles';

describe('cal-svc-hair-beard × matte-clay regression', () => {
  it('is eligible with UNKNOWN length excluded from score denominator', () => {
    const stubs = buildCalibrationStubProfiles();
    const service = stubs.services.get('cal-svc-hair-beard')!;
    const product = stubs.products.get('cal-prod-matte-clay')!;

    expect(service.typicalHairLength).toBe('UNKNOWN');
    expect(service.confidence).toBeGreaterThanOrEqual(0.9);
    expect(service.fieldConfidence.typicalHairLength).toBeLessThanOrEqual(0.5);
    expect(service.fieldConfidence.targetAreas).toBeGreaterThanOrEqual(0.85);
    expect(service.fieldConfidence.retailNeeds).toBeGreaterThanOrEqual(0.85);

    const hard = evaluateHardEligibility(service, product);
    expect(hard.ok).toBe(true);
    if (!hard.ok) return;

    expect(hard.context.matchedAreas).toEqual(['HAIR']);
    const scored = computeDeterministicScore(service, product, hard.context);
    expect(scored.breakdown.hairLengthApplicable).toBe(false);
    expect(scored.reasonCodes).toContain('HAIR_LENGTH_UNKNOWN_NOT_USED');
    expect(scored.score).toBeGreaterThanOrEqual(MATCH_SCORE_MIN);
  });
});
