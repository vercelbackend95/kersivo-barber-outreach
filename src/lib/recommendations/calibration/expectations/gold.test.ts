import { describe, expect, it } from 'vitest';

import { getCalibrationGoldExpectations } from './gold';
import { parseCalibrationGoldExpectations } from './validateGold';
import { CALIBRATION_CATALOGUE } from '../dataset/catalogue';
import { loadValidatedGoldExpectations } from './validateGold';

describe('calibration gold expectations', () => {
  it('loads valid gold expectations with cross-reference validation', () => {
    const gold = getCalibrationGoldExpectations();
    expect(gold.classification.length).toBeGreaterThan(0);
    expect(gold.recommendations.length).toBeGreaterThan(0);
    for (const scenario of gold.recommendations) {
      if (!scenario.expectEmpty) {
        expect(scenario.relevantProductIds?.length).toBeGreaterThan(0);
      }
    }
  });

  it('rejects invalid gold schema', () => {
    expect(() =>
      parseCalibrationGoldExpectations({
        classification: [{ entityId: '', entityType: 'SERVICE' }],
        recommendations: [],
      }),
    ).toThrow();
  });

  it('rejects mustInclude not subset of relevantProductIds', () => {
    expect(() =>
      loadValidatedGoldExpectations(
        {
          classification: [],
          recommendations: [
            {
              id: 'bad',
              serviceId: 'cal-svc-skin-fade',
              relevantProductIds: ['cal-prod-pomade'],
              mustInclude: ['cal-prod-matte-clay'],
            },
          ],
        },
        CALIBRATION_CATALOGUE,
      ),
    ).toThrow(/mustInclude not subset/);
  });

  it('includes safety scenarios', () => {
    const gold = getCalibrationGoldExpectations();
    const ids = gold.recommendations.map((s) => s.id);
    expect(ids).toContain('skin-fade-safety');
    expect(ids).toContain('gifting-not-wildcard');
    expect(ids).toContain('ambiguous-product-fail-closed');
  });
});
