import {
  MAX_PER_PRODUCT_FAMILY,
  MAX_RECOMMENDATIONS,
  MIN_RECOMMENDATIONS_TO_RENDER,
} from './constants';
import type { ProductSemanticProfileV2, ScoredCandidate, ServiceSemanticProfileV2 } from './contracts';
import { selectDiverseCandidates, sortDeterministicCandidates } from './candidateSelection';
import { evaluateServiceProductPair } from './pairEvaluation';

export type ScorePairInput = {
  service: ServiceSemanticProfileV2;
  product: ProductSemanticProfileV2;
  productId: string;
};

export { evaluateServiceProductPair } from './pairEvaluation';

export function scoreServiceProductPair(input: ScorePairInput): ScoredCandidate | null {
  const evaluation = evaluateServiceProductPair(input);
  return evaluation.eligible ? evaluation.candidate : null;
}

export function scoreEligibleCandidatesForService(
  service: ServiceSemanticProfileV2,
  products: Array<{ id: string; profile: ProductSemanticProfileV2 }>,
): ScoredCandidate[] {
  const candidates: ScoredCandidate[] = [];

  for (const { id, profile } of products) {
    const scored = scoreServiceProductPair({ service, product: profile, productId: id });
    if (scored) candidates.push(scored);
  }

  return sortDeterministicCandidates(candidates);
}

export function buildRankedRecommendationsForService(
  service: ServiceSemanticProfileV2,
  products: Array<{ id: string; profile: ProductSemanticProfileV2 }>,
): ScoredCandidate[] {
  const eligible = scoreEligibleCandidatesForService(service, products);
  return selectDiverseCandidates(
    eligible,
    MAX_RECOMMENDATIONS,
    MAX_PER_PRODUCT_FAMILY,
    service,
  );
}

export function shouldRenderRecommendations(count: number): boolean {
  return count >= MIN_RECOMMENDATIONS_TO_RENDER;
}

export function mergeMultiServiceRecommendations(
  perService: ScoredCandidate[][],
): ScoredCandidate[] {
  const merged = new Map<string, ScoredCandidate>();
  for (const list of perService) {
    for (const item of list) {
      const existing = merged.get(item.productId);
      if (!existing || item.deterministicScore > existing.deterministicScore) {
        merged.set(item.productId, item);
      }
    }
  }
  return selectDiverseCandidates(
    [...merged.values()],
    MAX_RECOMMENDATIONS,
    MAX_PER_PRODUCT_FAMILY,
  );
}
