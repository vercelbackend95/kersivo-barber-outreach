import { describe, expect, it, vi } from 'vitest';

import { compareDeterministicCandidates } from '../../candidateSelection';
import type { ScoredCandidate, ServiceSemanticProfileV2 } from '../../contracts';
import * as scorer from '../../scorer';
import { buildLiveServiceRanking } from './buildLiveServiceRanking';

function scoredCandidate(
  productId: string,
  deterministicScore: number,
  confidenceGate: number,
): ScoredCandidate {
  return {
    productId,
    deterministicScore,
    confidenceGate,
    productFamily: 'CLAY',
    matchedAreas: ['HAIR'],
    reasonCodes: ['TARGET_AREA_EXACT_MATCH'],
  };
}

const service: ServiceSemanticProfileV2 = {
  schemaVersion: '2',
  taxonomyVersion: '1',
  entityType: 'SERVICE',
  entityId: 'svc',
  shopId: 'shop',
  contentHash: 'hash',
  sourceSnapshot: { name: 'Test', description: null, category: 'cuts' },
  modelId: 'test',
  promptVersion: 'test',
  classifiedAt: new Date(0).toISOString(),
  targetAreas: ['HAIR'],
  typicalHairLength: 'SHORT',
  techniques: ['CLIPPER_CUT'],
  outcomes: ['SHAPE_STRUCTURE'],
  aftercareNeeds: ['DAILY_STYLING'],
  incompatibilities: [],
  retailNeeds: ['HAIR_STYLING_CONTROL'],
  confidence: 0.9,
  fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
  evidenceCodes: [],
  warnings: [],
};

describe('buildLiveServiceRanking diagnostics', () => {
  it('uses production eligible order for deterministicPosition when scores tie on confidence', () => {
    const lowConfidence = scoredCandidate('prod-low-confidence', 0.8, 0.5);
    const highConfidence = scoredCandidate('prod-high-confidence', 0.8, 0.9);
    const eligible = [lowConfidence, highConfidence].sort(compareDeterministicCandidates);

    vi.spyOn(scorer, 'scoreEligibleCandidatesForService').mockReturnValue(eligible);

    const ranking = buildLiveServiceRanking(service, []);

    const highDiag = ranking.candidateDiagnostics.find((d) => d.productId === 'prod-high-confidence');
    const lowDiag = ranking.candidateDiagnostics.find((d) => d.productId === 'prod-low-confidence');
    expect(highDiag?.deterministicPosition).toBe(1);
    expect(lowDiag?.deterministicPosition).toBe(2);
  });
});
