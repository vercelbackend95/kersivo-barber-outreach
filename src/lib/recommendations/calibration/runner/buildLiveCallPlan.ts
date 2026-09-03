import { buildCalibrationCallPlan } from '../costEstimator';
import type { CalibrationCallPlan, CalibrationCatalogue } from '../types';
import {
  CALIBRATION_SMOKE_EXECUTION_MANIFEST,
  getSmokeCallCounts,
  SMOKE_MAX_PROVIDER_REQUESTS,
} from '../scope/smokeManifest';

export type LiveCallOperation =
  | { kind: 'classify_service'; entityId: string }
  | { kind: 'classify_product'; entityId: string }
  | { kind: 'rerank'; serviceId: string };

export type LiveCallPlan = CalibrationCallPlan & {
  operations: LiveCallOperation[];
};

export function buildLiveSmokeCallPlan(
  catalogue: CalibrationCatalogue,
  modelId: string,
): LiveCallPlan {
  const counts = getSmokeCallCounts();
  if (counts.totalMaxCalls !== SMOKE_MAX_PROVIDER_REQUESTS) {
    throw new Error(
      `Smoke manifest must require exactly ${SMOKE_MAX_PROVIDER_REQUESTS} calls, got ${counts.totalMaxCalls}`,
    );
  }

  const basePlan = buildCalibrationCallPlan(catalogue, modelId, 'smoke');
  const operations: LiveCallOperation[] = [
    ...CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyServiceIds.map(
      (entityId) => ({ kind: 'classify_service' as const, entityId }),
    ),
    ...CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyProductIds.map(
      (entityId) => ({ kind: 'classify_product' as const, entityId }),
    ),
    ...CALIBRATION_SMOKE_EXECUTION_MANIFEST.rerankServiceIds.map(
      (serviceId) => ({ kind: 'rerank' as const, serviceId }),
    ),
  ];

  return {
    ...basePlan,
    operations,
  };
}
