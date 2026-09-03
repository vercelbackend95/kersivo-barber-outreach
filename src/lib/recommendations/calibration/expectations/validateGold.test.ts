import { describe, expect, it } from 'vitest';

import { CALIBRATION_CATALOGUE } from '../dataset/catalogue';
import { loadValidatedGoldExpectations } from './validateGold';

describe('validateGold cross-references', () => {
  it('rejects overlapping mustInclude and mustExclude', () => {
    expect(() =>
      loadValidatedGoldExpectations(
        {
          classification: [],
          recommendations: [
            {
              id: 'overlap',
              serviceId: 'cal-svc-skin-fade',
              relevantProductIds: ['cal-prod-matte-clay'],
              mustInclude: ['cal-prod-matte-clay'],
              mustExclude: ['cal-prod-matte-clay'],
            },
          ],
        },
        CALIBRATION_CATALOGUE,
      ),
    ).toThrow(/overlap/);
  });

  it('rejects unknown product references', () => {
    expect(() =>
      loadValidatedGoldExpectations(
        {
          classification: [],
          recommendations: [
            {
              id: 'bad-product',
              serviceId: 'cal-svc-skin-fade',
              relevantProductIds: ['cal-prod-unknown'],
            },
          ],
        },
        CALIBRATION_CATALOGUE,
      ),
    ).toThrow(/unknown product/);
  });

  it('rejects criticalMustExclude not subset of mustExclude', () => {
    expect(() =>
      loadValidatedGoldExpectations(
        {
          classification: [],
          recommendations: [
            {
              id: 'bad-critical',
              serviceId: 'cal-svc-skin-fade',
              relevantProductIds: ['cal-prod-matte-clay'],
              mustExclude: [],
              criticalMustExclude: ['cal-prod-matte-clay'],
            },
          ],
        },
        CALIBRATION_CATALOGUE,
      ),
    ).toThrow(/criticalMustExclude/);
  });
});
