export const CALIBRATION_MODEL_ALLOWLIST = ['gpt-4o-mini-2024-07-18'] as const;

export type CalibrationModelId = (typeof CALIBRATION_MODEL_ALLOWLIST)[number];

export type ModelPricing = {
  inputPer1M: number;
  outputPer1M: number;
  effectiveDate: string;
  sourceUrl: string;
};

export const MODEL_PRICING: Record<CalibrationModelId, ModelPricing> = {
  'gpt-4o-mini-2024-07-18': {
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    effectiveDate: '2024-07-18',
    sourceUrl: 'https://openai.com/api/pricing/',
  },
};

export function isAllowedCalibrationModel(modelId: string): modelId is CalibrationModelId {
  return (CALIBRATION_MODEL_ALLOWLIST as readonly string[]).includes(modelId);
}

export function getModelPricing(modelId: string): ModelPricing | null {
  if (!isAllowedCalibrationModel(modelId)) return null;
  return MODEL_PRICING[modelId];
}
