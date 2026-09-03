import type { ProductSemanticProfileAiV2, ServiceSemanticProfileAiV2 } from '../../contracts';
import type { RerankDecision } from '../../boundedRerank';
import type { CatalogueEntityInput } from '../../ai/prompts';
import type { CalibrationProvider, ProviderCallResult, ProviderUsageKnown } from './types';

export type MockProviderCall = {
  operation: 'classify_service' | 'classify_product' | 'rerank';
  entityId: string;
  modelId: string;
};

export type MockCalibrationProviderOptions = {
  modelId: string;
  serviceResponses?: Map<string, ProviderCallResult<ServiceSemanticProfileAiV2>>;
  productResponses?: Map<string, ProviderCallResult<ProductSemanticProfileAiV2>>;
  rerankResponses?: Map<string, ProviderCallResult<RerankDecision>>;
  defaultServiceResponse?: ProviderCallResult<ServiceSemanticProfileAiV2>;
  defaultProductResponse?: ProviderCallResult<ProductSemanticProfileAiV2>;
  defaultRerankResponse?: ProviderCallResult<RerankDecision>;
  onCall?: (call: MockProviderCall) => void;
};

export function createMockCalibrationProvider(
  options: MockCalibrationProviderOptions,
): CalibrationProvider & { calls: MockProviderCall[] } {
  const calls: MockProviderCall[] = [];

  const record = (operation: MockProviderCall['operation'], entityId: string) => {
    const call = { operation, entityId, modelId: options.modelId };
    calls.push(call);
    options.onCall?.(call);
  };

  return {
    modelId: options.modelId,
    calls,
    async classifyService(entity: CatalogueEntityInput) {
      record('classify_service', entity.id);
      const response =
        options.serviceResponses?.get(entity.id) ?? options.defaultServiceResponse;
      if (!response) {
        return { ok: false, error: 'MOCK_SERVICE_NOT_CONFIGURED' };
      }
      return response;
    },
    async classifyProduct(entity: CatalogueEntityInput) {
      record('classify_product', entity.id);
      const response =
        options.productResponses?.get(entity.id) ?? options.defaultProductResponse;
      if (!response) {
        return { ok: false, error: 'MOCK_PRODUCT_NOT_CONFIGURED' };
      }
      return response;
    },
    async rerank(serviceId, _serviceSummary, candidates) {
      record('rerank', serviceId);
      const response =
        options.rerankResponses?.get(serviceId) ?? options.defaultRerankResponse;
      if (!response) {
        return {
          ok: true,
          data: {
            orderedProductIds: candidates.map((candidate) => candidate.id),
            confidence: 0.85,
          },
          usage: mockUsage({ operation: 'rerank', fixtureId: serviceId }),
        };
      }
      return response;
    },
  };
}

export function mockUsage(overrides: Partial<ProviderUsageKnown> = {}): ProviderUsageKnown {
  return {
    usageKnown: true,
    operation: 'classify_service',
    modelId: 'gpt-4o-mini-2024-07-18',
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    ...overrides,
  };
}
