import { describe, expect, it } from 'vitest';

import { applyBoundedRerank } from './boundedRerank';
import type { ScoredCandidate } from './contracts';
import { selectDiverseCandidates } from './candidateSelection';
import { MAX_PER_PRODUCT_FAMILY, MAX_RECOMMENDATIONS } from './constants';

function candidate(
  productId: string,
  score: number,
  family = 'CLAY',
  selectionScore?: number,
  rerankPosition?: number,
): ScoredCandidate {
  return {
    productId,
    deterministicScore: score,
    confidenceGate: 0.9,
    reasonCodes: [],
    productFamily: family,
    matchedAreas: ['HAIR'],
    ...(selectionScore != null ? { selectionScore } : {}),
    ...(rerankPosition != null ? { rerankPosition } : {}),
  };
}

function expectDeterministicFallback(
  candidates: ScoredCandidate[],
  originals: readonly ScoredCandidate[],
): void {
  expect(candidates).toHaveLength(originals.length);
  for (const original of originals) {
    const restored = candidates.find((row) => row.productId === original.productId);
    expect(restored).toBeDefined();
    expect(restored?.deterministicScore).toBe(original.deterministicScore);
    expect(restored?.confidenceGate).toBe(original.confidenceGate);
    expect(restored?.productFamily).toBe(original.productFamily);
    expect(restored?.matchedAreas).toEqual(original.matchedAreas);
    expect(restored?.selectionScore).toBeUndefined();
    expect(restored?.rerankPosition).toBeUndefined();
  }
}

describe('applyBoundedRerank', () => {
  it('allows a close fifth-ranked candidate to enter the final four after high-confidence rerank', () => {
    const eligible = [
      candidate('p1', 0.72, 'A'),
      candidate('p2', 0.71, 'B'),
      candidate('p3', 0.70, 'C'),
      candidate('p4', 0.69, 'D'),
      candidate('p5', 0.68, 'E'),
      candidate('p6', 0.67, 'F'),
    ];
    const poolIds = eligible.map((row) => row.productId);

    const bounded = applyBoundedRerank(eligible, poolIds, {
      orderedProductIds: ['p6', 'p1', 'p2', 'p3', 'p4', 'p5'],
      confidence: 1,
    });
    expect(bounded.applied).toBe(true);

    const selected = selectDiverseCandidates(
      bounded.candidates,
      MAX_RECOMMENDATIONS,
      MAX_PER_PRODUCT_FAMILY,
    );
    expect(selected.map((row) => row.productId)).toContain('p6');
  });

  it('cannot overturn a large deterministic score gap even when AI reverses order', () => {
    const eligible = [candidate('strong', 0.9), candidate('weak', 0.5)];
    const bounded = applyBoundedRerank(eligible, ['strong', 'weak'], {
      orderedProductIds: ['weak', 'strong'],
      confidence: 1,
    });
    expect(bounded.applied).toBe(true);

    const selected = selectDiverseCandidates(
      bounded.candidates,
      1,
      MAX_PER_PRODUCT_FAMILY,
    );
    expect(selected[0]?.productId).toBe('strong');
  });

  it('leaves candidates outside the rerank pool without rerankPosition or AI adjustment', () => {
    const eligible = [
      candidate('in-pool-a', 0.8),
      candidate('in-pool-b', 0.7),
      candidate('outside', 0.6),
    ];
    const bounded = applyBoundedRerank(eligible, ['in-pool-a', 'in-pool-b'], {
      orderedProductIds: ['in-pool-b', 'in-pool-a'],
      confidence: 0.9,
    });
    expect(bounded.applied).toBe(true);

    const outside = bounded.candidates.find((row) => row.productId === 'outside');
    expect(outside?.rerankPosition).toBeUndefined();
    expect(outside?.selectionScore).toBeUndefined();
  });

  it('rejects foreign product ids in the permutation', () => {
    const eligible = [candidate('a', 0.8), candidate('b', 0.7)];
    const result = applyBoundedRerank(eligible, ['a', 'b'], {
      orderedProductIds: ['a', 'foreign'],
      confidence: 0.9,
    });
    expect(result.applied).toBe(false);
    if (!result.applied) {
      expect(result.reasonCode).toBe('RERANK_UNKNOWN_PRODUCT_ID');
    }
    expect(result.candidates.map((row) => row.productId)).toEqual(['a', 'b']);
    expect(result.candidates.every((row) => row.selectionScore == null)).toBe(true);
    expect(result.candidates.every((row) => row.rerankPosition == null)).toBe(true);
  });

  it('returns exact deterministic fallback after successful rerank followed by invalid permutation', () => {
    const originals = [candidate('a', 0.8), candidate('b', 0.7)];
    const poolIds = ['a', 'b'];

    const first = applyBoundedRerank(originals, poolIds, {
      orderedProductIds: ['b', 'a'],
      confidence: 0.9,
    });
    expect(first.applied).toBe(true);
    expect(first.candidates[0]?.selectionScore).toBeDefined();

    const second = applyBoundedRerank(first.candidates, poolIds, {
      orderedProductIds: ['a'],
      confidence: 0.9,
    });
    expect(second.applied).toBe(false);
    expectDeterministicFallback(second.candidates, originals);
  });

  it('returns exact deterministic fallback after successful rerank followed by low confidence', () => {
    const originals = [candidate('a', 0.8), candidate('b', 0.7)];
    const poolIds = ['a', 'b'];

    const first = applyBoundedRerank(originals, poolIds, {
      orderedProductIds: ['b', 'a'],
      confidence: 0.9,
    });
    expect(first.applied).toBe(true);

    const second = applyBoundedRerank(first.candidates, poolIds, {
      orderedProductIds: ['b', 'a'],
      confidence: 0.5,
    });
    expect(second.applied).toBe(false);
    if (!second.applied) {
      expect(second.reasonCode).toBe('RERANK_LOW_CONFIDENCE');
    }
    expectDeterministicFallback(second.candidates, originals);
  });

  it('does not mutate original input candidates', () => {
    const originals = [
      candidate('a', 0.8, 'CLAY', 0.99, 3),
      candidate('b', 0.7, 'POMADE', 0.88, 1),
    ];
    const frozen = originals.map((row) => ({
      ...row,
      matchedAreas: [...row.matchedAreas],
    }));

    applyBoundedRerank(frozen, ['a', 'b'], {
      orderedProductIds: ['b', 'a'],
      confidence: 0.9,
    });
    applyBoundedRerank(frozen, ['a', 'b'], {
      orderedProductIds: ['a'],
      confidence: 0.9,
    });

    expect(frozen[0]).toEqual(originals[0]);
    expect(frozen[1]).toEqual(originals[1]);
  });

  it('clears stale rerank metadata before assigning fresh positions on success', () => {
    const stale = [
      candidate('a', 0.8, 'CLAY', 0.99, 99),
      candidate('b', 0.7, 'POMADE', 0.88, 1),
    ];

    const bounded = applyBoundedRerank(stale, ['a', 'b'], {
      orderedProductIds: ['b', 'a'],
      confidence: 1,
    });
    expect(bounded.applied).toBe(true);

    const a = bounded.candidates.find((row) => row.productId === 'a');
    const b = bounded.candidates.find((row) => row.productId === 'b');
    expect(a?.rerankPosition).toBe(2);
    expect(b?.rerankPosition).toBe(1);
    expect(a?.selectionScore).toBeCloseTo(0.77, 3);
    expect(b?.selectionScore).toBeCloseTo(0.73, 3);
  });

  it('rejects duplicate rerank pool ids', () => {
    const eligible = [candidate('a', 0.8), candidate('b', 0.7)];
    const result = applyBoundedRerank(eligible, ['a', 'a'], {
      orderedProductIds: ['a', 'a'],
      confidence: 0.9,
    });
    expect(result.applied).toBe(false);
    if (!result.applied) {
      expect(result.reasonCode).toBe('RERANK_DUPLICATE_POOL_ID');
    }
    expectDeterministicFallback(result.candidates, eligible);
  });

  it('rejects incomplete permutations', () => {
    const eligible = [candidate('a', 0.8), candidate('b', 0.7)];
    const result = applyBoundedRerank(eligible, ['a', 'b'], {
      orderedProductIds: ['a'],
      confidence: 0.9,
    });
    expect(result.applied).toBe(false);
    if (!result.applied) {
      expect(result.reasonCode).toBe('RERANK_INCOMPLETE_PERMUTATION');
    }
  });

  it('rejects duplicate product ids', () => {
    const eligible = [candidate('a', 0.8), candidate('b', 0.7)];
    const result = applyBoundedRerank(eligible, ['a', 'b'], {
      orderedProductIds: ['a', 'a'],
      confidence: 0.9,
    });
    expect(result.applied).toBe(false);
    if (!result.applied) {
      expect(result.reasonCode).toBe('RERANK_DUPLICATE_PRODUCT_ID');
    }
  });

  it('rejects low confidence', () => {
    const eligible = [candidate('a', 0.8), candidate('b', 0.7)];
    const result = applyBoundedRerank(eligible, ['a', 'b'], {
      orderedProductIds: ['b', 'a'],
      confidence: 0.5,
    });
    expect(result.applied).toBe(false);
    if (!result.applied) {
      expect(result.reasonCode).toBe('RERANK_LOW_CONFIDENCE');
    }
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0.1,
    1.1,
  ])('rejects invalid confidence %s', (confidence) => {
    const eligible = [candidate('a', 0.8), candidate('b', 0.7)];
    const result = applyBoundedRerank(eligible, ['a', 'b'], {
      orderedProductIds: ['b', 'a'],
      confidence,
    });
    expect(result.applied).toBe(false);
    if (!result.applied) {
      expect(result.reasonCode).toBe('RERANK_INVALID_CONFIDENCE');
    }
  });

  it('preserves deterministicScore exactly on successful rerank', () => {
    const eligible = [candidate('a', 0.81), candidate('b', 0.79)];
    const bounded = applyBoundedRerank(eligible, ['a', 'b'], {
      orderedProductIds: ['b', 'a'],
      confidence: 0.95,
    });
    expect(bounded.applied).toBe(true);
    for (const original of eligible) {
      const updated = bounded.candidates.find((row) => row.productId === original.productId);
      expect(updated?.deterministicScore).toBe(original.deterministicScore);
    }
  });

  it('keeps selectionScore finite and within zero to one', () => {
    const eligible = Array.from({ length: 6 }, (_, index) =>
      candidate(`p${index}`, 0.99 - index * 0.01),
    );
    const bounded = applyBoundedRerank(
      eligible,
      eligible.map((row) => row.productId),
      {
        orderedProductIds: [...eligible].reverse().map((row) => row.productId),
        confidence: 1,
      },
    );
    expect(bounded.applied).toBe(true);
    for (const row of bounded.candidates) {
      const score = row.selectionScore ?? row.deterministicScore;
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('only accepts pool members that were already eligible', () => {
    const eligible = [candidate('eligible-a', 0.8), candidate('eligible-b', 0.7)];
    const poolIds = eligible.map((row) => row.productId);
    const result = applyBoundedRerank(eligible, poolIds, {
      orderedProductIds: poolIds,
      confidence: 0.9,
    });
    expect(result.applied).toBe(true);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((row) => poolIds.includes(row.productId))).toBe(true);
  });
});
