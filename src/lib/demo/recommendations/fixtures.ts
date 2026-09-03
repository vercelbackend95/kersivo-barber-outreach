import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from '@/lib/recommendations/contracts';
import { SCHEMA_VERSION, TAXONOMY_VERSION } from '@/lib/recommendations/constants';
import { DEMO_PRODUCTS } from '@/lib/demo/products';
import { DEMO_SERVICES } from '@/lib/demo/services';
import { buildRankedRecommendationsForService } from '@/lib/recommendations/scorer';
import type { CarouselProduct } from '@/lib/shop/carouselProducts';

const CRITICAL_FIELD_CONFIDENCE = { targetAreas: 0.85, retailNeeds: 0.85 };

function serviceProfile(
  serviceId: string,
  draft: Omit<ServiceSemanticProfileV2, 'schemaVersion' | 'taxonomyVersion' | 'entityType' | 'entityId' | 'shopId' | 'contentHash' | 'sourceSnapshot' | 'modelId' | 'promptVersion' | 'classifiedAt'>,
  snapshot: { name: string; description: string | null; category: string | null },
): ServiceSemanticProfileV2 {
  return {
    ...draft,
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId: serviceId,
    shopId: 'blackline-barbers-demo',
    contentHash: `demo-service-${serviceId}`,
    sourceSnapshot: snapshot,
    modelId: 'fixture',
    promptVersion: 'fixture',
    classifiedAt: new Date(0).toISOString(),
  };
}

function productProfile(
  productId: string,
  draft: Omit<ProductSemanticProfileV2, 'schemaVersion' | 'taxonomyVersion' | 'entityType' | 'entityId' | 'shopId' | 'contentHash' | 'sourceSnapshot' | 'modelId' | 'promptVersion' | 'classifiedAt'>,
  snapshot: { name: string; description: string | null; category: string },
): ProductSemanticProfileV2 {
  return {
    ...draft,
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'PRODUCT',
    entityId: productId,
    shopId: 'blackline-barbers-demo',
    contentHash: `demo-product-${productId}`,
    sourceSnapshot: snapshot,
    modelId: 'fixture',
    promptVersion: 'fixture',
    classifiedAt: new Date(0).toISOString(),
  };
}

const DEMO_SERVICE_PROFILES: Record<string, ServiceSemanticProfileV2> = {
  'bl-svc-skin-fade': serviceProfile(
    'bl-svc-skin-fade',
    {
      targetAreas: ['HAIR'],
      typicalHairLength: 'SHORT',
      techniques: ['SKIN_FADE'],
      outcomes: ['SHAPE_STRUCTURE', 'TEXTURE_DEFINITION'],
      aftercareNeeds: ['DAILY_STYLING'],
      incompatibilities: [],
      retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
      confidence: 0.9,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_SKIN_FADE'],
      warnings: [],
    },
    { name: 'Skin Fade', description: 'A seamless fade taken down to skin', category: 'cuts & fades' },
  ),
  'bl-svc-beard-trim': serviceProfile(
    'bl-svc-beard-trim',
    {
      targetAreas: ['BEARD'],
      typicalHairLength: 'NOT_APPLICABLE',
      techniques: ['BEARD_TRIM'],
      outcomes: ['BEARD_DEFINITION', 'NEAT_FINISH'],
      aftercareNeeds: ['BEARD_DAILY'],
      incompatibilities: [],
      retailNeeds: ['BEARD_SOFTENING', 'BEARD_SHAPING'],
      confidence: 0.9,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_BEARD_TRIM'],
      warnings: [],
    },
    { name: 'Beard Trim & Shape', description: 'Beard trim', category: 'beard & shave' },
  ),
  'bl-svc-hot-towel-shave': serviceProfile(
    'bl-svc-hot-towel-shave',
    {
      targetAreas: ['SHAVE', 'FACE'],
      typicalHairLength: 'NOT_APPLICABLE',
      techniques: ['HOT_TOWEL_SHAVE'],
      outcomes: ['SKIN_COMFORT_POST_SHAVE', 'NEAT_FINISH'],
      aftercareNeeds: ['POST_SHAVE_SOOTHING'],
      incompatibilities: [],
      retailNeeds: ['POST_SHAVE_SOOTHING', 'SHAVE_PREPARATION'],
      confidence: 0.88,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_HOT_TOWEL'],
      warnings: [],
    },
    { name: 'Hot Towel Wet Shave', description: 'Wet shave', category: 'beard & shave' },
  ),
  'bl-svc-restyle': serviceProfile(
    'bl-svc-restyle',
    {
      targetAreas: ['HAIR'],
      typicalHairLength: 'LONG',
      techniques: ['SCISSOR_CUT'],
      outcomes: ['VOLUME', 'TEXTURE_DEFINITION'],
      aftercareNeeds: ['DAILY_STYLING'],
      incompatibilities: [],
      retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_SMOOTHING_FRIZZ_CONTROL', 'HAIR_VOLUME', 'HAIR_CONDITIONING'],
      confidence: 0.85,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_RESTYLE'],
      warnings: [],
    },
    { name: 'Restyle', description: 'Restyle longer hair', category: 'cuts & fades' },
  ),
};

const DEMO_PRODUCT_PROFILES: Record<string, ProductSemanticProfileV2> = {
  'bl-product-matte-clay': productProfile(
    'bl-product-matte-clay',
    {
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
      evidenceCodes: ['NAME_MATTE_CLAY'],
      warnings: [],
    },
    { name: 'Matte Clay', description: 'Matte clay for short hair', category: 'STYLING' },
  ),
  'bl-product-matte-pomade': productProfile(
    'bl-product-matte-pomade',
    {
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'SHORT',
      productFamily: 'POMADE',
      benefits: ['HOLD', 'MATTE_FINISH'],
      holdStrength: 'MEDIUM',
      finish: 'MATTE',
      incompatibilities: [],
      retailNeeds: ['HAIR_STYLING_CONTROL'],
      confidence: 0.88,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_MATTE_POMADE'],
      warnings: [],
    },
    { name: 'Matte Pomade', description: 'Medium hold matte pomade', category: 'STYLING' },
  ),
  'bl-product-beard-oil': productProfile(
    'bl-product-beard-oil',
    {
      targetAreas: ['BEARD'],
      hairLengthSuitability: 'NOT_APPLICABLE',
      productFamily: 'OIL',
      benefits: ['BEARD_SOFTENING', 'BEARD_SHAPE'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      incompatibilities: ['BEARD_ONLY'],
      retailNeeds: ['BEARD_SOFTENING'],
      confidence: 0.9,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_BEARD_OIL'],
      warnings: [],
    },
    { name: 'Beard Oil', description: 'Beard oil', category: 'BEARD_CARE' },
  ),
  'bl-product-beard-balm': productProfile(
    'bl-product-beard-balm',
    {
      targetAreas: ['BEARD'],
      hairLengthSuitability: 'NOT_APPLICABLE',
      productFamily: 'BALM',
      benefits: ['BEARD_SHAPE', 'BEARD_SOFTENING'],
      holdStrength: 'LIGHT',
      finish: 'NATURAL',
      incompatibilities: ['BEARD_ONLY'],
      retailNeeds: ['BEARD_SOFTENING', 'BEARD_SHAPING'],
      confidence: 0.88,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_BEARD_BALM'],
      warnings: [],
    },
    { name: 'Beard Balm', description: 'Beard balm', category: 'BEARD_CARE' },
  ),
  'bl-product-beard-wash': productProfile(
    'bl-product-beard-wash',
    {
      targetAreas: ['BEARD'],
      hairLengthSuitability: 'NOT_APPLICABLE',
      productFamily: 'WASH_SHAMPOO',
      benefits: ['CLEANSING', 'BEARD_SOFTENING'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      incompatibilities: ['BEARD_ONLY'],
      retailNeeds: ['BEARD_CLEANSING'],
      confidence: 0.84,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_BEARD_WASH'],
      warnings: [],
    },
    { name: 'Beard Wash', description: 'Beard wash', category: 'BEARD_CARE' },
  ),
  'bl-product-daily-conditioner': productProfile(
    'bl-product-daily-conditioner',
    {
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'ANY',
      productFamily: 'CONDITIONER',
      benefits: ['DETANGLING'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      incompatibilities: ['NOT_FOR_BEARD'],
      retailNeeds: ['HAIR_CONDITIONING'],
      confidence: 0.82,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_CONDITIONER'],
      warnings: [],
    },
    { name: 'Daily Conditioner', description: 'Everyday conditioner', category: 'HAIR_WASH' },
  ),
  'bl-product-aftershave-balm': productProfile(
    'bl-product-aftershave-balm',
    {
      targetAreas: ['SHAVE', 'FACE'],
      hairLengthSuitability: 'NOT_APPLICABLE',
      productFamily: 'AFTERSHAVE_BALM',
      benefits: ['POST_SHAVE_COMFORT'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      incompatibilities: ['POST_SHAVE_ONLY'],
      retailNeeds: ['POST_SHAVE_SOOTHING'],
      confidence: 0.9,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_AFTERSHAVE'],
      warnings: [],
    },
    { name: 'Aftershave Balm', description: 'Post shave balm', category: 'SHAVE_AND_SKIN' },
  ),
  'bl-product-shave-cream': productProfile(
    'bl-product-shave-cream',
    {
      targetAreas: ['SHAVE', 'FACE'],
      hairLengthSuitability: 'NOT_APPLICABLE',
      productFamily: 'CREAM',
      benefits: ['CLEANSING'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      incompatibilities: [],
      retailNeeds: ['SHAVE_PREPARATION'],
      confidence: 0.86,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_SHAVE_CREAM'],
      warnings: [],
    },
    { name: 'Shave Cream', description: 'Rich shave cream', category: 'SHAVE_AND_SKIN' },
  ),
  'bl-product-daily-moisturiser': productProfile(
    'bl-product-daily-moisturiser',
    {
      targetAreas: ['FACE'],
      hairLengthSuitability: 'NOT_APPLICABLE',
      productFamily: 'MOISTURISER',
      benefits: ['POST_SHAVE_COMFORT'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      incompatibilities: [],
      retailNeeds: ['FACE_MOISTURISING'],
      confidence: 0.82,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['NAME_MOISTURISER'],
      warnings: [],
    },
    { name: 'Daily Moisturiser', description: 'Daily face moisturiser', category: 'SHAVE_AND_SKIN' },
  ),
  'bl-product-styling-cream': productProfile(
    'bl-product-styling-cream',
    {
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'LONG',
      productFamily: 'CREAM',
      benefits: ['TEXTURE', 'VOLUME'],
      holdStrength: 'LIGHT',
      finish: 'NATURAL',
      incompatibilities: [],
      retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_SMOOTHING_FRIZZ_CONTROL'],
      confidence: 0.86,
      fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
      evidenceCodes: ['DESC_LONGER_HAIR'],
      warnings: [],
    },
    {
      name: 'Texture Cream',
      description: 'Soft cream for control without crunch. Suits longer hair',
      category: 'STYLING',
    },
  ),
};

function activeDemoProducts() {
  return DEMO_PRODUCTS.filter((p) => p.active).map((p) => ({
    id: p.id,
    profile: DEMO_PRODUCT_PROFILES[p.id],
  })).filter((row) => row.profile);
}

export function getDemoRecommendationProducts(serviceId: string): CarouselProduct[] {
  const service = DEMO_SERVICES.find((s) => s.id === serviceId);
  const serviceSemantic = DEMO_SERVICE_PROFILES[serviceId];
  if (!service || !serviceSemantic) return [];

  const ranked = buildRankedRecommendationsForService(serviceSemantic, activeDemoProducts());
  const productById = new Map(DEMO_PRODUCTS.map((p) => [p.id, p]));

  return ranked
    .map((row) => productById.get(row.productId))
    .filter((p): p is (typeof DEMO_PRODUCTS)[number] => Boolean(p))
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      pricePence: p.pricePence,
      imageUrl: p.image.src,
      available: true,
      requiresOptions: false,
    }));
}

export const DEMO_RECOMMENDATION_FIXTURE_VERSION = `${TAXONOMY_VERSION}:${SCHEMA_VERSION}`;
