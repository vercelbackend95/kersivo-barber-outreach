import { MAX_PER_PRODUCT_FAMILY, MAX_RECOMMENDATIONS } from '../../constants';
import type { ProductSemanticProfileV2, ScoredCandidate, ServiceSemanticProfileV2 } from '../../contracts';
import type { ProductFamily } from '../../taxonomy';
import { selectDiverseCandidates } from '../../candidateSelection';
import { buildRankedRecommendationsForService } from '../../scorer';
import type { LiveRankingFactory, LiveRankingResolver } from '../ranking/buildLiveServiceRanking';
import type { HarnessFixtureMetrics, RecommendationGoldScenario, RecommendationMetrics } from '../types';
import { computePairAssertionMetrics } from './pairAssertionMetrics';

function isHairDomain(areas: readonly string[]): boolean {
  return areas.some((area) => area === 'HAIR' || area === 'SCALP');
}

function isBeardDomain(areas: readonly string[]): boolean {
  return areas.some((area) => area === 'BEARD' || area === 'MOUSTACHE');
}

export type ScenarioEvaluation = {
  scenarioId: string;
  selectedIds: string[];
  ranked: ScoredCandidate[];
  mustIncludeHits: number;
  mustIncludeTotal: number;
  mustExcludeViolations: string[];
  criticalUnsafeViolations: string[];
  familyCapViolations: number;
  requiredFamilyViolations: ProductFamily[];
  comboCoverageOk: boolean;
  precisionAt4Hits: number;
  precisionAt4Total: number;
};

export function evaluateRecommendationScenario(
  scenario: RecommendationGoldScenario,
  service: ServiceSemanticProfileV2,
  products: Array<{ id: string; profile: ProductSemanticProfileV2 }>,
  productMap: Map<string, ProductSemanticProfileV2>,
  rankingResolver?: LiveRankingResolver,
): ScenarioEvaluation {
  const ranking = rankingResolver?.(scenario.serviceId);
  const ranked = ranking?.finalRanked ?? buildRankedRecommendationsForService(service, products);
  const selectedIds = ranked.map((c) => c.productId);
  const selectedTop = ranked.slice(0, MAX_RECOMMENDATIONS);

  if (scenario.expectEmpty) {
    return {
      scenarioId: scenario.id,
      selectedIds,
      ranked,
      mustIncludeHits: 0,
      mustIncludeTotal: 0,
      mustExcludeViolations: [],
      criticalUnsafeViolations: [],
      familyCapViolations: 0,
      requiredFamilyViolations: [],
      comboCoverageOk: selectedIds.length === 0,
      precisionAt4Hits: 0,
      precisionAt4Total: 0,
    };
  }

  const mustInclude = scenario.mustInclude ?? [];
  const mustExclude = scenario.mustExclude ?? [];
  const criticalMustExclude = scenario.criticalMustExclude ?? [];
  const relevantSet = new Set(scenario.relevantProductIds ?? []);

  const mustIncludeHits = mustInclude.filter((id) => selectedIds.includes(id)).length;
  const mustExcludeViolations = mustExclude.filter((id) => selectedIds.includes(id));
  const criticalUnsafeViolations = criticalMustExclude.filter((id) => selectedIds.includes(id));

  let comboCoverageOk = true;
  if (scenario.requireHairAndBeardCoverage) {
    const hasHair = selectedTop.some((candidate) => isHairDomain(candidate.matchedAreas));
    const hasBeard = selectedTop.some((candidate) => isBeardDomain(candidate.matchedAreas));
    comboCoverageOk = hasHair && hasBeard;
  }

  const familyCounts = new Map<string, number>();
  let familyCapViolations = 0;
  for (const candidate of ranked) {
    const profile = productMap.get(candidate.productId);
    if (!profile) continue;
    const count = (familyCounts.get(profile.productFamily) ?? 0) + 1;
    familyCounts.set(profile.productFamily, count);
    if (count > MAX_PER_PRODUCT_FAMILY) familyCapViolations += 1;
  }

  const requiredFamilies = scenario.requiredFamilies ?? [];
  const selectedFamilies = new Set<ProductFamily>(
    selectedTop
      .map((candidate) => productMap.get(candidate.productId)?.productFamily)
      .filter((family): family is ProductFamily => family != null),
  );
  const requiredFamilyViolations: ProductFamily[] = requiredFamilies.filter(
    (family) => !selectedFamilies.has(family),
  );

  if (scenario.allowedFamilies) {
    const allowed = new Set(scenario.allowedFamilies);
    for (const family of selectedFamilies) {
      if (!allowed.has(family)) {
        requiredFamilyViolations.push(family);
      }
    }
  }

  const precisionAt4Total = selectedTop.length;
  const precisionAt4Hits = selectedTop.filter((candidate) => relevantSet.has(candidate.productId)).length;

  return {
    scenarioId: scenario.id,
    selectedIds,
    ranked,
    mustIncludeHits,
    mustIncludeTotal: mustInclude.length,
    mustExcludeViolations,
    criticalUnsafeViolations,
    familyCapViolations,
    requiredFamilyViolations,
    comboCoverageOk,
    precisionAt4Hits,
    precisionAt4Total,
  };
}

export function compareRankedCandidates(a: ScoredCandidate[], b: ScoredCandidate[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((candidate, index) => {
    const other = b[index];
    if (!other) return false;
    if (candidate.productId !== other.productId) return false;
    if (candidate.deterministicScore !== other.deterministicScore) return false;
    if (candidate.selectionScore !== other.selectionScore) return false;
    const areasA = [...candidate.matchedAreas].sort().join(',');
    const areasB = [...other.matchedAreas].sort().join(',');
    if (areasA !== areasB) return false;
    const codesA = [...candidate.reasonCodes].sort().join(',');
    const codesB = [...other.reasonCodes].sort().join(',');
    return codesA === codesB;
  });
}

export function computeLiveDeterministicRepeatability(
  scenarios: RecommendationGoldScenario[],
  services: Map<string, ServiceSemanticProfileV2>,
  rankingFactory: LiveRankingFactory,
): number {
  let checked = 0;
  let passed = 0;

  for (const scenario of scenarios) {
    const service = services.get(scenario.serviceId);
    if (!service) continue;

    checked += 1;
    const first = rankingFactory(scenario.serviceId).finalRanked;
    const second = rankingFactory(scenario.serviceId).finalRanked;

    if (compareRankedCandidates(first, second)) passed += 1;
  }

  if (checked === 0) return 1;
  return passed / checked;
}

export function computeRecommendationMetrics(
  scenarios: RecommendationGoldScenario[],
  services: Map<string, ServiceSemanticProfileV2>,
  products: Array<{ id: string; profile: ProductSemanticProfileV2 }>,
  productMap: Map<string, ProductSemanticProfileV2>,
  rerankStats?: { attempted: number; fallback: number; fallbackReasons: Record<string, number> },
  options?: {
    rankingResolver?: LiveRankingResolver;
    rankingFactory?: LiveRankingFactory;
    liveEvaluation?: boolean;
  },
): RecommendationMetrics {
  let precisionHits = 0;
  let precisionTotal = 0;
  let mustIncludeHits = 0;
  let mustIncludeTotal = 0;
  let mustExcludeChecks = 0;
  let mustExcludePasses = 0;
  let criticalUnsafe = 0;
  let familyCapViolations = 0;
  let comboChecks = 0;
  let comboPasses = 0;
  let expectedEmptyScenarioCount = 0;
  let expectedEmptyScenariosPassed = 0;
  const unexpectedEmptyScenarioSelections: Array<{ scenarioId: string; productIds: string[] }> = [];
  const mismatchedScenarioIds: string[] = [];

  for (const scenario of scenarios) {
    const service = services.get(scenario.serviceId);
    if (!service) {
      mismatchedScenarioIds.push(scenario.id);
      continue;
    }

    const evaluation = evaluateRecommendationScenario(
      scenario,
      service,
      products,
      productMap,
      options?.rankingResolver,
    );

    if (scenario.expectEmpty) {
      expectedEmptyScenarioCount += 1;
      if (evaluation.selectedIds.length === 0) {
        expectedEmptyScenariosPassed += 1;
      } else {
        mismatchedScenarioIds.push(scenario.id);
        unexpectedEmptyScenarioSelections.push({
          scenarioId: scenario.id,
          productIds: [...evaluation.selectedIds],
        });
      }
      continue;
    }

    precisionHits += evaluation.precisionAt4Hits;
    precisionTotal += evaluation.precisionAt4Total;
    mustIncludeHits += evaluation.mustIncludeHits;
    mustIncludeTotal += evaluation.mustIncludeTotal;

    const excludeList = scenario.mustExclude ?? [];
    mustExcludeChecks += excludeList.length;
    mustExcludePasses += excludeList.length - evaluation.mustExcludeViolations.length;

    criticalUnsafe += evaluation.criticalUnsafeViolations.length;
    familyCapViolations += evaluation.familyCapViolations;

    if (scenario.requireHairAndBeardCoverage) {
      comboChecks += 1;
      if (evaluation.comboCoverageOk) comboPasses += 1;
    }

    const precisionFailed =
      evaluation.precisionAt4Total > 0 &&
      evaluation.precisionAt4Hits / evaluation.precisionAt4Total < 1;

    const scenarioFailed =
      evaluation.mustExcludeViolations.length > 0 ||
      evaluation.criticalUnsafeViolations.length > 0 ||
      evaluation.requiredFamilyViolations.length > 0 ||
      (evaluation.mustIncludeTotal > 0 && evaluation.mustIncludeHits < evaluation.mustIncludeTotal) ||
      !evaluation.comboCoverageOk ||
      precisionFailed;

    if (scenarioFailed) {
      mismatchedScenarioIds.push(scenario.id);
    }
  }

  const pairMetrics = computePairAssertionMetrics(scenarios, services, productMap);

  const deterministicRepeatability =
    options?.liveEvaluation && options.rankingFactory
      ? computeLiveDeterministicRepeatability(scenarios, services, options.rankingFactory)
      : null;

  return {
    precisionAt4: precisionTotal === 0 ? null : precisionHits / precisionTotal,
    mustIncludeRecall: mustIncludeTotal === 0 ? null : mustIncludeHits / mustIncludeTotal,
    mustExcludePassRate: mustExcludeChecks === 0 ? null : mustExcludePasses / mustExcludeChecks,
    criticalUnsafeFalsePositiveCount: criticalUnsafe,
    familyCapViolations,
    comboDomainCoverageRate: comboChecks === 0 ? null : comboPasses / comboChecks,
    deterministicRepeatability,
    rerankFallbackRate:
      rerankStats && rerankStats.attempted > 0 ? rerankStats.fallback / rerankStats.attempted : null,
    classificationErrorCounts: {},
    rerankFallbackReasonCounts: rerankStats?.fallbackReasons ?? {},
    mismatchedScenarioIds,
    pairAssertionPassRate: pairMetrics.total === 0 ? null : pairMetrics.passRate,
    pairAssertionFailures: pairMetrics.total - pairMetrics.passed,
    expectedEmptyScenarioCount,
    expectedEmptyScenariosPassed,
    expectedEmptyPassRate:
      expectedEmptyScenarioCount === 0 ? null : expectedEmptyScenariosPassed / expectedEmptyScenarioCount,
    unexpectedEmptyScenarioSelections,
  };
}

export function buildHarnessFixtureMetrics(
  recommendation: RecommendationMetrics,
  pairPassRate: number,
  deterministicRepeatability: number,
): HarnessFixtureMetrics {
  return {
    precisionAt4: recommendation.precisionAt4 ?? 0,
    mustIncludeRecall: recommendation.mustIncludeRecall ?? 0,
    mustExcludePassRate: recommendation.mustExcludePassRate ?? 0,
    criticalUnsafeFalsePositiveCount: recommendation.criticalUnsafeFalsePositiveCount,
    comboDomainCoverageRate: recommendation.comboDomainCoverageRate,
    familyCapViolations: recommendation.familyCapViolations,
    pairAssertionPassRate: pairPassRate,
    deterministicRepeatability,
  };
}

export function verifyDeterministicRepeatability(
  service: ServiceSemanticProfileV2,
  products: Array<{ id: string; profile: ProductSemanticProfileV2 }>,
): boolean {
  const first = buildRankedRecommendationsForService(service, products).map((c) => c.productId);
  const second = buildRankedRecommendationsForService(service, products).map((c) => c.productId);
  return first.join(',') === second.join(',');
}

export function verifyDiverseSelectionRepeatability(
  eligible: ScoredCandidate[],
  service: ServiceSemanticProfileV2,
): boolean {
  const first = selectDiverseCandidates(eligible, MAX_RECOMMENDATIONS, MAX_PER_PRODUCT_FAMILY, service).map(
    (c) => c.productId,
  );
  const second = selectDiverseCandidates(eligible, MAX_RECOMMENDATIONS, MAX_PER_PRODUCT_FAMILY, service).map(
    (c) => c.productId,
  );
  return first.join(',') === second.join(',');
}
