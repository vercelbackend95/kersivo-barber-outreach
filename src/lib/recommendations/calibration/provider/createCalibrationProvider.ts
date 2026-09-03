import type OpenAI from 'openai';

import { createOpenAiCalibrationProvider } from './openAiCalibrationProvider';
import type { CalibrationProvider, ProviderUsageCapture } from './types';

export function createCalibrationProvider(params: {
  client: OpenAI;
  modelId: string;
  onUsage?: (usage: ProviderUsageCapture) => void;
}): CalibrationProvider {
  return createOpenAiCalibrationProvider(params);
}
