import { MATCH_SCORE_MIN } from './constants';
import { checkProductConfidenceGates, checkServiceConfidenceGates } from './confidenceGates';
import type { ProductSemanticProfileV2, ScoredCandidate, ServiceSemanticProfileV2 } from './contracts';
import { evaluateHardEligibility } from './hardEligibility';
import { computeDeterministicScore } from './scoreComponents';

export type PairRejectionCode =
  | 'SERVICE_PROFILE_LOW_CONFIDENCE'
  | 'PRODUCT_PROFILE_LOW_CONFIDENCE'
  | 'SERVICE_CRITICAL_FIELD_LOW_CONFIDENCE'
  | 'PRODUCT_CRITICAL_FIELD_LOW_CONFIDENCE'
  | 'SERVICE_RETAIL_NEEDS_UNKNOWN'
  | 'PRODUCT_RETAIL_NEEDS_UNKNOWN'
  | 'NO_RETAIL_NEED_OVERLAP'
  | 'NO_TARGET_AREA_OVERLAP'
  | 'HAIR_LENGTH_MISMATCH'
  | 'BEARD_ONLY_PRODUCT'
  | 'HAIR_ONLY_PRODUCT'
  | 'POST_SHAVE_ONLY_PRODUCT'
  | 'NOT_FOR_BEARD'
  | 'NOT_FOR_SHAVE'
  | 'MATCH_SCORE_BELOW_THRESHOLD';

export type PairEvaluation =
  | { eligible: false; reasonCode: PairRejectionCode }
  | { eligible: true; candidate: ScoredCandidate };

export type EvaluatePairInput = {
  service: ServiceSemanticProfileV2;
  product: ProductSemanticProfileV2;
  productId: string;
};

export function evaluateServiceProductPair(input: EvaluatePairInput): PairEvaluation {
  const serviceGate = checkServiceConfidenceGates(input.service);
  if (serviceGate) return { eligible: false, reasonCode: serviceGate };

  const productGate = checkProductConfidenceGates(input.product);
  if (productGate) return { eligible: false, reasonCode: productGate };

  const hard = evaluateHardEligibility(input.service, input.product);
  if (!hard.ok) return { eligible: false, reasonCode: hard.reasonCode };

  const scored = computeDeterministicScore(input.service, input.product, hard.context);
  if (scored.score < MATCH_SCORE_MIN) {
    return { eligible: false, reasonCode: 'MATCH_SCORE_BELOW_THRESHOLD' };
  }

  return {
    eligible: true,
    candidate: {
      productId: input.productId,
      deterministicScore: scored.score,
      confidenceGate: Math.min(input.service.confidence, input.product.confidence),
      reasonCodes: scored.reasonCodes,
      productFamily: input.product.productFamily,
      matchedAreas: hard.context.matchedAreas,
      scoreBreakdown: scored.breakdown,
    },
  };
}
