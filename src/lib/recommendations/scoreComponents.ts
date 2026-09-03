import type { PositiveReasonCode, ScoreBreakdown } from './contracts';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';
import type { HardEligibilityContext } from './hardEligibility';
import type { TargetArea } from './taxonomy';

const WEIGHTS = {
  retailNeedRelevance: 0.55,
  targetAreaRelevance: 0.2,
  hairLengthSuitability: 0.1,
  techniqueProductAffinity: 0.1,
  confidenceQuality: 0.05,
} as const;

function concreteAreas(areas: TargetArea[]): TargetArea[] {
  return areas.filter(
    (area) => area !== 'UNKNOWN' && area !== 'GENERAL_GROOMING' && area !== 'TOOLS_ACCESSORIES',
  );
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const value of setA) {
    if (setB.has(value)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function scoreHairLength(
  service: ServiceSemanticProfileV2,
  product: ProductSemanticProfileV2,
  matchedAreas: TargetArea[],
): { score: number; reasonCodes: PositiveReasonCode[] } {
  const reasonCodes: PositiveReasonCode[] = [];
  if (!matchedAreas.includes('HAIR')) {
    return { score: 1, reasonCodes: ['HAIR_LENGTH_NOT_APPLICABLE'] };
  }

  const serviceLength = service.typicalHairLength;
  const productLength = product.hairLengthSuitability;

  if (productLength === 'ANY') {
    reasonCodes.push('HAIR_LENGTH_ANY');
    return { score: 1, reasonCodes };
  }
  if (serviceLength === productLength) {
    reasonCodes.push('HAIR_LENGTH_EXACT_MATCH');
    return { score: 1, reasonCodes };
  }
  if (serviceLength === 'UNKNOWN' || productLength === 'UNKNOWN') {
    return { score: 0.45, reasonCodes };
  }
  if (serviceLength === 'MEDIUM' || productLength === 'MEDIUM') {
    return { score: 0.65, reasonCodes };
  }
  return { score: 0.4, reasonCodes };
}

function scoreTechniqueAffinity(
  service: ServiceSemanticProfileV2,
  product: ProductSemanticProfileV2,
  overlapNeeds: HardEligibilityContext['overlapNeeds'],
): { score: number; reasonCodes: PositiveReasonCode[] } {
  let score = 0;
  const techniques = service.techniques.filter((technique) => technique !== 'UNKNOWN');
  const family = product.productFamily;
  const overlapSet = new Set(overlapNeeds);

  if (
    techniques.some((technique) =>
      ['SKIN_FADE', 'TAPER_FADE', 'CLIPPER_CUT', 'BUZZ_CUT'].includes(technique),
    )
  ) {
    if (['CLAY', 'POMADE', 'WAX', 'POWDER', 'SPRAY', 'GEL'].includes(family)) score += 0.55;
  }
  if (techniques.some((technique) => ['BEARD_TRIM', 'BEARD_SCULPT'].includes(technique))) {
    if (['OIL', 'BALM', 'BUTTER', 'WASH_SHAMPOO'].includes(family)) score += 0.6;
  }
  if (techniques.includes('HOT_TOWEL_SHAVE')) {
    if (['AFTERSHAVE_BALM', 'AFTERSHAVE_SPLASH', 'MOISTURISER', 'CREAM'].includes(family)) {
      score += 0.65;
    }
    if (overlapSet.has('SHAVE_PREPARATION') || overlapSet.has('POST_SHAVE_SOOTHING')) {
      score += 0.2;
    }
  }
  if (techniques.includes('SCALP_CLEANSE') && overlapSet.has('SCALP_CARE')) score += 0.7;
  if (techniques.includes('WASH_STYLE')) {
    if (overlapSet.has('HAIR_CLEANSING') || overlapSet.has('HAIR_CONDITIONING')) score += 0.45;
    if (overlapSet.has('HAIR_STYLING_CONTROL')) score += 0.25;
  }
  if (techniques.includes('COLOUR_GREY_BLEND') && overlapSet.has('COLOUR_MAINTENANCE')) score += 0.75;
  if (techniques.includes('SCISSOR_CUT') && product.hairLengthSuitability === 'LONG') score += 0.35;
  if (service.outcomes.includes('TEXTURE_DEFINITION') && product.benefits.includes('TEXTURE')) {
    score += 0.2;
  }
  if (service.outcomes.includes('SHAPE_STRUCTURE') && product.benefits.includes('HOLD')) {
    score += 0.2;
  }

  const normalized = Math.min(1, score);
  return {
    score: normalized,
    reasonCodes: normalized >= 0.35 ? ['TECHNIQUE_PRODUCT_AFFINITY'] : [],
  };
}

export function computeDeterministicScore(
  service: ServiceSemanticProfileV2,
  product: ProductSemanticProfileV2,
  context: HardEligibilityContext,
): { score: number; breakdown: ScoreBreakdown; reasonCodes: PositiveReasonCode[] } {
  const reasonCodes: PositiveReasonCode[] = [];

  const retailNeedRelevance = context.retailNeedF1;
  if (retailNeedRelevance >= 0.75) reasonCodes.push('RETAIL_NEED_STRONG_MATCH');
  else if (retailNeedRelevance >= 0.4) reasonCodes.push('RETAIL_NEED_PARTIAL_MATCH');

  const targetAreaRelevance = jaccard(
    concreteAreas(context.serviceConcreteAreas),
    concreteAreas(context.productConcreteAreas),
  );
  if (targetAreaRelevance > 0) reasonCodes.push('TARGET_AREA_EXACT_MATCH');

  const hairLength = scoreHairLength(service, product, context.matchedAreas);
  reasonCodes.push(...hairLength.reasonCodes);

  const technique = scoreTechniqueAffinity(service, product, context.overlapNeeds);
  reasonCodes.push(...technique.reasonCodes);

  const confidenceQuality = Math.min(service.confidence, product.confidence);
  if (service.confidence >= 0.8 && product.confidence >= 0.8) {
    reasonCodes.push('HIGH_CONFIDENCE_MATCH');
  }

  const breakdown: ScoreBreakdown = {
    retailNeedRelevance,
    targetAreaRelevance,
    hairLengthSuitability: hairLength.score,
    techniqueProductAffinity: technique.score,
    confidenceQuality,
  };

  const score =
    WEIGHTS.retailNeedRelevance * breakdown.retailNeedRelevance +
    WEIGHTS.targetAreaRelevance * breakdown.targetAreaRelevance +
    WEIGHTS.hairLengthSuitability * breakdown.hairLengthSuitability +
    WEIGHTS.techniqueProductAffinity * breakdown.techniqueProductAffinity +
    WEIGHTS.confidenceQuality * breakdown.confidenceQuality;

  return {
    score: Math.min(1, Math.max(0, score)),
    breakdown,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

export const SCORE_WEIGHTS = WEIGHTS;

export function computeRetailNeedF1ForTest(
  serviceNeeds: string[],
  productNeeds: string[],
): number {
  const overlap = serviceNeeds.filter((need) => productNeeds.includes(need));
  if (overlap.length === 0) return 0;
  const precision = overlap.length / productNeeds.length;
  const recall = overlap.length / serviceNeeds.length;
  const denominator = precision + recall;
  return denominator === 0 ? 0 : (2 * precision * recall) / denominator;
}
