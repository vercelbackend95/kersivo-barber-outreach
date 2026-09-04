import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from '@/lib/recommendations/contracts';
import { SCHEMA_VERSION, TAXONOMY_VERSION } from '@/lib/recommendations/constants';

export const CRITICAL_FIELD_CONFIDENCE = { targetAreas: 0.85, retailNeeds: 0.85 };

export function serviceProfile(
  serviceId: string,
  draft: Omit<
    ServiceSemanticProfileV2,
    | 'schemaVersion'
    | 'taxonomyVersion'
    | 'entityType'
    | 'entityId'
    | 'shopId'
    | 'contentHash'
    | 'sourceSnapshot'
    | 'modelId'
    | 'promptVersion'
    | 'classifiedAt'
  >,
  snapshot: { name: string; description: string | null; category: string | null },
): ServiceSemanticProfileV2 {
  return {
    ...draft,
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId: serviceId,
    shopId: 'blackline-barbers-demo',
    contentHash: `demo-service-${serviceId}`,
    sourceSnapshot: snapshot,
    modelId: 'fixture',
    promptVersion: 'fixture',
    classifiedAt: new Date(0).toISOString(),
  };
}

export function productProfile(
  productId: string,
  draft: Omit<
    ProductSemanticProfileV2,
    | 'schemaVersion'
    | 'taxonomyVersion'
    | 'entityType'
    | 'entityId'
    | 'shopId'
    | 'contentHash'
    | 'sourceSnapshot'
    | 'modelId'
    | 'promptVersion'
    | 'classifiedAt'
  >,
  snapshot: { name: string; description: string | null; category: string },
): ProductSemanticProfileV2 {
  return {
    ...draft,
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'PRODUCT',
    entityId: productId,
    shopId: 'blackline-barbers-demo',
    contentHash: `demo-product-${productId}`,
    sourceSnapshot: snapshot,
    modelId: 'fixture',
    promptVersion: 'fixture',
    classifiedAt: new Date(0).toISOString(),
  };
}
