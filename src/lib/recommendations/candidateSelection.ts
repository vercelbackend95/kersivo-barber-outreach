import type { ScoredCandidate, ServiceSemanticProfileV2 } from './contracts';
import { COMBO_DUAL_PRESELECT_MAX_SCORE_GAP } from './constants';
import { isHairAndBeardComboService } from './hardEligibility';

export function effectiveSelectionScore(candidate: ScoredCandidate): number {
  return candidate.selectionScore ?? candidate.deterministicScore;
}

export function compareDeterministicCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.deterministicScore !== a.deterministicScore) {
    return b.deterministicScore - a.deterministicScore;
  }
  if (b.confidenceGate !== a.confidenceGate) {
    return b.confidenceGate - a.confidenceGate;
  }
  return a.productId.localeCompare(b.productId);
}

export function compareSelectionCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  const aScore = effectiveSelectionScore(a);
  const bScore = effectiveSelectionScore(b);
  if (bScore !== aScore) {
    return bScore - aScore;
  }
  if (b.deterministicScore !== a.deterministicScore) {
    return b.deterministicScore - a.deterministicScore;
  }
  if (b.confidenceGate !== a.confidenceGate) {
    return b.confidenceGate - a.confidenceGate;
  }
  return a.productId.localeCompare(b.productId);
}

export function sortDeterministicCandidates<T extends ScoredCandidate>(candidates: T[]): T[] {
  return [...candidates].sort(compareDeterministicCandidates);
}

export function sortSelectionCandidates<T extends ScoredCandidate>(candidates: T[]): T[] {
  return [...candidates].sort(compareSelectionCandidates);
}

function isHairDomain(matchedAreas: readonly string[]): boolean {
  return matchedAreas.some((area) => area === 'HAIR' || area === 'SCALP');
}

function isBeardDomain(matchedAreas: readonly string[]): boolean {
  return matchedAreas.some((area) => area === 'BEARD' || area === 'MOUSTACHE');
}

function hasDualDomainCoverage(matchedAreas: readonly string[]): boolean {
  return isHairDomain(matchedAreas) && isBeardDomain(matchedAreas);
}

function familyKey(candidate: ScoredCandidate): string {
  return candidate.productFamily || 'UNKNOWN';
}

function canAddToSelection(
  candidate: ScoredCandidate,
  selected: ScoredCandidate[],
  maxPerFamily: number,
): boolean {
  const family = familyKey(candidate);
  const currentCount = selected.filter((row) => familyKey(row) === family).length;
  return currentCount < maxPerFamily;
}

function greedyFill(
  ordered: ScoredCandidate[],
  selected: ScoredCandidate[],
  maxItems: number,
  maxPerFamily: number,
): ScoredCandidate[] {
  const result = [...selected];
  const selectedIds = new Set(result.map((candidate) => candidate.productId));

  for (const candidate of ordered) {
    if (result.length >= maxItems) break;
    if (selectedIds.has(candidate.productId)) continue;
    if (!canAddToSelection(candidate, result, maxPerFamily)) continue;
    result.push(candidate);
    selectedIds.add(candidate.productId);
  }

  return result;
}

/**
 * Dual is preselected when it fills a missing domain, or when competitive with
 * the weaker specialist (within COMBO_DUAL_PRESELECT_MAX_SCORE_GAP).
 */
export function shouldPreselectDualDomain(args: {
  dual: ScoredCandidate;
  bestHairSpecialist?: ScoredCandidate;
  bestBeardSpecialist?: ScoredCandidate;
}): boolean {
  const { dual, bestHairSpecialist, bestBeardSpecialist } = args;
  const fillsMissingHair = !bestHairSpecialist;
  const fillsMissingBeard = !bestBeardSpecialist;
  if (fillsMissingHair || fillsMissingBeard) return true;

  const specialistScores = [bestHairSpecialist, bestBeardSpecialist]
    .filter((c): c is ScoredCandidate => c != null)
    .map((c) => effectiveSelectionScore(c));
  if (specialistScores.length === 0) return true;

  const weakerSpecialist = Math.min(...specialistScores);
  return (
    effectiveSelectionScore(dual) + COMBO_DUAL_PRESELECT_MAX_SCORE_GAP >= weakerSpecialist
  );
}

export function selectDiverseCandidates(
  candidates: ScoredCandidate[],
  maxItems: number,
  maxPerFamily: number,
  service?: ServiceSemanticProfileV2,
): ScoredCandidate[] {
  const ordered = sortSelectionCandidates(candidates);

  if (maxItems < 2 || !service || !isHairAndBeardComboService(service)) {
    return greedyFill(ordered, [], maxItems, maxPerFamily).slice(0, maxItems);
  }

  const bestHairSpecialist = ordered.find(
    (candidate) => isHairDomain(candidate.matchedAreas) && !isBeardDomain(candidate.matchedAreas),
  );
  const bestBeardSpecialist = ordered.find(
    (candidate) => isBeardDomain(candidate.matchedAreas) && !isHairDomain(candidate.matchedAreas),
  );
  const dualDomain = ordered.find((candidate) => hasDualDomainCoverage(candidate.matchedAreas));

  const preselected: ScoredCandidate[] = [];
  const preselectedIds = new Set<string>();

  const tryPreselect = (candidate: ScoredCandidate | undefined) => {
    if (!candidate || preselectedIds.has(candidate.productId)) return;
    if (!canAddToSelection(candidate, preselected, maxPerFamily)) return;
    preselected.push(candidate);
    preselectedIds.add(candidate.productId);
  };

  if (
    dualDomain &&
    shouldPreselectDualDomain({
      dual: dualDomain,
      bestHairSpecialist,
      bestBeardSpecialist,
    })
  ) {
    tryPreselect(dualDomain);
  }

  const coveredHair = preselected.some((c) => isHairDomain(c.matchedAreas));
  const coveredBeard = preselected.some((c) => isBeardDomain(c.matchedAreas));
  if (!coveredHair) tryPreselect(bestHairSpecialist);
  if (!coveredBeard) tryPreselect(bestBeardSpecialist);

  const filled = greedyFill(ordered, preselected, maxItems, maxPerFamily);
  return sortSelectionCandidates(filled).slice(0, maxItems);
}
