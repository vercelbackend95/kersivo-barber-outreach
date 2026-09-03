import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from '../../contracts';
import { evaluateServiceProductPair, type PairRejectionCode } from '../../pairEvaluation';
import type { PairAssertionExpectation, RecommendationGoldScenario } from '../types';

export type PairAssertionResult = {
  scenarioId: string;
  productId: string;
  expected: 'ELIGIBLE' | 'REJECTED';
  passed: boolean;
  actualEligible: boolean;
  actualRejectionCode?: PairRejectionCode;
};

export type PairAssertionMetrics = {
  passed: number;
  total: number;
  passRate: number;
  results: PairAssertionResult[];
  rejectionReasonCounts: Record<string, number>;
  failedKeys: string[];
};

export function evaluatePairAssertion(
  scenarioId: string,
  assertion: PairAssertionExpectation,
  service: ServiceSemanticProfileV2,
  product: ProductSemanticProfileV2,
): PairAssertionResult {
  const evaluation = evaluateServiceProductPair({
    service,
    product,
    productId: assertion.productId,
  });

  const actualEligible = evaluation.eligible;
  const actualRejectionCode = evaluation.eligible ? undefined : evaluation.reasonCode;

  let passed = assertion.expected === 'ELIGIBLE' ? actualEligible : !actualEligible;
  if (!passed && assertion.expected === 'REJECTED' && actualRejectionCode && assertion.allowedRejectionCodes) {
    passed = assertion.allowedRejectionCodes.includes(actualRejectionCode);
  }

  return {
    scenarioId,
    productId: assertion.productId,
    expected: assertion.expected,
    passed,
    actualEligible,
    actualRejectionCode,
  };
}

export function computePairAssertionMetrics(
  scenarios: RecommendationGoldScenario[],
  services: Map<string, ServiceSemanticProfileV2>,
  products: Map<string, ProductSemanticProfileV2>,
): PairAssertionMetrics {
  const results: PairAssertionResult[] = [];
  const rejectionReasonCounts: Record<string, number> = {};
  const failedKeys: string[] = [];

  for (const scenario of scenarios) {
    const service = services.get(scenario.serviceId);
    if (!service) continue;
    for (const assertion of scenario.pairAssertions ?? []) {
      const product = products.get(assertion.productId);
      if (!product) {
        failedKeys.push(`${scenario.id}:${assertion.productId}`);
        continue;
      }
      const result = evaluatePairAssertion(scenario.id, assertion, service, product);
      results.push(result);
      if (!result.actualEligible && result.actualRejectionCode) {
        rejectionReasonCounts[result.actualRejectionCode] =
          (rejectionReasonCounts[result.actualRejectionCode] ?? 0) + 1;
      }
      if (!result.passed) {
        failedKeys.push(`${scenario.id}:${assertion.productId}`);
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  return {
    passed,
    total,
    passRate: total === 0 ? 1 : passed / total,
    results,
    rejectionReasonCounts,
    failedKeys,
  };
}
