import type {
  ProductSemanticProfileV2,
  ServiceSemanticProfileV2,
} from './contracts';
import {
  canonicalizeProductDraftFromSource,
  canonicalizeServiceEnumArrays,
} from './canonicalizeProductDraft';
import type { CatalogueSourceText } from './explicitProductConstraints';
import { stripProductOnlyServiceIncompatibilities } from './serviceIncompatibilitySanitize';
import { mergeServiceSemanticEvidence, type ServiceCatalogueSource } from './serviceSemanticEvidence';
import {
  validateStoredProductProfileConsistency,
  validateStoredServiceProfileConsistency,
} from './semanticConsistency';

export type AuthoritativeProductSource = {
  name: string;
  description: string | null;
  category: string;
};

export type AuthoritativeServiceSource = {
  name: string;
  description: string | null;
  category: string | null;
};

/**
 * Re-canonicalize a reusable product profile using the *current* catalogue entity
 * as the only authoritative source text — never trusted `sourceSnapshot`.
 */
export function applyAuthoritativeSourceToReusedProduct(
  reused: ProductSemanticProfileV2,
  current: AuthoritativeProductSource,
): { ok: true; profile: ProductSemanticProfileV2 } | { ok: false; error: string } {
  const source: CatalogueSourceText = {
    name: current.name,
    description: current.description,
    category: current.category,
  };
  const canonical = canonicalizeProductDraftFromSource(reused, source);
  if (!canonical.ok) return { ok: false, error: canonical.error };

  const consistency = validateStoredProductProfileConsistency(canonical.draft);
  if (!consistency.ok) return { ok: false, error: consistency.code };

  return {
    ok: true,
    profile: {
      ...reused,
      ...canonical.draft,
      sourceSnapshot: {
        name: current.name,
        description: current.description?.trim() || null,
        category: current.category,
      },
    },
  };
}

/**
 * Re-apply service source evidence using the *current* catalogue entity fields.
 */
export function applyAuthoritativeSourceToReusedService(
  reused: ServiceSemanticProfileV2,
  current: AuthoritativeServiceSource,
): { ok: true; profile: ServiceSemanticProfileV2 } | { ok: false; error: string } {
  const source: ServiceCatalogueSource = {
    name: current.name,
    description: current.description,
    category: current.category,
  };
  const sanitized = canonicalizeServiceEnumArrays({
    ...reused,
    incompatibilities: stripProductOnlyServiceIncompatibilities(reused.incompatibilities),
  });
  const withEvidence = mergeServiceSemanticEvidence(sanitized, source);
  const consistency = validateStoredServiceProfileConsistency(withEvidence);
  if (!consistency.ok) return { ok: false, error: consistency.code };

  return {
    ok: true,
    profile: {
      ...reused,
      ...withEvidence,
      sourceSnapshot: {
        name: current.name,
        description: current.description?.trim() || null,
        category: current.category?.trim() || null,
      },
    },
  };
}
