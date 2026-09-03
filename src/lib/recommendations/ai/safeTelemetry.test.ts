import { describe, expect, it } from 'vitest';

import type { TelemetrySink } from './telemetry';
import { emitTelemetrySafe } from './safeTelemetry';

describe('emitTelemetrySafe', () => {
  const baseEvent = {
    usageKnown: true as const,
    operation: 'classify_service' as const,
    modelId: 'gpt-4o-mini-2024-07-18',
    promptTokens: 1,
    completionTokens: 1,
    totalTokens: 2,
    durationMs: 1,
    outcome: 'success' as const,
  };

  it('swallows throwing sink on success without rethrowing', () => {
    const sink: TelemetrySink = () => {
      throw new Error('sink exploded');
    };
    expect(() => emitTelemetrySafe(sink, baseEvent)).not.toThrow();
  });

  it('no-ops when sink is undefined', () => {
    expect(() => emitTelemetrySafe(undefined, baseEvent)).not.toThrow();
  });
});
