import { CRITICAL_FIELD_CONFIDENCE_MIN, PROFILE_CONFIDENCE_MIN } from './constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';
import type { PairRejectionCode } from './pairEvaluation';

const CRITICAL_SERVICE_FIELDS = ['targetAreas', 'retailNeeds'] as const;
const CRITICAL_PRODUCT_FIELDS = ['targetAreas', 'retailNeeds'] as const;

export function isValidUnitConfidence(value: unknown, min: number): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value < 0 || value > 1) return false;
  return value >= min;
}

function checkCriticalFields(
  fieldConfidence: Record<string, number> | undefined,
  fields: readonly string[],
  rejectionCode: PairRejectionCode,
): PairRejectionCode | null {
  for (const field of fields) {
    const value = fieldConfidence?.[field];
    if (!isValidUnitConfidence(value, CRITICAL_FIELD_CONFIDENCE_MIN)) {
      return rejectionCode;
    }
  }
  return null;
}

export function checkServiceConfidenceGates(
  service: ServiceSemanticProfileV2,
): PairRejectionCode | null {
  if (!isValidUnitConfidence(service.confidence, PROFILE_CONFIDENCE_MIN)) {
    return 'SERVICE_PROFILE_LOW_CONFIDENCE';
  }
  return checkCriticalFields(
    service.fieldConfidence,
    CRITICAL_SERVICE_FIELDS,
    'SERVICE_CRITICAL_FIELD_LOW_CONFIDENCE',
  );
}

export function checkProductConfidenceGates(
  product: ProductSemanticProfileV2,
): PairRejectionCode | null {
  if (!isValidUnitConfidence(product.confidence, PROFILE_CONFIDENCE_MIN)) {
    return 'PRODUCT_PROFILE_LOW_CONFIDENCE';
  }
  return checkCriticalFields(
    product.fieldConfidence,
    CRITICAL_PRODUCT_FIELDS,
    'PRODUCT_CRITICAL_FIELD_LOW_CONFIDENCE',
  );
}
