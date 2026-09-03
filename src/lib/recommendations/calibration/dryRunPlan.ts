import type { CalibrationCallPlan, CalibrationCatalogue, CalibrationScope } from './types';
import { buildCalibrationCallPlan } from './costEstimator';

export type DryRunPlanResult = {
  plan: CalibrationCallPlan;
  withinBudget: boolean;
  openAiClientConstructed: false;
};

export function buildDryRunPlan(
  catalogue: CalibrationCatalogue,
  modelId: string,
  maxCostUsd?: number,
  scope: CalibrationScope = 'full',
): DryRunPlanResult {
  const plan = buildCalibrationCallPlan(catalogue, modelId, scope);
  const withinBudget = maxCostUsd == null || plan.estimatedMaxCostUsd <= maxCostUsd;
  return {
    plan,
    withinBudget,
    openAiClientConstructed: false,
  };
}
