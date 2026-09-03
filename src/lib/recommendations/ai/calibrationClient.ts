import OpenAI from 'openai';

const OPENAI_TIMEOUT_MS = 30_000;

export function createCalibrationOpenAiClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: 0,
  });
}

export const CALIBRATION_OPENAI_TIMEOUT_MS = OPENAI_TIMEOUT_MS;
