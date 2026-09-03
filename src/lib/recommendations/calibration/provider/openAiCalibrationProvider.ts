import type OpenAI from 'openai';

import {
  classifyProductEntity,
  classifyServiceEntity,
  rerankEligibleCandidates,
} from '../../ai/classify';
import type { OpenAiUsageTelemetry } from '../../ai/telemetry';
import type { TelemetrySink } from '../../ai/telemetry';
import type {
  CalibrationProvider,
  CreateCalibrationProviderParams,
  ProviderUsageCapture,
} from './types';

function telemetryToProviderUsage(event: OpenAiUsageTelemetry): ProviderUsageCapture {
  if (event.usageKnown) {
    return {
      usageKnown: true,
      operation: event.operation,
      modelId: event.modelId,
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      fixtureId: event.fixtureId,
    };
  }
  return {
    usageKnown: false,
    operation: event.operation,
    modelId: event.modelId,
    fixtureId: event.fixtureId,
  };
}

function createCallLocalTelemetry(
  onUsage?: (usage: ProviderUsageCapture) => void,
): { sink: TelemetrySink; getUsage: () => ProviderUsageCapture | undefined } {
  let captured: ProviderUsageCapture | undefined;

  const sink: TelemetrySink = (event) => {
    captured = telemetryToProviderUsage(event);
    onUsage?.(captured);
  };

  return { sink, getUsage: () => captured };
}

export function createOpenAiCalibrationProvider(
  params: CreateCalibrationProviderParams,
): CalibrationProvider {
  const { client, modelId, onUsage } = params;

  return {
    modelId,
    async classifyService(entity, options) {
      const { sink, getUsage } = createCallLocalTelemetry(onUsage);
      const result = await classifyServiceEntity(client, entity, {
        modelId,
        telemetry: { sink, operation: 'classify_service', fixtureId: options?.fixtureId ?? entity.id },
      });
      const usage = getUsage();
      if (!result.ok) return { ok: false, error: result.error, usage };
      return { ok: true, data: result.data, usage };
    },
    async classifyProduct(entity, options) {
      const { sink, getUsage } = createCallLocalTelemetry(onUsage);
      const result = await classifyProductEntity(client, entity, {
        modelId,
        telemetry: { sink, operation: 'classify_product', fixtureId: options?.fixtureId ?? entity.id },
      });
      const usage = getUsage();
      if (!result.ok) return { ok: false, error: result.error, usage };
      return { ok: true, data: result.data, usage };
    },
    async rerank(serviceId, serviceSummary, candidates, options) {
      const { sink, getUsage } = createCallLocalTelemetry(onUsage);
      const result = await rerankEligibleCandidates(client, serviceId, serviceSummary, candidates, {
        modelId,
        telemetry: { sink, operation: 'rerank', fixtureId: options?.fixtureId ?? serviceId },
      });
      const usage = getUsage();
      if (!result.ok) return { ok: false, error: result.error, usage };
      return { ok: true, data: result.data, usage };
    },
  };
}

export type { OpenAI };
