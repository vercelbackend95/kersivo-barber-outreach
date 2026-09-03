import { describe, expect, it } from 'vitest';

import type { ScoredCandidate } from './contracts';
import { selectDiverseCandidates, sortDeterministicCandidates } from './candidateSelection';
import { TAXONOMY_VERSION } from './constants';
import type { ServiceSemanticProfileV2 } from './contracts';

function candidate(
  productId: string,
  score: number,
  family: string,
  matchedAreas: string[],
  confidenceGate = 0.9,
): ScoredCandidate {
  return {
    productId,
    deterministicScore: score,
    confidenceGate,
    reasonCodes: [],
    productFamily: family,
    matchedAreas: matchedAreas as ScoredCandidate['matchedAreas'],
  };
}

function comboService(): ServiceSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId: 'combo',
    shopId: 'shop',
    contentHash: 'hash',
    sourceSnapshot: { name: 'Combo', description: null, category: null },
    modelId: 'test',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR', 'BEARD'],
    typicalHairLength: 'SHORT',
    techniques: ['SKIN_FADE', 'BEARD_TRIM'],
    outcomes: ['SHAPE_STRUCTURE'],
    aftercareNeeds: ['DAILY_STYLING'],
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
    confidence: 0.9,
    fieldConfidence: { targetAreas: 0.85, retailNeeds: 0.85 },
    evidenceCodes: [],
    warnings: [],
  };
}

describe('candidateSelection', () => {
  it('sorts by score desc, confidence desc, productId asc', () => {
    const sorted = sortDeterministicCandidates([
      candidate('b', 0.8, 'CLAY', ['HAIR'], 0.7),
      candidate('a', 0.8, 'CLAY', ['HAIR'], 0.9),
      candidate('c', 0.9, 'POMADE', ['HAIR']),
    ]);
    expect(sorted.map((row) => row.productId)).toEqual(['c', 'a', 'b']);
  });

  it('caps family diversity and total items', () => {
    const selected = selectDiverseCandidates(
      [
        candidate('p1', 0.9, 'CLAY', ['HAIR']),
        candidate('p2', 0.88, 'CLAY', ['HAIR']),
        candidate('p3', 0.87, 'CLAY', ['HAIR']),
        candidate('p4', 0.86, 'POMADE', ['HAIR']),
        candidate('p5', 0.85, 'POMADE', ['HAIR']),
      ],
      4,
      2,
    );
    expect(selected).toHaveLength(4);
    expect(selected.filter((row) => row.productFamily === 'CLAY')).toHaveLength(2);
  });

  it('ensures hair and beard coverage for combo services', () => {
    const selected = selectDiverseCandidates(
      [
        candidate('hair-1', 0.95, 'CLAY', ['HAIR']),
        candidate('hair-2', 0.94, 'POMADE', ['HAIR']),
        candidate('beard-1', 0.7, 'OIL', ['BEARD']),
        candidate('beard-2', 0.69, 'BALM', ['BEARD']),
      ],
      3,
      2,
      comboService(),
    );

    const ids = selected.map((row) => row.productId);
    expect(ids.some((id) => id.startsWith('hair'))).toBe(true);
    expect(ids.some((id) => id.startsWith('beard'))).toBe(true);
  });

  it('respects family cap when preselecting hair and beard domains', () => {
    const selected = selectDiverseCandidates(
      [
        candidate('hair-a', 0.95, 'CLAY', ['HAIR']),
        candidate('hair-b', 0.94, 'CLAY', ['HAIR']),
        candidate('beard-a', 0.7, 'CLAY', ['BEARD']),
      ],
      3,
      2,
      comboService(),
    );

    expect(selected.filter((row) => row.productFamily === 'CLAY')).toHaveLength(2);
    expect(selected.some((row) => row.productId === 'beard-a')).toBe(true);
  });

  it('does not count raw multi-domain product as beard coverage when pair matched only hair', () => {
    const selected = selectDiverseCandidates(
      [
        candidate('hair-only-match', 0.95, 'CLAY', ['HAIR']),
        candidate('raw-dual-but-hair-only', 0.94, 'POMADE', ['HAIR']),
        candidate('beard-only', 0.7, 'OIL', ['BEARD']),
      ],
      2,
      2,
      comboService(),
    );

    const selectedIds = selected.map((row) => row.productId);
    expect(selectedIds).toContain('hair-only-match');
    expect(selectedIds).toContain('beard-only');
    expect(selectedIds).not.toContain('raw-dual-but-hair-only');
  });

  it('allows true pair-specific dual-domain candidate to satisfy both domains', () => {
    const selected = selectDiverseCandidates(
      [
        candidate('dual', 0.8, 'BALM', ['HAIR', 'BEARD']),
        candidate('hair-only', 0.95, 'CLAY', ['HAIR']),
      ],
      2,
      2,
      comboService(),
    );

    expect(selected.map((row) => row.productId)).toContain('dual');
    expect(selected.map((row) => row.productId)).toContain('hair-only');
  });

  it('is invariant to shuffled input order', () => {
    const pool = [
      candidate('hair-1', 0.95, 'CLAY', ['HAIR']),
      candidate('beard-1', 0.7, 'OIL', ['BEARD']),
      candidate('hair-2', 0.85, 'POMADE', ['HAIR']),
    ];

    const ordered = selectDiverseCandidates(pool, 3, 2, comboService());
    const shuffled = selectDiverseCandidates(
      [pool[2]!, pool[0]!, pool[1]!],
      3,
      2,
      comboService(),
    );

    expect(ordered.map((row) => row.productId)).toEqual(shuffled.map((row) => row.productId));
  });

  it('returns best deterministic set when domain coverage is impossible', () => {
    const selected = selectDiverseCandidates(
      [candidate('hair-1', 0.95, 'CLAY', ['HAIR']), candidate('hair-2', 0.9, 'POMADE', ['HAIR'])],
      2,
      2,
      comboService(),
    );

    expect(selected.map((row) => row.productId)).toEqual(['hair-1', 'hair-2']);
  });

  it('skips combo preselection when maxItems is less than 2', () => {
    const selected = selectDiverseCandidates(
      [candidate('hair-1', 0.95, 'CLAY', ['HAIR']), candidate('beard-1', 0.9, 'OIL', ['BEARD'])],
      1,
      2,
      comboService(),
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.productId).toBe('hair-1');
  });
});
