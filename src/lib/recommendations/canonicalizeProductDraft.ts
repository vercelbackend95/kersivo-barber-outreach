import {
  applyExplicitHairLengthToProductDraft,
  type CatalogueSourceText as HairSource,
} from './explicitHairLengthRestriction';
import {
  applyExplicitProductConstraintsToDraft,
  CATALOGUE_PRODUCT_CONSTRAINT_CONFLICT,
  type CatalogueSourceText,
} from './explicitProductConstraints';
import { mergeProductDualDomainEvidence } from './productDualDomainEvidence';
import type { ProductSemanticProfileAiV2, ServiceSemanticProfileAiV2 } from './contracts';
import { canonicalizeClosedEnumArray } from './canonicalizeClosedEnumArray';
import { canonicalizeRetailNeeds } from './retailNeeds';
import {
  assertProductSemanticConsistency,
  assertServiceSemanticConsistency,
} from './semanticConsistency';
import {
  AFTERCARE_NEEDS,
  INCOMPATIBILITY_TAGS,
  PRODUCT_BENEFITS,
  RETAIL_NEEDS,
  SERVICE_OUTCOMES,
  SERVICE_TECHNIQUES,
  TARGET_AREAS,
  type AftercareNeed,
  type IncompatibilityTag,
  type ProductBenefit,
  type RetailNeed,
  type ServiceOutcome,
  type ServiceTechnique,
  type TargetArea,
} from './taxonomy';

export { CATALOGUE_PRODUCT_CONSTRAINT_CONFLICT };

export type CanonicalizeProductDraftResult =
  | { ok: true; draft: ProductSemanticProfileAiV2 }
  | { ok: false; error: string };

/** Strip UNKNOWN mixed with known values on product multi-value enum fields. */
export function canonicalizeProductEnumArrays(
  draft: ProductSemanticProfileAiV2,
): ProductSemanticProfileAiV2 {
  return {
    ...draft,
    targetAreas: canonicalizeClosedEnumArray(
      TARGET_AREAS,
      draft.targetAreas,
      'UNKNOWN' as TargetArea,
    ),
    benefits: canonicalizeClosedEnumArray(
      PRODUCT_BENEFITS,
      draft.benefits,
      'UNKNOWN' as ProductBenefit,
    ),
    incompatibilities: canonicalizeClosedEnumArray(
      INCOMPATIBILITY_TAGS,
      draft.incompatibilities,
      'UNKNOWN' as IncompatibilityTag,
    ),
    retailNeeds: canonicalizeRetailNeeds(
      canonicalizeClosedEnumArray(RETAIL_NEEDS, draft.retailNeeds, 'UNKNOWN' as RetailNeed),
    ),
  };
}

/** Strip UNKNOWN mixed with known values on service multi-value enum fields. */
export function canonicalizeServiceEnumArrays(
  draft: ServiceSemanticProfileAiV2,
): ServiceSemanticProfileAiV2 {
  return assertServiceSemanticConsistency({
    ...draft,
    targetAreas: canonicalizeClosedEnumArray(
      TARGET_AREAS,
      draft.targetAreas,
      'UNKNOWN' as TargetArea,
    ),
    techniques: canonicalizeClosedEnumArray(
      SERVICE_TECHNIQUES,
      draft.techniques,
      'UNKNOWN' as ServiceTechnique,
    ),
    outcomes: canonicalizeClosedEnumArray(
      SERVICE_OUTCOMES,
      draft.outcomes,
      'UNKNOWN' as ServiceOutcome,
    ),
    aftercareNeeds: canonicalizeClosedEnumArray(
      AFTERCARE_NEEDS,
      draft.aftercareNeeds,
      'UNKNOWN' as AftercareNeed,
    ),
    incompatibilities: canonicalizeClosedEnumArray(
      INCOMPATIBILITY_TAGS,
      draft.incompatibilities,
      'UNKNOWN' as IncompatibilityTag,
    ),
    retailNeeds: canonicalizeRetailNeeds(
      canonicalizeClosedEnumArray(RETAIL_NEEDS, draft.retailNeeds, 'UNKNOWN' as RetailNeed),
    ),
  });
}

/**
 * Apply source-authoritative hair + material hard constraints + dual-domain evidence,
 * then semantic consistency. Used at classify, envelope, and cache boundaries.
 */
export function canonicalizeProductDraftFromSource(
  draft: ProductSemanticProfileAiV2,
  source: CatalogueSourceText & HairSource,
): CanonicalizeProductDraftResult {
  const normalized = canonicalizeProductEnumArrays(draft);
  const hair = applyExplicitHairLengthToProductDraft(normalized, source);
  if (!hair.ok) return hair;

  const constrained = applyExplicitProductConstraintsToDraft(hair.draft, source);
  if (!constrained.ok) return constrained;

  const withDual = mergeProductDualDomainEvidence(constrained.draft, source);
  try {
    return {
      ok: true,
      draft: assertProductSemanticConsistency(canonicalizeProductEnumArrays(withDual)),
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      return { ok: false, error: String((error as { code: string }).code) };
    }
    throw error;
  }
}
