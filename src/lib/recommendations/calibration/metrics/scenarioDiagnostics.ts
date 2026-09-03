import { MAX_RECOMMENDATIONS } from '../../constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from '../../contracts';
import { retailNeedOverlap } from '../../retailNeeds';
import type { LiveRankingResolver } from '../ranking/buildLiveServiceRanking';
import type { CalibrationCatalogue, RecommendationGoldScenario, ScenarioDiagnostic } from '../types';
import { computePairAssertionMetrics } from './pairAssertionMetrics';
import { evaluateRecommendationScenario } from './recommendationMetrics';

const EMPTY_RAIL_PASS_MESSAGE = 'Correct empty rail — no compatible products selected';

function buildSelectedProductDiagnostics(
  selectedTop: ReturnType<typeof evaluateRecommendationScenario>['ranked'],
  service: ServiceSemanticProfileV2,
  productMap: Map<string, ProductSemanticProfileV2>,
  productNameById: Map<string, string>,
  serviceRanking: ReturnType<LiveRankingResolver>,
  relevantSet: Set<string>,
  mustIncludeSet: Set<string>,
  mustExcludeSet: Set<string>,
  criticalExcludeSet: Set<string>,
) {
  return selectedTop.map((candidate, index) => {
    const profile = productMap.get(candidate.productId);
    const rankDiag = serviceRanking?.candidateDiagnostics.find((d) => d.productId === candidate.productId);
    return {
      rank: index + 1,
      productId: candidate.productId,
      productName: productNameById.get(candidate.productId) ?? candidate.productId,
      deterministicScore: candidate.deterministicScore,
      selectionScore: candidate.selectionScore,
      deterministicPosition: rankDiag?.deterministicPosition,
      rerankPosition: rankDiag?.rerankPosition,
      finalPosition: rankDiag?.finalPosition ?? index + 1,
      rankDelta: rankDiag?.rankDelta,
      rerankApplied: rankDiag?.rerankApplied,
      rerankFallbackReason: rankDiag?.fallbackReason,
      matchedAreas: [...candidate.matchedAreas],
      overlapRetailNeeds: profile ? retailNeedOverlap(service.retailNeeds, profile.retailNeeds) : [],
      positiveReasonCodes: [...candidate.reasonCodes],
      productFamily: profile?.productFamily ?? 'UNKNOWN',
      inRelevantProductIds: relevantSet.has(candidate.productId),
      isMustInclude: mustIncludeSet.has(candidate.productId),
      violatesMustExclude: mustExcludeSet.has(candidate.productId),
      violatesCriticalMustExclude: criticalExcludeSet.has(candidate.productId),
    };
  });
}

export function buildScenarioDiagnostics(
  scenarios: RecommendationGoldScenario[],
  services: Map<string, ServiceSemanticProfileV2>,
  products: Array<{ id: string; profile: ProductSemanticProfileV2 }>,
  productMap: Map<string, ProductSemanticProfileV2>,
  catalogue: CalibrationCatalogue,
  rankingResolver?: LiveRankingResolver,
): ScenarioDiagnostic[] {
  const serviceNameById = new Map(catalogue.services.map((s) => [s.id, s.name]));
  const serviceDescriptionById = new Map(catalogue.services.map((s) => [s.id, s.description]));
  const productNameById = new Map(catalogue.products.map((p) => [p.id, p.name]));
  const pairMetrics = computePairAssertionMetrics(scenarios, services, productMap);
  const pairResultsByScenario = new Map<string, typeof pairMetrics.results>();

  for (const result of pairMetrics.results) {
    const list = pairResultsByScenario.get(result.scenarioId) ?? [];
    list.push(result);
    pairResultsByScenario.set(result.scenarioId, list);
  }

  const diagnostics: ScenarioDiagnostic[] = [];

  for (const scenario of scenarios) {
    const service = services.get(scenario.serviceId);
    if (!service) {
      diagnostics.push({
        scenarioId: scenario.id,
        serviceId: scenario.serviceId,
        serviceName: serviceNameById.get(scenario.serviceId) ?? scenario.serviceId,
        serviceDescription: serviceDescriptionById.get(scenario.serviceId) ?? null,
        selectedProducts: [],
        pairAssertionResults: [],
        precisionAt4: 0,
        pass: false,
        failureReasons: ['Service profile not found in scoped fixture pool'],
        expectEmpty: scenario.expectEmpty,
      });
      continue;
    }

    const evaluation = evaluateRecommendationScenario(
      scenario,
      service,
      products,
      productMap,
      rankingResolver,
    );
    const serviceRanking = rankingResolver?.(scenario.serviceId);
    const selectedTop = evaluation.ranked.slice(0, MAX_RECOMMENDATIONS);

    if (scenario.expectEmpty) {
      const unexpected = selectedTop.map((candidate) => ({
        rank: 0,
        productId: candidate.productId,
        productName: productNameById.get(candidate.productId) ?? candidate.productId,
        deterministicScore: candidate.deterministicScore,
        selectionScore: candidate.selectionScore,
        matchedAreas: [...candidate.matchedAreas],
        overlapRetailNeeds: [],
        positiveReasonCodes: [...candidate.reasonCodes],
        productFamily: productMap.get(candidate.productId)?.productFamily ?? 'UNKNOWN',
        inRelevantProductIds: false,
        isMustInclude: false,
        violatesMustExclude: false,
        violatesCriticalMustExclude: false,
      }));

      const failureReasons =
        unexpected.length === 0
          ? []
          : [
              `expected empty rail but selected: ${unexpected.map((p) => p.productName).join(', ')}`,
            ];

      diagnostics.push({
        scenarioId: scenario.id,
        serviceId: scenario.serviceId,
        serviceName: serviceNameById.get(scenario.serviceId) ?? scenario.serviceId,
        serviceDescription: serviceDescriptionById.get(scenario.serviceId) ?? null,
        selectedProducts: unexpected,
        pairAssertionResults: (pairResultsByScenario.get(scenario.id) ?? []).map((result) => ({
          scenarioId: result.scenarioId,
          productId: result.productId,
          productName: productNameById.get(result.productId) ?? result.productId,
          expected: result.expected,
          passed: result.passed,
          actualEligible: result.actualEligible,
          actualRejectionCode: result.actualRejectionCode,
        })),
        precisionAt4: 0,
        pass: unexpected.length === 0,
        failureReasons,
        expectEmpty: true,
        emptyRailMessage: unexpected.length === 0 ? EMPTY_RAIL_PASS_MESSAGE : undefined,
      });
      continue;
    }

    const relevantSet = new Set(scenario.relevantProductIds ?? []);
    const mustIncludeSet = new Set(scenario.mustInclude ?? []);
    const mustExcludeSet = new Set(scenario.mustExclude ?? []);
    const criticalExcludeSet = new Set(scenario.criticalMustExclude ?? []);

    const failureReasons: string[] = [];
    if (evaluation.mustExcludeViolations.length > 0) {
      failureReasons.push(`mustExclude violations: ${evaluation.mustExcludeViolations.join(', ')}`);
    }
    if (evaluation.criticalUnsafeViolations.length > 0) {
      failureReasons.push(`criticalMustExclude violations: ${evaluation.criticalUnsafeViolations.join(', ')}`);
    }
    if (evaluation.requiredFamilyViolations.length > 0) {
      failureReasons.push(`family violations: ${evaluation.requiredFamilyViolations.join(', ')}`);
    }
    if (evaluation.mustIncludeTotal > 0 && evaluation.mustIncludeHits < evaluation.mustIncludeTotal) {
      failureReasons.push(
        `mustInclude recall ${evaluation.mustIncludeHits}/${evaluation.mustIncludeTotal}`,
      );
    }
    if (!evaluation.comboCoverageOk) {
      failureReasons.push('combo hair+beard coverage not satisfied');
    }
    if (evaluation.precisionAt4Total > 0 && evaluation.precisionAt4Hits < evaluation.precisionAt4Total) {
      const irrelevant = selectedTop
        .filter((c) => !relevantSet.has(c.productId))
        .map((c) => productNameById.get(c.productId) ?? c.productId);
      failureReasons.push(`precision@4 irrelevant selections: ${irrelevant.join(', ')}`);
    }

    const pairAssertionResults = (pairResultsByScenario.get(scenario.id) ?? []).map((result) => ({
      scenarioId: result.scenarioId,
      productId: result.productId,
      productName: productNameById.get(result.productId) ?? result.productId,
      expected: result.expected,
      passed: result.passed,
      actualEligible: result.actualEligible,
      actualRejectionCode: result.actualRejectionCode,
    }));

    for (const result of pairAssertionResults) {
      if (!result.passed) {
        failureReasons.push(
          `pair assertion failed for ${result.productName}: expected ${result.expected}, code ${result.actualRejectionCode ?? 'ELIGIBLE'}`,
        );
      }
    }

    const selectedProducts = buildSelectedProductDiagnostics(
      selectedTop,
      service,
      productMap,
      productNameById,
      serviceRanking,
      relevantSet,
      mustIncludeSet,
      mustExcludeSet,
      criticalExcludeSet,
    );

    const precisionAt4 =
      evaluation.precisionAt4Total === 0 ? 0 : evaluation.precisionAt4Hits / evaluation.precisionAt4Total;

    diagnostics.push({
      scenarioId: scenario.id,
      serviceId: scenario.serviceId,
      serviceName: serviceNameById.get(scenario.serviceId) ?? scenario.serviceId,
      serviceDescription: serviceDescriptionById.get(scenario.serviceId) ?? null,
      selectedProducts,
      pairAssertionResults,
      precisionAt4,
      pass: failureReasons.length === 0,
      failureReasons,
    });
  }

  return diagnostics;
}
