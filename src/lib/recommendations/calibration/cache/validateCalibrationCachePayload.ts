import { z } from 'zod';

import {
  productSemanticProfileAiV2Schema,
  serviceSemanticProfileAiV2Schema,
} from '../../contracts';
import type { RerankDecision } from '../../boundedRerank';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from '../../contracts';
import { canonicalizeProductDraftFromSource, canonicalizeServiceEnumArrays } from '../../canonicalizeProductDraft';
import { stripProductOnlyServiceIncompatibilities } from '../../serviceIncompatibilitySanitize';
import {
  validateStoredProductProfileConsistency,
  validateStoredServiceProfileConsistency,
} from '../../semanticConsistency';
import type { CalibrationCacheKey } from './calibrationCache';

const envelopeMetadataSchema = z.object({
  schemaVersion: z.literal('2'),
  taxonomyVersion: z.string().min(1),
  entityId: z.string().min(1),
  shopId: z.string().min(1),
  contentHash: z.string().min(1),
  modelId: z.string().min(1),
  promptVersion: z.string().min(1),
  classifiedAt: z.string().min(1),
});

const rerankDecisionSchema = z.object({
  orderedProductIds: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
});

export type InvalidCacheDiagnostic = {
  entityId: string;
  operation: CalibrationCacheKey['operation'];
  reason: string;
};

function validateMetadata(
  payload: unknown,
  key: CalibrationCacheKey,
  entityType: 'SERVICE' | 'PRODUCT',
): { ok: true } | { ok: false; reason: string } {
  const parsed = envelopeMetadataSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: 'CACHE_METADATA_INVALID' };
  const meta = parsed.data;
  if ((payload as { entityType?: string }).entityType !== entityType) {
    return { ok: false, reason: 'CACHE_ENTITY_TYPE_MISMATCH' };
  }
  if (meta.entityId !== key.entityId) return { ok: false, reason: 'CACHE_ENTITY_ID_MISMATCH' };
  if (meta.contentHash !== key.contentHash) return { ok: false, reason: 'CACHE_CONTENT_HASH_MISMATCH' };
  if (meta.modelId !== key.modelId) return { ok: false, reason: 'CACHE_MODEL_ID_MISMATCH' };
  if (meta.promptVersion !== key.promptVersion) return { ok: false, reason: 'CACHE_PROMPT_VERSION_MISMATCH' };
  if (meta.taxonomyVersion !== key.taxonomyVersion) {
    return { ok: false, reason: 'CACHE_TAXONOMY_VERSION_MISMATCH' };
  }
  if (meta.schemaVersion !== key.schemaVersion) return { ok: false, reason: 'CACHE_SCHEMA_VERSION_MISMATCH' };
  return { ok: true };
}

function pickServiceAi(payload: Record<string, unknown>) {
  const {
    schemaVersion: _a,
    taxonomyVersion: _b,
    entityType: _c,
    entityId: _d,
    shopId: _e,
    contentHash: _f,
    sourceSnapshot: _g,
    modelId: _h,
    promptVersion: _i,
    classifiedAt: _j,
    ...ai
  } = payload;
  return ai;
}

function pickProductAi(payload: Record<string, unknown>) {
  const {
    schemaVersion: _a,
    taxonomyVersion: _b,
    entityType: _c,
    entityId: _d,
    shopId: _e,
    contentHash: _f,
    sourceSnapshot: _g,
    modelId: _h,
    promptVersion: _i,
    classifiedAt: _j,
    ...ai
  } = payload;
  return ai;
}

export function validateCachedServiceProfile(
  payload: unknown,
  key: CalibrationCacheKey,
): { ok: true; profile: ServiceSemanticProfileV2 } | { ok: false; reason: string } {
  const meta = validateMetadata(payload, key, 'SERVICE');
  if (!meta.ok) return meta;
  const ai = serviceSemanticProfileAiV2Schema.safeParse(pickServiceAi(payload as Record<string, unknown>));
  if (!ai.success) return { ok: false, reason: 'CACHE_SERVICE_SHAPE_INVALID' };
  const sanitized = canonicalizeServiceEnumArrays({
    ...ai.data,
    incompatibilities: stripProductOnlyServiceIncompatibilities(ai.data.incompatibilities),
  });
  const consistency = validateStoredServiceProfileConsistency(sanitized);
  if (!consistency.ok) {
    return { ok: false, reason: `CACHE_SERVICE_SEMANTIC_INCONSISTENT:${consistency.code}` };
  }
  return {
    ok: true,
    profile: { ...(payload as ServiceSemanticProfileV2), ...sanitized },
  };
}

export function validateCachedProductProfile(
  payload: unknown,
  key: CalibrationCacheKey,
): { ok: true; profile: ProductSemanticProfileV2 } | { ok: false; reason: string } {
  const meta = validateMetadata(payload, key, 'PRODUCT');
  if (!meta.ok) return meta;
  const record = payload as ProductSemanticProfileV2;
  const ai = productSemanticProfileAiV2Schema.safeParse(pickProductAi(payload as Record<string, unknown>));
  if (!ai.success) return { ok: false, reason: 'CACHE_PRODUCT_SHAPE_INVALID' };
  const source = record.sourceSnapshot ?? { name: '', description: null, category: '' };
  const canonical = canonicalizeProductDraftFromSource(ai.data, {
    name: source.name,
    description: source.description,
    category: source.category,
  });
  if (!canonical.ok) {
    return { ok: false, reason: `CACHE_PRODUCT_SOURCE_CONSTRAINT:${canonical.error}` };
  }
  const consistency = validateStoredProductProfileConsistency(canonical.draft);
  if (!consistency.ok) {
    return { ok: false, reason: `CACHE_PRODUCT_SEMANTIC_INCONSISTENT:${consistency.code}` };
  }
  return {
    ok: true,
    profile: { ...record, ...canonical.draft },
  };
}

export function validateCachedRerankDecision(
  payload: unknown,
  rerankPoolIds: readonly string[],
): { ok: true; decision: RerankDecision } | { ok: false; reason: string } {
  const parsed = rerankDecisionSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: 'CACHE_RERANK_SHAPE_INVALID' };
  const { orderedProductIds, confidence } = parsed.data;
  if (orderedProductIds.length !== rerankPoolIds.length) {
    return { ok: false, reason: 'CACHE_RERANK_PERMUTATION_INVALID' };
  }
  const poolSet = new Set(rerankPoolIds);
  const seen = new Set<string>();
  for (const id of orderedProductIds) {
    if (!poolSet.has(id)) return { ok: false, reason: 'CACHE_RERANK_PERMUTATION_INVALID' };
    if (seen.has(id)) return { ok: false, reason: 'CACHE_RERANK_PERMUTATION_INVALID' };
    seen.add(id);
  }
  return { ok: true, decision: { orderedProductIds, confidence } };
}
