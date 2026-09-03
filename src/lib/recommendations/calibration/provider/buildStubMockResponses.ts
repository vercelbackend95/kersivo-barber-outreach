import type {
  ProductSemanticProfileAiV2,
  ProductSemanticProfileV2,
  ServiceSemanticProfileAiV2,
  ServiceSemanticProfileV2,
} from '../../contracts';
import { CALIBRATION_SMOKE_EXECUTION_MANIFEST } from '../scope/smokeManifest';
import { buildCalibrationStubProfiles } from '../dataset/stubProfiles';
import type { ProviderCallResult, ProviderUsageKnown } from './types';
import { CALIBRATION_MODEL_SNAPSHOT } from '../liveGuards';

function stripServiceEnvelope(profile: ServiceSemanticProfileV2): ServiceSemanticProfileAiV2 {
  const {
    schemaVersion: _sv,
    taxonomyVersion: _tv,
    entityType: _et,
    entityId: _ei,
    shopId: _si,
    contentHash: _ch,
    sourceSnapshot: _ss,
    modelId: _mi,
    promptVersion: _pv,
    classifiedAt: _ca,
    ...ai
  } = profile;
  return ai;
}

function stripProductEnvelope(profile: ProductSemanticProfileV2): ProductSemanticProfileAiV2 {
  const {
    schemaVersion: _sv,
    taxonomyVersion: _tv,
    entityType: _et,
    entityId: _ei,
    shopId: _si,
    contentHash: _ch,
    sourceSnapshot: _ss,
    modelId: _mi,
    promptVersion: _pv,
    classifiedAt: _ca,
    ...ai
  } = profile;
  return ai;
}

export function mockUsageKnown(
  overrides: Partial<ProviderUsageKnown> & Pick<ProviderUsageKnown, 'operation'>,
): ProviderUsageKnown {
  return {
    usageKnown: true,
    modelId: CALIBRATION_MODEL_SNAPSHOT,
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    ...overrides,
  };
}

export type StubMockResponses = {
  serviceResponses: Map<string, ProviderCallResult<ServiceSemanticProfileAiV2>>;
  productResponses: Map<string, ProviderCallResult<ProductSemanticProfileAiV2>>;
};

export function buildStubMockResponses(): StubMockResponses {
  const stubs = buildCalibrationStubProfiles();
  const serviceResponses = new Map<string, ProviderCallResult<ServiceSemanticProfileAiV2>>();
  const productResponses = new Map<string, ProviderCallResult<ProductSemanticProfileAiV2>>();

  for (const id of CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyServiceIds) {
    const profile = stubs.services.get(id);
    if (!profile) throw new Error(`Missing stub service: ${id}`);
    serviceResponses.set(id, {
      ok: true,
      data: stripServiceEnvelope(profile),
      usage: mockUsageKnown({ operation: 'classify_service', fixtureId: id }),
    });
  }

  for (const id of CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyProductIds) {
    const profile = stubs.products.get(id);
    if (!profile) throw new Error(`Missing stub product: ${id}`);
    productResponses.set(id, {
      ok: true,
      data: stripProductEnvelope(profile),
      usage: mockUsageKnown({ operation: 'classify_product', fixtureId: id }),
    });
  }

  return { serviceResponses, productResponses };
}
