import type { PairRejectionCode } from '../pairEvaluation';

export type GoldenPairAssertion = {
  productId: string;
  expectedEligible: boolean;
  reasonCode?: PairRejectionCode;
};

export type GoldenScenario = {
  id: string;
  serviceId: string;
  mustInclude?: string[];
  mustExclude?: string[];
  expectedTopProductId?: string;
  requireHairAndBeardCoverage?: boolean;
  expectEmpty?: boolean;
  pairAssertions?: GoldenPairAssertion[];
};

export const GOLDEN_SCENARIOS: GoldenScenario[] = [
  {
    id: 'skin-fade-styling',
    serviceId: 'g-skin-fade',
    mustInclude: ['g-matte-clay', 'g-texture-powder'],
    mustExclude: [
      'g-long-hair-shampoo',
      'g-daily-conditioner',
      'g-beard-oil',
      'g-aftershave-balm',
      'g-grooming-comb',
      'g-gift-set',
      'g-ambiguous-product',
    ],
    expectedTopProductId: 'g-matte-clay',
    pairAssertions: [
      {
        productId: 'g-long-hair-shampoo',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-daily-conditioner',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-grooming-comb',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-gift-set',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-ambiguous-product',
        expectedEligible: false,
        reasonCode: 'PRODUCT_PROFILE_LOW_CONFIDENCE',
      },
    ],
  },
  {
    id: 'taper-fade-styling',
    serviceId: 'g-taper-fade',
    mustInclude: ['g-matte-clay', 'g-matte-pomade'],
    mustExclude: ['g-beard-oil', 'g-long-hair-shampoo'],
    expectedTopProductId: 'g-matte-pomade',
  },
  {
    id: 'buzz-cut-styling',
    serviceId: 'g-buzz-cut',
    mustInclude: ['g-matte-clay'],
    mustExclude: ['g-beard-balm', 'g-long-hair-cream', 'g-long-hair-shampoo'],
    pairAssertions: [
      {
        productId: 'g-long-hair-cream',
        expectedEligible: false,
        reasonCode: 'HAIR_LENGTH_MISMATCH',
      },
      {
        productId: 'g-long-hair-shampoo',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
    ],
  },
  {
    id: 'long-hair-restyle',
    serviceId: 'g-long-hair-restyle',
    mustInclude: ['g-long-hair-cream', 'g-texture-spray'],
    mustExclude: [
      'g-short-only-pomade',
      'g-beard-oil',
      'g-aftershave-balm',
      'g-beard-balm',
      'g-shave-cream',
    ],
    expectedTopProductId: 'g-long-hair-cream',
    pairAssertions: [
      {
        productId: 'g-short-only-pomade',
        expectedEligible: false,
        reasonCode: 'HAIR_LENGTH_MISMATCH',
      },
      {
        productId: 'g-beard-oil',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
    ],
  },
  {
    id: 'beard-trim-care',
    serviceId: 'g-beard-trim',
    mustInclude: ['g-beard-oil', 'g-beard-balm'],
    mustExclude: [
      'g-daily-conditioner',
      'g-matte-clay',
      'g-face-wash',
      'g-aftershave-balm',
      'g-grooming-comb',
      'g-gift-set',
    ],
    expectedTopProductId: 'g-beard-balm',
    pairAssertions: [
      {
        productId: 'g-matte-clay',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-face-wash',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-gift-set',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
    ],
  },
  {
    id: 'hair-beard-combo-coverage',
    serviceId: 'g-hair-beard-combo',
    mustInclude: ['g-matte-clay', 'g-beard-oil'],
    mustExclude: ['g-gift-set'],
    requireHairAndBeardCoverage: true,
  },
  {
    id: 'hot-towel-shave',
    serviceId: 'g-hot-towel-shave',
    mustInclude: ['g-aftershave-balm', 'g-shave-cream'],
    mustExclude: ['g-matte-clay', 'g-beard-oil', 'g-grooming-comb', 'g-gift-set'],
    expectedTopProductId: 'g-aftershave-balm',
    pairAssertions: [
      {
        productId: 'g-matte-clay',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-beard-oil',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-gift-set',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
    ],
  },
  {
    id: 'scalp-cleanse',
    serviceId: 'g-scalp-cleanse',
    mustInclude: ['g-scalp-scrub'],
    mustExclude: ['g-beard-wash', 'g-moustache-wax', 'g-matte-clay', 'g-gift-set'],
    expectedTopProductId: 'g-scalp-scrub',
    pairAssertions: [
      {
        productId: 'g-matte-clay',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-gift-set',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
    ],
  },
  {
    id: 'facial-grooming',
    serviceId: 'g-facial-grooming',
    mustInclude: ['g-face-wash', 'g-daily-moisturiser'],
    mustExclude: ['g-matte-clay', 'g-beard-oil', 'g-beard-balm', 'g-aftershave-balm'],
    pairAssertions: [
      {
        productId: 'g-matte-clay',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-beard-oil',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-aftershave-balm',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
    ],
  },
  {
    id: 'grey-blend-colour',
    serviceId: 'g-grey-blend',
    mustInclude: ['g-colour-shampoo'],
    mustExclude: [
      'g-beard-oil',
      'g-aftershave-balm',
      'g-daily-conditioner',
      'g-grooming-comb',
      'g-gift-set',
    ],
    expectedTopProductId: 'g-colour-shampoo',
    pairAssertions: [
      {
        productId: 'g-daily-conditioner',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
      {
        productId: 'g-gift-set',
        expectedEligible: false,
        reasonCode: 'NO_RETAIL_NEED_OVERLAP',
      },
    ],
  },
  {
    id: 'low-confidence-empty',
    serviceId: 'g-low-confidence-service',
    expectEmpty: true,
  },
  {
    id: 'combo-not-for-beard-conditioner',
    serviceId: 'g-hair-not-for-beard-product-test',
    mustInclude: ['g-daily-conditioner'],
    mustExclude: ['g-long-hair-shampoo'],
  },
];
