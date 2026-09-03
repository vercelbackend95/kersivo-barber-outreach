import { applyBoundedRerank, type RerankDecision } from '../../boundedRerank';
import { selectDiverseCandidates } from '../../candidateSelection';
import { MAX_PER_PRODUCT_FAMILY, MAX_RECOMMENDATIONS } from '../../constants';
import type { ProductSemanticProfileV2, ScoredCandidate, ServiceSemanticProfileV2 } from '../../contracts';
import { createRerankPool } from '../../rerankPool';
import { scoreEligibleCandidatesForService } from '../../scorer';

export type RerankCandidateDiagnostic = {
  productId: string;
  deterministicPosition: number;
  rerankPosition?: number;
  finalPosition: number;
  rankDelta: number;
  deterministicScore: number;
  selectionScore?: number;
  rerankApplied: boolean;
  fallbackReason?: string;
};

export type LiveServiceRanking = {
  eligible: ScoredCandidate[];
  rerankPoolIds: string[];
  finalRanked: ScoredCandidate[];
  rerankApplied: boolean;
  rerankFallbackReason?: string;
  candidateDiagnostics: RerankCandidateDiagnostic[];
};

function buildCandidateDiagnostics(
  eligible: ScoredCandidate[],
  rerankPoolIds: string[],
  postRerank: ScoredCandidate[],
  finalRanked: ScoredCandidate[],
  rerankApplied: boolean,
  fallbackReason?: string,
): RerankCandidateDiagnostic[] {
  const deterministicPos = new Map(eligible.map((c, i) => [c.productId, i + 1]));
  const rerankPos = new Map(
    postRerank
      .filter((c) => c.rerankPosition != null)
      .map((c) => [c.productId, c.rerankPosition!]),
  );
  const finalPos = new Map(finalRanked.map((c, i) => [c.productId, i + 1]));

  const poolSet = new Set(rerankPoolIds);
  const trackedIds = new Set([
    ...eligible.filter((c) => poolSet.has(c.productId)).map((c) => c.productId),
    ...finalRanked.map((c) => c.productId),
  ]);

  return [...trackedIds].map((productId) => {
    const detPos = deterministicPos.get(productId) ?? 0;
    const rerPos = rerankPos.get(productId);
    const finPos = finalPos.get(productId) ?? 0;
    const candidate =
      postRerank.find((c) => c.productId === productId) ??
      eligible.find((c) => c.productId === productId);
    return {
      productId,
      deterministicPosition: detPos,
      rerankPosition: rerPos,
      finalPosition: finPos,
      rankDelta: detPos > 0 && finPos > 0 ? detPos - finPos : 0,
      deterministicScore: candidate?.deterministicScore ?? 0,
      selectionScore: candidate?.selectionScore,
      rerankApplied,
      fallbackReason,
    };
  });
}

export function buildLiveServiceRanking(
  service: ServiceSemanticProfileV2,
  productEntries: Array<{ id: string; profile: ProductSemanticProfileV2 }>,
  rerankDecision?: RerankDecision,
): LiveServiceRanking {
  const eligible = scoreEligibleCandidatesForService(service, productEntries);

  if (!rerankDecision || eligible.length < 2) {
    const finalRanked = selectDiverseCandidates(
      eligible,
      MAX_RECOMMENDATIONS,
      MAX_PER_PRODUCT_FAMILY,
      service,
    );
    return {
      eligible,
      rerankPoolIds: [],
      finalRanked,
      rerankApplied: false,
      candidateDiagnostics: buildCandidateDiagnostics(eligible, [], eligible, finalRanked, false),
    };
  }

  const rerankPool = createRerankPool(eligible);
  const rerankPoolIds = rerankPool.map((c) => c.productId);
  const bounded = applyBoundedRerank(eligible, rerankPoolIds, rerankDecision);
  const finalRanked = selectDiverseCandidates(
    bounded.candidates,
    MAX_RECOMMENDATIONS,
    MAX_PER_PRODUCT_FAMILY,
    service,
  );

  return {
    eligible,
    rerankPoolIds,
    finalRanked,
    rerankApplied: bounded.applied,
    rerankFallbackReason: bounded.applied ? undefined : bounded.reasonCode,
    candidateDiagnostics: buildCandidateDiagnostics(
      eligible,
      rerankPoolIds,
      bounded.candidates,
      finalRanked,
      bounded.applied,
      bounded.applied ? undefined : bounded.reasonCode,
    ),
  };
}

export type LiveRankingResolver = (
  serviceId: string,
) => LiveServiceRanking | undefined;

export type LiveRankingFactory = (serviceId: string) => LiveServiceRanking;

export function createLiveRankingFactory(
  services: Map<string, ServiceSemanticProfileV2>,
  productEntries: Array<{ id: string; profile: ProductSemanticProfileV2 }>,
  rerankDecisions: Map<string, RerankDecision>,
): LiveRankingFactory {
  return (serviceId) => {
    const service = services.get(serviceId);
    if (!service) {
      throw new Error(`Missing service for repeatability: ${serviceId}`);
    }
    return buildLiveServiceRanking(service, productEntries, rerankDecisions.get(serviceId));
  };
}

export function createLiveRankingResolver(
  rankings: Map<string, LiveServiceRanking>,
): LiveRankingResolver {
  return (serviceId) => rankings.get(serviceId);
}
