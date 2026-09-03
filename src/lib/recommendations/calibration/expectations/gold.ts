import type { CalibrationGoldExpectations } from '../types';
import { loadValidatedGoldExpectations } from './validateGold';
import { CALIBRATION_CATALOGUE } from '../dataset/catalogue';

export const CALIBRATION_GOLD_EXPECTATIONS: CalibrationGoldExpectations = {
  classification: [
    {
      entityId: 'cal-svc-skin-fade',
      entityType: 'SERVICE',
      minConfidence: 0.7,
      targetAreas: { required: ['HAIR'] },
      retailNeeds: { required: ['HAIR_STYLING_CONTROL'] },
    },
    {
      entityId: 'cal-svc-beard-trim',
      entityType: 'SERVICE',
      targetAreas: { required: ['BEARD'] },
      retailNeeds: { forbidden: ['HAIR_STYLING_CONTROL'] },
    },
    {
      entityId: 'cal-svc-long-restyle',
      entityType: 'SERVICE',
      targetAreas: { required: ['HAIR'] },
      retailNeeds: {
        allowed: ['HAIR_STYLING_CONTROL', 'HAIR_SMOOTHING_FRIZZ_CONTROL', 'HAIR_CLEANSING'],
      },
    },
    {
      entityId: 'cal-svc-hot-shave',
      entityType: 'SERVICE',
      targetAreas: { required: ['SHAVE', 'FACE'] },
      retailNeeds: { forbidden: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'] },
    },
    {
      entityId: 'cal-svc-hair-beard',
      entityType: 'SERVICE',
      targetAreas: { required: ['HAIR', 'BEARD'] },
    },
    {
      entityId: 'cal-svc-no-desc',
      entityType: 'SERVICE',
      expectFailClosed: true,
      maxConfidence: 0.55,
    },
    {
      entityId: 'cal-prod-long-shampoo',
      entityType: 'PRODUCT',
      hairLengthSuitability: { required: ['LONG'] },
      incompatibilities: { required: ['FOR_LONG_HAIR_ONLY'] },
    },
    {
      entityId: 'cal-prod-short-only-clay',
      entityType: 'PRODUCT',
      hairLengthSuitability: { required: ['SHORT'] },
      incompatibilities: { required: ['FOR_SHORT_HAIR_ONLY'] },
    },
    {
      entityId: 'cal-prod-gift-set',
      entityType: 'PRODUCT',
      productFamily: { required: ['GIFT_SET'] },
      retailNeeds: { required: ['GIFTING'] },
    },
    {
      entityId: 'cal-prod-ambiguous',
      entityType: 'PRODUCT',
      expectFailClosed: true,
      maxConfidence: 0.55,
    },
    {
      entityId: 'cal-prod-injection',
      entityType: 'PRODUCT',
      targetAreas: { forbidden: ['UNKNOWN'] },
      retailNeeds: { forbidden: ['GIFTING'] },
    },
  ],
  recommendations: [
    {
      id: 'skin-fade-safety',
      serviceId: 'cal-svc-skin-fade',
      relevantProductIds: [
        'cal-prod-matte-clay',
        'cal-prod-powder',
        'cal-prod-fibre',
        'cal-prod-pomade',
        'cal-prod-wax',
        'cal-prod-injection',
        'cal-prod-short-only-clay',
        'cal-prod-kids-gel',
        'cal-prod-typo-pomad',
        'cal-prod-misleading',
        'cal-prod-sea-salt',
      ],
      mustInclude: ['cal-prod-matte-clay'],
      mustExclude: ['cal-prod-long-shampoo', 'cal-prod-beard-oil', 'cal-prod-gift-set'],
      criticalMustExclude: ['cal-prod-long-shampoo'],
      pairAssertions: [
        {
          productId: 'cal-prod-long-shampoo',
          expected: 'REJECTED',
          allowedRejectionCodes: ['NO_RETAIL_NEED_OVERLAP', 'HAIR_LENGTH_MISMATCH'],
        },
        {
          productId: 'cal-prod-matte-clay',
          expected: 'ELIGIBLE',
        },
      ],
      requiredFamilies: ['CLAY'],
    },
    {
      id: 'beard-only-no-hair-styling',
      serviceId: 'cal-svc-beard-trim',
      relevantProductIds: [
        'cal-prod-beard-oil',
        'cal-prod-beard-balm',
        'cal-prod-beard-wash',
        'cal-prod-beard-only-oil',
        'cal-prod-moustache-wax',
      ],
      mustInclude: ['cal-prod-beard-oil', 'cal-prod-beard-balm'],
      mustExclude: ['cal-prod-matte-clay', 'cal-prod-long-shampoo'],
      criticalMustExclude: ['cal-prod-matte-clay'],
      pairAssertions: [
        {
          productId: 'cal-prod-matte-clay',
          expected: 'REJECTED',
          allowedRejectionCodes: ['NO_RETAIL_NEED_OVERLAP', 'BEARD_ONLY_PRODUCT'],
        },
      ],
      requiredFamilies: ['OIL', 'BALM'],
    },
    {
      id: 'long-hair-no-short-only',
      serviceId: 'cal-svc-long-restyle',
      relevantProductIds: [
        'cal-prod-smoothing',
        'cal-prod-leave-in',
        'cal-prod-long-shampoo',
        'cal-prod-conditioner',
        'cal-prod-sea-salt',
        'cal-prod-daily-shampoo',
      ],
      mustInclude: ['cal-prod-smoothing', 'cal-prod-leave-in'],
      mustExclude: ['cal-prod-short-only-clay', 'cal-prod-beard-oil'],
      criticalMustExclude: ['cal-prod-short-only-clay'],
      pairAssertions: [
        {
          productId: 'cal-prod-short-only-clay',
          expected: 'REJECTED',
          allowedRejectionCodes: ['HAIR_LENGTH_MISMATCH'],
        },
      ],
    },
    {
      id: 'hot-towel-shave-safety',
      serviceId: 'cal-svc-hot-shave',
      relevantProductIds: [
        'cal-prod-shave-cream',
        'cal-prod-post-shave',
        'cal-prod-pre-shave',
        'cal-prod-hot-towel-oil',
        'cal-prod-aftershave-splash',
      ],
      mustInclude: ['cal-prod-shave-cream', 'cal-prod-post-shave'],
      mustExclude: ['cal-prod-matte-clay', 'cal-prod-curl-cream', 'cal-prod-gift-set'],
      criticalMustExclude: ['cal-prod-matte-clay'],
      pairAssertions: [
        {
          productId: 'cal-prod-matte-clay',
          expected: 'REJECTED',
          allowedRejectionCodes: ['NO_RETAIL_NEED_OVERLAP', 'NO_TARGET_AREA_OVERLAP'],
        },
      ],
    },
    {
      id: 'gifting-not-wildcard',
      serviceId: 'cal-svc-buzz-cut',
      expectEmpty: true,
      mustExclude: ['cal-prod-gift-set'],
      criticalMustExclude: ['cal-prod-gift-set'],
      pairAssertions: [
        {
          productId: 'cal-prod-gift-set',
          expected: 'REJECTED',
          allowedRejectionCodes: ['NO_RETAIL_NEED_OVERLAP', 'SERVICE_RETAIL_NEEDS_UNKNOWN'],
        },
      ],
    },
    {
      id: 'combo-hair-beard-coverage',
      serviceId: 'cal-svc-hair-beard',
      relevantProductIds: [
        'cal-prod-multi-balm',
        'cal-prod-matte-clay',
        'cal-prod-beard-oil',
        'cal-prod-beard-balm',
        'cal-prod-pomade',
        'cal-prod-short-only-clay',
        'cal-prod-injection',
      ],
      mustInclude: ['cal-prod-multi-balm'],
      requireHairAndBeardCoverage: true,
      pairAssertions: [
        { productId: 'cal-prod-beard-oil', expected: 'ELIGIBLE' },
        { productId: 'cal-prod-matte-clay', expected: 'ELIGIBLE' },
      ],
    },
    {
      id: 'fade-beard-combo',
      serviceId: 'cal-svc-fade-beard',
      relevantProductIds: [
        'cal-prod-multi-balm',
        'cal-prod-beard-balm',
        'cal-prod-matte-clay',
        'cal-prod-beard-oil',
        'cal-prod-pomade',
        'cal-prod-short-only-clay',
        'cal-prod-injection',
      ],
      mustInclude: ['cal-prod-beard-balm', 'cal-prod-multi-balm'],
      requireHairAndBeardCoverage: true,
    },
    {
      id: 'ambiguous-product-fail-closed',
      serviceId: 'cal-svc-scissor-cut',
      relevantProductIds: [
        'cal-prod-matte-clay',
        'cal-prod-pomade',
        'cal-prod-fibre',
        'cal-prod-sea-salt',
        'cal-prod-powder',
      ],
      mustExclude: ['cal-prod-ambiguous'],
      criticalMustExclude: ['cal-prod-ambiguous'],
      pairAssertions: [
        {
          productId: 'cal-prod-ambiguous',
          expected: 'REJECTED',
          allowedRejectionCodes: ['PRODUCT_PROFILE_LOW_CONFIDENCE', 'PRODUCT_CRITICAL_FIELD_LOW_CONFIDENCE'],
        },
      ],
    },
    {
      id: 'curly-hair-styling',
      serviceId: 'cal-svc-curly-cut',
      relevantProductIds: [
        'cal-prod-curl-cream',
        'cal-prod-smoothing',
        'cal-prod-sea-salt',
        'cal-prod-leave-in',
      ],
      mustInclude: ['cal-prod-curl-cream'],
      mustExclude: ['cal-prod-short-only-clay', 'cal-prod-beard-only-oil'],
    },
    {
      id: 'scalp-treatment',
      serviceId: 'cal-svc-scalp-treatment',
      relevantProductIds: [
        'cal-prod-scalp-scrub',
        'cal-prod-scalp-tonic',
        'cal-prod-daily-shampoo',
        'cal-prod-dry-shampoo',
      ],
      mustInclude: ['cal-prod-scalp-scrub'],
      mustExclude: ['cal-prod-matte-clay', 'cal-prod-moustache-wax'],
    },
  ],
};

export function getCalibrationGoldExpectations(): CalibrationGoldExpectations {
  return loadValidatedGoldExpectations(CALIBRATION_GOLD_EXPECTATIONS, CALIBRATION_CATALOGUE);
}
