import type { ProductSemanticProfileAiV2, ServiceSemanticProfileAiV2 } from '../../contracts';
import type { RerankDecision } from '../../boundedRerank';
import type { CatalogueEntityInput } from '../../ai/prompts';

export type ProviderOperation = 'classify_service' | 'classify_product' | 'rerank';

export type ProviderUsageKnown = {
  usageKnown: true;
  operation: ProviderOperation;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  fixtureId?: string;
};

export type ProviderUsageUnknown = {
  usageKnown: false;
  operation: ProviderOperation;
  modelId: string;
  fixtureId?: string;
};

export type ProviderUsageCapture = ProviderUsageKnown | ProviderUsageUnknown;

/** @deprecated Use ProviderUsageCapture */
export type ProviderUsage = ProviderUsageKnown;

export type ProviderCallResult<T> =
  | { ok: true; data: T; usage?: ProviderUsageCapture }
  | { ok: false; error: string; usage?: ProviderUsageCapture };

export type CalibrationProvider = {
  readonly modelId: string;
  classifyService(
    entity: CatalogueEntityInput,
    options?: { fixtureId?: string },
  ): Promise<ProviderCallResult<ServiceSemanticProfileAiV2>>;
  classifyProduct(
    entity: CatalogueEntityInput,
    options?: { fixtureId?: string },
  ): Promise<ProviderCallResult<ProductSemanticProfileAiV2>>;
  rerank(
    serviceId: string,
    serviceSummary: Record<string, unknown>,
    candidates: Array<{ id: string; summary: Record<string, unknown> }>,
    options?: { fixtureId?: string },
  ): Promise<ProviderCallResult<RerankDecision>>;
};

export type CreateCalibrationProviderParams = {
  client: import('openai').default;
  modelId: string;
  onUsage?: (usage: ProviderUsageCapture) => void;
};
