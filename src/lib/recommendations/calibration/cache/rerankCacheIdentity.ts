import { createHash } from 'node:crypto';

import type { ProductSemanticProfileV2, ScoredCandidate, ServiceSemanticProfileV2 } from '../../contracts';

export function computeRerankContentHash(params: {
  serviceProfile: ServiceSemanticProfileV2;
  rerankPoolIds: readonly string[];
  candidateSummaries: Array<{ id: string; summary: Record<string, unknown> }>;
}): string {
  const payload = {
    serviceContentHash: params.serviceProfile.contentHash,
    serviceRetailNeeds: params.serviceProfile.retailNeeds,
    serviceTargetAreas: params.serviceProfile.targetAreas,
    poolIds: params.rerankPoolIds,
    candidates: params.candidateSummaries.map((candidate) => ({
      id: candidate.id,
      summary: candidate.summary,
    })),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function buildRerankCandidateSummaries(
  rerankPool: ScoredCandidate[],
  productMap: Map<string, ProductSemanticProfileV2>,
  buildSummary: (
    candidate: ScoredCandidate,
    profile: ProductSemanticProfileV2,
  ) => Record<string, unknown>,
): Array<{ id: string; summary: Record<string, unknown> }> {
  return rerankPool.map((candidate) => {
    const profile = productMap.get(candidate.productId)!;
    return {
      id: candidate.productId,
      summary: buildSummary(candidate, profile),
    };
  });
}
