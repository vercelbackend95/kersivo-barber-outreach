import { RERANK_CANDIDATE_LIMIT } from './constants';
import type { ScoredCandidate } from './contracts';
import { sortDeterministicCandidates } from './candidateSelection';

export function createRerankPool(
  eligible: readonly ScoredCandidate[],
  limit = RERANK_CANDIDATE_LIMIT,
): ScoredCandidate[] {
  return sortDeterministicCandidates([...eligible]).slice(0, limit);
}
