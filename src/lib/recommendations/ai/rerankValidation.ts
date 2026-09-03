import type { RerankTransport } from './schemas';

export type RerankValidationResult =
  | { ok: true; orderedProductIds: string[] }
  | { ok: false; code: string };

export function validateRerankTransport(
  parsed: RerankTransport,
  requestedServiceId: string,
  candidateIds: string[],
): RerankValidationResult {
  if (parsed.schemaVersion !== '1') {
    return { ok: false, code: 'INVALID_RERANK_SCHEMA_VERSION' };
  }

  if (parsed.serviceId !== requestedServiceId) {
    return { ok: false, code: 'RERANK_SERVICE_ID_MISMATCH' };
  }

  const allowed = new Set(candidateIds);
  const ordered = parsed.orderedProductIds;

  if (ordered.length !== candidateIds.length) {
    return { ok: false, code: 'RERANK_INCOMPLETE_PERMUTATION' };
  }

  const seen = new Set<string>();
  for (const id of ordered) {
    if (!allowed.has(id)) {
      return { ok: false, code: 'RERANK_UNKNOWN_PRODUCT_ID' };
    }
    if (seen.has(id)) {
      return { ok: false, code: 'RERANK_DUPLICATE_PRODUCT_ID' };
    }
    seen.add(id);
  }

  if (seen.size !== candidateIds.length) {
    return { ok: false, code: 'RERANK_INCOMPLETE_PERMUTATION' };
  }

  return { ok: true, orderedProductIds: ordered };
}
