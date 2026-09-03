import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { AutoParseableResponseFormat } from 'openai/lib/parser';
import type { z } from 'zod';

import type { ProductSemanticProfileAiV2, ServiceSemanticProfileAiV2 } from '../contracts';
import type { RerankDecision } from '../boundedRerank';
import {
  buildCatalogueEntityUserPayload,
  buildProductClassifierSystemPrompt,
  buildRerankSystemPrompt,
  buildServiceClassifierSystemPrompt,
} from './prompts';
import {
  mapProductTransportToProfile,
  mapServiceTransportToProfile,
  PRODUCT_CLASSIFICATION_SCHEMA_NAME,
  productClassificationTransportSchema,
  RERANK_SCHEMA_NAME,
  rerankTransportSchema,
  SERVICE_CLASSIFICATION_SCHEMA_NAME,
  serviceClassificationTransportSchema,
  type ProductClassificationTransport,
  type RerankTransport,
  type ServiceClassificationTransport,
} from './schemas';
import { mapOpenAiSdkError } from './openAiErrorCodes';
import { validateRerankTransport } from './rerankValidation';
import { emitTelemetrySafe } from './safeTelemetry';
import type { TelemetryOptions } from './telemetry';
import { RECOMMENDATION_OPERATION_LIMITS } from './operationLimits';

const OPENAI_TIMEOUT_MS = 30_000;
const OPENAI_MAX_RETRIES = 2;

export function resolveRecommendationModel(): string {
  return (
    import.meta.env.OPENAI_RECOMMENDATION_MODEL ??
    process.env.OPENAI_RECOMMENDATION_MODEL ??
    import.meta.env.OPENAI_MODEL ??
    process.env.OPENAI_MODEL ??
    'gpt-4o-mini'
  );
}

export function createRecommendationOpenAiClient(): OpenAI | null {
  const apiKey = import.meta.env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
  });
}

export type ClassifyResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type ClassifyCallOptions = {
  telemetry?: TelemetryOptions;
  modelId?: string;
};

async function runStructuredParse<TParsed>(
  client: OpenAI,
  params: {
    system: string;
    user: string;
    responseFormat: AutoParseableResponseFormat<TParsed>;
    schema: z.ZodType<TParsed>;
    maxTokens: number;
    temperature: number;
    telemetry?: TelemetryOptions;
    modelId?: string;
  },
): Promise<ClassifyResult<TParsed>> {
  const startedAt = Date.now();
  const resolvedModel = params.modelId ?? resolveRecommendationModel();

  const emitKnown = (
    outcome: 'success' | 'fallback',
    usage: { prompt: number; completion: number; total: number },
    errorCode?: string,
  ) => {
    if (!params.telemetry) return;
    emitTelemetrySafe(params.telemetry.sink, {
      usageKnown: true,
      operation: params.telemetry.operation,
      modelId: resolvedModel,
      promptTokens: usage.prompt,
      completionTokens: usage.completion,
      totalTokens: usage.total,
      durationMs: Date.now() - startedAt,
      fixtureId: params.telemetry.fixtureId,
      outcome,
      errorCode,
    });
  };

  const emitUnknown = (outcome: 'success' | 'fallback', errorCode?: string) => {
    if (!params.telemetry) return;
    emitTelemetrySafe(params.telemetry.sink, {
      usageKnown: false,
      operation: params.telemetry.operation,
      modelId: resolvedModel,
      durationMs: Date.now() - startedAt,
      fixtureId: params.telemetry.fixtureId,
      outcome,
      errorCode,
    });
  };

  try {
    const response = await client.chat.completions.parse({
      model: resolvedModel,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      response_format: params.responseFormat,
    });

    const sdkUsage = response.usage;
    const hasUsage =
      sdkUsage != null &&
      sdkUsage.prompt_tokens != null &&
      sdkUsage.completion_tokens != null &&
      sdkUsage.total_tokens != null;

    const emitResponse = (outcome: 'success' | 'fallback', errorCode?: string) => {
      if (hasUsage) {
        emitKnown(
          outcome,
          {
            prompt: sdkUsage!.prompt_tokens!,
            completion: sdkUsage!.completion_tokens!,
            total: sdkUsage!.total_tokens!,
          },
          errorCode,
        );
      } else {
        emitUnknown(outcome, errorCode);
      }
    };

    const message = response.choices[0]?.message;
    if (message?.refusal) {
      emitResponse('fallback', 'MODEL_REFUSAL');
      return { ok: false, error: 'MODEL_REFUSAL' };
    }
    if (message?.parsed == null) {
      emitResponse('fallback', 'EMPTY_PARSED_RESPONSE');
      return { ok: false, error: 'EMPTY_PARSED_RESPONSE' };
    }

    const validated = params.schema.safeParse(message.parsed);
    if (!validated.success) {
      emitResponse('fallback', 'INVALID_STRUCTURED_RESPONSE');
      return { ok: false, error: 'INVALID_STRUCTURED_RESPONSE' };
    }

    emitResponse('success');
    return { ok: true, data: validated.data };
  } catch (error) {
    const errorCode = mapOpenAiSdkError(error);
    emitUnknown('fallback', errorCode);
    return { ok: false, error: errorCode };
  }
}

const serviceResponseFormat = zodResponseFormat(
  serviceClassificationTransportSchema,
  SERVICE_CLASSIFICATION_SCHEMA_NAME,
);

const productResponseFormat = zodResponseFormat(
  productClassificationTransportSchema,
  PRODUCT_CLASSIFICATION_SCHEMA_NAME,
);

const rerankResponseFormat = zodResponseFormat(rerankTransportSchema, RERANK_SCHEMA_NAME);

export async function classifyServiceEntity(
  client: OpenAI,
  entity: import('./prompts').CatalogueEntityInput,
  options?: ClassifyCallOptions,
): Promise<ClassifyResult<ServiceSemanticProfileAiV2>> {
  const parsed = await runStructuredParse<ServiceClassificationTransport>(client, {
    system: buildServiceClassifierSystemPrompt(),
    user: buildCatalogueEntityUserPayload(entity),
    responseFormat: serviceResponseFormat,
    schema: serviceClassificationTransportSchema,
    maxTokens: RECOMMENDATION_OPERATION_LIMITS.classifyService.maxOutputTokens,
    temperature: 0.2,
    modelId: options?.modelId,
    telemetry: options?.telemetry
      ? { ...options.telemetry, operation: 'classify_service', fixtureId: entity.id }
      : undefined,
  });

  if (!parsed.ok) return parsed;
  return { ok: true, data: mapServiceTransportToProfile(parsed.data) };
}

export async function classifyProductEntity(
  client: OpenAI,
  entity: import('./prompts').CatalogueEntityInput,
  options?: ClassifyCallOptions,
): Promise<ClassifyResult<ProductSemanticProfileAiV2>> {
  const parsed = await runStructuredParse<ProductClassificationTransport>(client, {
    system: buildProductClassifierSystemPrompt(),
    user: buildCatalogueEntityUserPayload(entity),
    responseFormat: productResponseFormat,
    schema: productClassificationTransportSchema,
    maxTokens: RECOMMENDATION_OPERATION_LIMITS.classifyProduct.maxOutputTokens,
    temperature: 0.2,
    modelId: options?.modelId,
    telemetry: options?.telemetry
      ? { ...options.telemetry, operation: 'classify_product', fixtureId: entity.id }
      : undefined,
  });

  if (!parsed.ok) return parsed;
  return { ok: true, data: mapProductTransportToProfile(parsed.data) };
}

export async function rerankEligibleCandidates(
  client: OpenAI,
  serviceId: string,
  serviceSummary: Record<string, unknown>,
  candidates: Array<{ id: string; summary: Record<string, unknown> }>,
  options?: ClassifyCallOptions,
): Promise<ClassifyResult<RerankDecision>> {
  const candidateIds = candidates.map((c) => c.id);
  const parsed = await runStructuredParse<RerankTransport>(client, {
    system: buildRerankSystemPrompt(),
    user: JSON.stringify({
      serviceId,
      service: serviceSummary,
      candidates: candidates.map((c) => ({ id: c.id, summary: c.summary })),
    }),
    responseFormat: rerankResponseFormat,
    schema: rerankTransportSchema,
    maxTokens: RECOMMENDATION_OPERATION_LIMITS.rerank.maxOutputTokens,
    temperature: 0.1,
    modelId: options?.modelId,
    telemetry: options?.telemetry
      ? { ...options.telemetry, operation: 'rerank', fixtureId: serviceId }
      : undefined,
  });

  if (!parsed.ok) return parsed;

  const validated = validateRerankTransport(parsed.data, serviceId, candidateIds);
  if (!validated.ok) {
    return { ok: false, error: validated.code };
  }

  return {
    ok: true,
    data: {
      orderedProductIds: validated.orderedProductIds,
      confidence: parsed.data.confidence,
    },
  };
}
