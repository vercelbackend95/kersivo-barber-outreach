import { describe, expect, it, vi } from 'vitest';
import OpenAI from 'openai';

import { createCalibrationOpenAiClient } from './calibrationClient';

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation((config) => ({ config })),
  };
});

describe('createCalibrationOpenAiClient', () => {
  it('creates client with maxRetries 0 and explicit api key', () => {
    const client = createCalibrationOpenAiClient('fake-test-key-not-real') as unknown as {
      config: Record<string, unknown>;
    };
    expect(OpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'fake-test-key-not-real',
        maxRetries: 0,
      }),
    );
    expect(client.config.maxRetries).toBe(0);
  });
});
