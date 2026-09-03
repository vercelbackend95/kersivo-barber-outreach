import {
  RERANK_CONFIDENCE_MIN,
  RERANK_MAX_SCORE_ADJUSTMENT,
} from './constants';
import type { ScoredCandidate } from './contracts';

export type RerankDecision = {
  orderedProductIds: string[];
  confidence: number;
};

export type BoundedRerankFallbackCode =
  | 'RERANK_INCOMPLETE_PERMUTATION'
  | 'RERANK_UNKNOWN_PRODUCT_ID'
  | 'RERANK_DUPLICATE_PRODUCT_ID'
  | 'RERANK_DUPLICATE_POOL_ID'
  | 'RERANK_LOW_CONFIDENCE'
  | 'RERANK_INVALID_CONFIDENCE';

export type BoundedRerankResult =
  | { applied: true; candidates: ScoredCandidate[] }
  | { applied: false; reasonCode: BoundedRerankFallbackCode; candidates: ScoredCandidate[] };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isValidConfidence(confidence: number): boolean {
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
}

function cloneDeterministicCandidates(
  allEligible: readonly ScoredCandidate[],
): ScoredCandidate[] {
  return allEligible.map((candidate) => {
    const {
      selectionScore: _selectionScore,
      rerankPosition: _rerankPosition,
      ...deterministic
    } = candidate;
    return { ...deterministic };
  });
}

function validatePoolIds(
  rerankPoolIds: readonly string[],
): 'RERANK_DUPLICATE_POOL_ID' | null {
  const seen = new Set<string>();
  for (const id of rerankPoolIds) {
    if (seen.has(id)) {
      return 'RERANK_DUPLICATE_POOL_ID';
    }
    seen.add(id);
  }
  return null;
}

function validatePermutation(
  orderedProductIds: readonly string[],
  rerankPoolIds: readonly string[],
): BoundedRerankFallbackCode | null {
  if (orderedProductIds.length !== rerankPoolIds.length) {
    return 'RERANK_INCOMPLETE_PERMUTATION';
  }

  const allowed = new Set(rerankPoolIds);
  const seen = new Set<string>();

  for (const id of orderedProductIds) {
    if (!allowed.has(id)) {
      return 'RERANK_UNKNOWN_PRODUCT_ID';
    }
    if (seen.has(id)) {
      return 'RERANK_DUPLICATE_PRODUCT_ID';
    }
    seen.add(id);
  }

  if (seen.size !== rerankPoolIds.length) {
    return 'RERANK_INCOMPLETE_PERMUTATION';
  }

  return null;
}

function computeSelectionScore(
  deterministicScore: number,
  zeroBasedPosition: number,
  poolSize: number,
  confidence: number,
): number {
  if (poolSize <= 1) {
    return deterministicScore;
  }

  const rankSignal = 1 - (2 * zeroBasedPosition) / (poolSize - 1);
  const confidenceStrength = clamp(
    (confidence - RERANK_CONFIDENCE_MIN) / (1 - RERANK_CONFIDENCE_MIN),
    0,
    1,
  );

  return clamp(
    deterministicScore + RERANK_MAX_SCORE_ADJUSTMENT * confidenceStrength * rankSignal,
    0,
    1,
  );
}

export function applyBoundedRerank(
  allEligible: readonly ScoredCandidate[],
  rerankPoolIds: readonly string[],
  decision: RerankDecision,
): BoundedRerankResult {
  const poolError = validatePoolIds(rerankPoolIds);
  if (poolError) {
    return {
      applied: false,
      reasonCode: poolError,
      candidates: cloneDeterministicCandidates(allEligible),
    };
  }

  if (!isValidConfidence(decision.confidence)) {
    return {
      applied: false,
      reasonCode: 'RERANK_INVALID_CONFIDENCE',
      candidates: cloneDeterministicCandidates(allEligible),
    };
  }

  if (decision.confidence < RERANK_CONFIDENCE_MIN) {
    return {
      applied: false,
      reasonCode: 'RERANK_LOW_CONFIDENCE',
      candidates: cloneDeterministicCandidates(allEligible),
    };
  }

  const permutationError = validatePermutation(decision.orderedProductIds, rerankPoolIds);
  if (permutationError) {
    return {
      applied: false,
      reasonCode: permutationError,
      candidates: cloneDeterministicCandidates(allEligible),
    };
  }

  const positionById = new Map(
    decision.orderedProductIds.map((productId, index) => [productId, index + 1]),
  );
  const poolIdSet = new Set(rerankPoolIds);
  const poolSize = rerankPoolIds.length;

  const candidates = cloneDeterministicCandidates(allEligible).map((candidate) => {
    if (!poolIdSet.has(candidate.productId)) {
      return candidate;
    }

    const zeroBasedPosition = decision.orderedProductIds.indexOf(candidate.productId);
    return {
      ...candidate,
      rerankPosition: positionById.get(candidate.productId),
      selectionScore: computeSelectionScore(
        candidate.deterministicScore,
        zeroBasedPosition,
        poolSize,
        decision.confidence,
      ),
    };
  });

  return { applied: true, candidates };
}
