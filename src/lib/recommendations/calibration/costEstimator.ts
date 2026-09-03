import { RECOMMENDATION_OPERATION_LIMITS } from '../ai/operationLimits';
import type { CalibrationCallPlan, CalibrationCatalogue, CalibrationScope } from './types';
import { getModelPricing } from './pricing/modelPricing';
import { getSmokeCallCounts } from './scope/smokeManifest';

/** Conservative token assumptions per operation — output uses actual configured max_output_tokens. */
export const TOKEN_ASSUMPTIONS = {
  classifyService: {
    input: RECOMMENDATION_OPERATION_LIMITS.classifyService.conservativeInputTokens,
    output: RECOMMENDATION_OPERATION_LIMITS.classifyService.maxOutputTokens,
  },
  classifyProduct: {
    input: RECOMMENDATION_OPERATION_LIMITS.classifyProduct.conservativeInputTokens,
    output: RECOMMENDATION_OPERATION_LIMITS.classifyProduct.maxOutputTokens,
  },
  rerank: {
    input: RECOMMENDATION_OPERATION_LIMITS.rerank.conservativeInputTokens,
    output: RECOMMENDATION_OPERATION_LIMITS.rerank.maxOutputTokens,
  },
} as const;

export function countRerankEligibleServices(catalogue: CalibrationCatalogue): number {
  const skipIds = new Set(['cal-svc-no-desc', 'cal-svc-the-works']);
  return catalogue.services.filter((s) => !skipIds.has(s.id)).length;
}

export function buildCalibrationCallPlan(
  catalogue: CalibrationCatalogue,
  modelId: string,
  scope: CalibrationScope = 'full',
): CalibrationCallPlan {
  const pricing = getModelPricing(modelId);
  if (!pricing) {
    throw new Error(`No pricing for model: ${modelId}`);
  }

  const counts =
    scope === 'smoke'
      ? getSmokeCallCounts()
      : {
          serviceClassifications: catalogue.services.length,
          productClassifications: catalogue.products.length,
          rerankAttempts: countRerankEligibleServices(catalogue),
          totalMaxCalls: 0,
        };

  const serviceClassifications = counts.serviceClassifications;
  const productClassifications = counts.productClassifications;
  const rerankAttempts = counts.rerankAttempts;

  const estimatedInputTokens =
    serviceClassifications * TOKEN_ASSUMPTIONS.classifyService.input +
    productClassifications * TOKEN_ASSUMPTIONS.classifyProduct.input +
    rerankAttempts * TOKEN_ASSUMPTIONS.rerank.input;

  const estimatedOutputTokens =
    serviceClassifications * TOKEN_ASSUMPTIONS.classifyService.output +
    productClassifications * TOKEN_ASSUMPTIONS.classifyProduct.output +
    rerankAttempts * TOKEN_ASSUMPTIONS.rerank.output;

  const estimatedMaxCostUsd =
    (estimatedInputTokens / 1_000_000) * pricing.inputPer1M +
    (estimatedOutputTokens / 1_000_000) * pricing.outputPer1M;

  return {
    scope,
    serviceClassifications,
    productClassifications,
    rerankAttempts,
    totalMaxCalls: serviceClassifications + productClassifications + rerankAttempts,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedMaxCostUsd,
  };
}

export function estimateCostFromTokens(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getModelPricing(modelId);
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}

export function estimateOperationCostUsd(
  modelId: string,
  operation: keyof typeof TOKEN_ASSUMPTIONS,
): number {
  const tokens = TOKEN_ASSUMPTIONS[operation];
  return estimateCostFromTokens(modelId, tokens.input, tokens.output);
}
