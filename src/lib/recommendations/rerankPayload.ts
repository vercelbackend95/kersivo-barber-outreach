import type { ProductSemanticProfileV2, ScoredCandidate, ServiceSemanticProfileV2 } from './contracts';

export function buildServiceRerankSummary(profile: ServiceSemanticProfileV2): Record<string, unknown> {
  return {
    targetAreas: profile.targetAreas,
    typicalHairLength: profile.typicalHairLength,
    techniques: profile.techniques,
    outcomes: profile.outcomes,
    aftercareNeeds: profile.aftercareNeeds,
    retailNeeds: profile.retailNeeds,
    incompatibilities: profile.incompatibilities,
  };
}

export function buildCandidateRerankSummary(
  candidate: ScoredCandidate,
  profile: ProductSemanticProfileV2,
): Record<string, unknown> {
  return {
    matchedAreas: candidate.matchedAreas,
    retailNeeds: profile.retailNeeds,
    productFamily: profile.productFamily,
    benefits: profile.benefits,
    holdStrength: profile.holdStrength,
    finish: profile.finish,
    hairLengthSuitability: profile.hairLengthSuitability,
    incompatibilities: profile.incompatibilities,
    deterministicScore: candidate.deterministicScore,
    scoreBreakdown: candidate.scoreBreakdown,
    reasonCodes: candidate.reasonCodes,
    confidenceGate: candidate.confidenceGate,
  };
}
