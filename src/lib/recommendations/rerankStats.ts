import type { RecommendationSetRerankStats } from './contracts';

export function createEmptyRerankStats(): RecommendationSetRerankStats {
  return {
    rerankEligibleServiceCount: 0,
    rerankAttemptedServiceCount: 0,
    rerankAppliedServiceCount: 0,
    rerankFallbackServiceCount: 0,
    rerankSkippedInsufficientCandidatesCount: 0,
    rerankFallbackReasonCounts: {},
  };
}

export function recordRerankFallback(
  stats: RecommendationSetRerankStats,
  reasonCode: string,
): void {
  stats.rerankFallbackServiceCount += 1;
  stats.rerankFallbackReasonCounts[reasonCode] =
    (stats.rerankFallbackReasonCounts[reasonCode] ?? 0) + 1;
}
