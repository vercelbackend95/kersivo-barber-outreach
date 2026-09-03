import type { ScoredCandidate, ServiceSemanticProfileV2 } from './contracts';
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

  const bestHair = ordered.find((candidate) => isHairDomain(candidate.matchedAreas));
  const bestBeard = ordered.find((candidate) => isBeardDomain(candidate.matchedAreas));

  const preselected: ScoredCandidate[] = [];
  const preselectedIds = new Set<string>();

  const tryPreselect = (candidate: ScoredCandidate | undefined) => {
    if (!candidate || preselectedIds.has(candidate.productId)) return;
    if (!canAddToSelection(candidate, preselected, maxPerFamily)) return;
    preselected.push(candidate);
    preselectedIds.add(candidate.productId);
  };

  const dualDomain = ordered.find((candidate) => hasDualDomainCoverage(candidate.matchedAreas));

  if (bestHair && bestBeard && bestHair.productId !== bestBeard.productId) {
    tryPreselect(bestHair);
    tryPreselect(bestBeard);
  } else if (dualDomain) {
    tryPreselect(dualDomain);
  } else {
    tryPreselect(bestHair);
    tryPreselect(bestBeard);
  }

  const filled = greedyFill(ordered, preselected, maxItems, maxPerFamily);
  return sortSelectionCandidates(filled).slice(0, maxItems);
}
