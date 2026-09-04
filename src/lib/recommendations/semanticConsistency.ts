import type {
  ProductSemanticProfileAiV2,
  ServiceSemanticProfileAiV2,
} from './contracts';
import type { IncompatibilityTag, TargetArea } from './taxonomy';
import { INCOMPATIBILITY_TAGS } from './taxonomy';
import { canonicalizeClosedEnumArray } from './canonicalizeClosedEnumArray';

export const SEMANTIC_CONTRADICTION_CODES = [
  'PRODUCT_SHORT_WITH_LONG_ONLY',
  'PRODUCT_LONG_WITH_SHORT_ONLY',
  'PRODUCT_CONFLICTING_HAIR_LENGTH_EXCLUSIVITY',
  'PRODUCT_ANY_WITH_HAIR_LENGTH_EXCLUSIVITY',
  'PRODUCT_NOT_APPLICABLE_WITH_HAIR_LENGTH_EXCLUSIVITY',
  'PRODUCT_UNKNOWN_WITH_HAIR_LENGTH_EXCLUSIVITY',
  'PRODUCT_EXCLUSIVITY_SUITABILITY_MISMATCH',
  'NON_HAIR_PRODUCT_WITH_HAIR_LENGTH_CONSTRAINT',
  'INCOMPATIBILITY_HAIR_ONLY_AND_BEARD_ONLY',
  'INCOMPATIBILITY_BEARD_ONLY_AND_NOT_FOR_BEARD',
  'INCOMPATIBILITY_POST_SHAVE_ONLY_AND_NOT_FOR_SHAVE',
  'INCOMPATIBILITY_LEAVE_IN_ONLY_AND_RINSE_OUT_ONLY',
  'INCOMPATIBILITY_UNKNOWN_MIXED_WITH_KNOWN',
  'PRODUCT_NOT_FOR_BEARD_WITH_BEARD_SEMANTICS',
  'PRODUCT_NOT_FOR_SHAVE_WITH_SHAVE_SEMANTICS',
  'PRODUCT_HAIR_ONLY_WITHOUT_HAIR_SEMANTICS',
  'PRODUCT_BEARD_ONLY_WITHOUT_BEARD_SEMANTICS',
] as const;

export type SemanticContradictionCode = (typeof SEMANTIC_CONTRADICTION_CODES)[number];

export type SemanticConsistencyResult =
  | { ok: true; canonicalized: true | false }
  | { ok: false; code: SemanticContradictionCode };

const HAIR_LENGTH_EXCLUSIVITY: IncompatibilityTag[] = ['FOR_SHORT_HAIR_ONLY', 'FOR_LONG_HAIR_ONLY'];

function hasHairDomain(areas: readonly TargetArea[]): boolean {
  return areas.some((area) => area === 'HAIR');
}

function validateMutualExclusivityTags(
  tags: readonly IncompatibilityTag[],
): SemanticContradictionCode | null {
  if (tags.includes('FOR_SHORT_HAIR_ONLY') && tags.includes('FOR_LONG_HAIR_ONLY')) {
    return 'PRODUCT_CONFLICTING_HAIR_LENGTH_EXCLUSIVITY';
  }
  if (tags.includes('HAIR_ONLY') && tags.includes('BEARD_ONLY')) {
    return 'INCOMPATIBILITY_HAIR_ONLY_AND_BEARD_ONLY';
  }
  if (tags.includes('BEARD_ONLY') && tags.includes('NOT_FOR_BEARD')) {
    return 'INCOMPATIBILITY_BEARD_ONLY_AND_NOT_FOR_BEARD';
  }
  if (tags.includes('POST_SHAVE_ONLY') && tags.includes('NOT_FOR_SHAVE')) {
    return 'INCOMPATIBILITY_POST_SHAVE_ONLY_AND_NOT_FOR_SHAVE';
  }
  if (tags.includes('LEAVE_IN_ONLY') && tags.includes('RINSE_OUT_ONLY')) {
    return 'INCOMPATIBILITY_LEAVE_IN_ONLY_AND_RINSE_OUT_ONLY';
  }
  return null;
}

/**
 * Benign canonicalize: when UNKNOWN coexists with known incompatibility tags,
 * strip UNKNOWN. Explicit and tested — not a silent material-side pick.
 */
export function canonicalizeIncompatibilities(
  tags: readonly IncompatibilityTag[],
): { tags: IncompatibilityTag[]; removedUnknownMixedWithKnown: boolean } {
  const before = [...new Set(tags)];
  const tagsOut = canonicalizeClosedEnumArray(INCOMPATIBILITY_TAGS, before, 'UNKNOWN');
  const removedUnknownMixedWithKnown =
    before.includes('UNKNOWN') && tagsOut.some((tag) => tag !== 'UNKNOWN');
  return { tags: tagsOut, removedUnknownMixedWithKnown };
}

export function validateProductSemanticConsistency(
  profile: Pick<
    ProductSemanticProfileAiV2,
    'targetAreas' | 'hairLengthSuitability' | 'incompatibilities'
  > &
    Partial<Pick<ProductSemanticProfileAiV2, 'retailNeeds'>>,
): SemanticConsistencyResult {
  const { tags, removedUnknownMixedWithKnown } = canonicalizeIncompatibilities(
    profile.incompatibilities,
  );
  const suitability = profile.hairLengthSuitability;
  const hasLongOnly = tags.includes('FOR_LONG_HAIR_ONLY');
  const hasShortOnly = tags.includes('FOR_SHORT_HAIR_ONLY');
  const areas = profile.targetAreas;
  const needs = profile.retailNeeds ?? [];

  const mutual = validateMutualExclusivityTags(tags);
  if (mutual) {
    return { ok: false, code: mutual };
  }

  if (suitability === 'SHORT' && hasLongOnly) {
    return { ok: false, code: 'PRODUCT_SHORT_WITH_LONG_ONLY' };
  }
  if (suitability === 'LONG' && hasShortOnly) {
    return { ok: false, code: 'PRODUCT_LONG_WITH_SHORT_ONLY' };
  }

  if (!hasHairDomain(areas)) {
    const exclusivity = tags.some((tag) => HAIR_LENGTH_EXCLUSIVITY.includes(tag));
    const shortOrLongSuitability = suitability === 'SHORT' || suitability === 'LONG';
    if (exclusivity || shortOrLongSuitability) {
      return { ok: false, code: 'NON_HAIR_PRODUCT_WITH_HAIR_LENGTH_CONSTRAINT' };
    }
  }

  if (hasShortOnly || hasLongOnly) {
    if (suitability === 'ANY') {
      return { ok: false, code: 'PRODUCT_ANY_WITH_HAIR_LENGTH_EXCLUSIVITY' };
    }
    if (suitability === 'NOT_APPLICABLE') {
      return { ok: false, code: 'PRODUCT_NOT_APPLICABLE_WITH_HAIR_LENGTH_EXCLUSIVITY' };
    }
    if (suitability === 'UNKNOWN') {
      return { ok: false, code: 'PRODUCT_UNKNOWN_WITH_HAIR_LENGTH_EXCLUSIVITY' };
    }
    if (hasShortOnly && suitability !== 'SHORT') {
      return { ok: false, code: 'PRODUCT_EXCLUSIVITY_SUITABILITY_MISMATCH' };
    }
    if (hasLongOnly && suitability !== 'LONG') {
      return { ok: false, code: 'PRODUCT_EXCLUSIVITY_SUITABILITY_MISMATCH' };
    }
  }

  const knownAreas = areas.filter((a) => a !== 'UNKNOWN');
  const knownNeeds = needs.filter((n) => n !== 'UNKNOWN');
  const hasBeardArea = knownAreas.some((a) => a === 'BEARD' || a === 'MOUSTACHE');
  const hasBeardNeed = knownNeeds.some(
    (n) => n === 'BEARD_SOFTENING' || n === 'BEARD_SHAPING' || n === 'BEARD_CLEANSING' || n === 'MOUSTACHE_STYLING',
  );
  const hasShaveArea = knownAreas.includes('SHAVE');
  const hasShaveNeed = knownNeeds.some(
    (n) => n === 'SHAVE_PREPARATION' || n === 'POST_SHAVE_SOOTHING',
  );
  const hasHairArea = knownAreas.some((a) => a === 'HAIR' || a === 'SCALP');
  const hasHairNeed = knownNeeds.some((n) => n.startsWith('HAIR_') || n === 'SCALP_CARE' || n === 'COLOUR_MAINTENANCE');

  if (tags.includes('NOT_FOR_BEARD') && (hasBeardArea || hasBeardNeed)) {
    return { ok: false, code: 'PRODUCT_NOT_FOR_BEARD_WITH_BEARD_SEMANTICS' };
  }
  if (tags.includes('NOT_FOR_SHAVE') && (hasShaveArea || hasShaveNeed)) {
    return { ok: false, code: 'PRODUCT_NOT_FOR_SHAVE_WITH_SHAVE_SEMANTICS' };
  }
  if (tags.includes('HAIR_ONLY') && knownAreas.length > 0 && !hasHairArea && !hasHairNeed) {
    return { ok: false, code: 'PRODUCT_HAIR_ONLY_WITHOUT_HAIR_SEMANTICS' };
  }
  if (
    tags.includes('BEARD_ONLY') &&
    knownAreas.length > 0 &&
    !hasBeardArea &&
    !hasBeardNeed
  ) {
    return { ok: false, code: 'PRODUCT_BEARD_ONLY_WITHOUT_BEARD_SEMANTICS' };
  }

  return { ok: true, canonicalized: removedUnknownMixedWithKnown };
}

export function validateServiceSemanticConsistency(
  profile: Pick<ServiceSemanticProfileAiV2, 'incompatibilities'>,
): SemanticConsistencyResult {
  const { tags, removedUnknownMixedWithKnown } = canonicalizeIncompatibilities(
    profile.incompatibilities,
  );
  const mutual = validateMutualExclusivityTags(tags);
  if (mutual) {
    return { ok: false, code: mutual };
  }
  return { ok: true, canonicalized: removedUnknownMixedWithKnown };
}

/** Apply benign UNKNOWN stripping; throw on material contradiction. */
export function assertProductSemanticConsistency<
  T extends Pick<
    ProductSemanticProfileAiV2,
    'targetAreas' | 'hairLengthSuitability' | 'incompatibilities'
  > &
    Partial<Pick<ProductSemanticProfileAiV2, 'retailNeeds'>>,
>(profile: T): T {
  const result = validateProductSemanticConsistency(profile);
  if (!result.ok) {
    throw new SemanticConsistencyError(result.code);
  }
  const { tags } = canonicalizeIncompatibilities(profile.incompatibilities);
  return { ...profile, incompatibilities: tags };
}

export function assertServiceSemanticConsistency<
  T extends Pick<ServiceSemanticProfileAiV2, 'incompatibilities'>,
>(profile: T): T {
  const result = validateServiceSemanticConsistency(profile);
  if (!result.ok) {
    throw new SemanticConsistencyError(result.code);
  }
  const { tags } = canonicalizeIncompatibilities(profile.incompatibilities);
  return { ...profile, incompatibilities: tags };
}

export class SemanticConsistencyError extends Error {
  readonly code: SemanticContradictionCode;

  constructor(code: SemanticContradictionCode) {
    super(`Semantic consistency failed: ${code}`);
    this.name = 'SemanticConsistencyError';
    this.code = code;
  }
}

/** Full-profile check used at cache / production reuse boundaries. */
export function validateStoredProductProfileConsistency(
  profile: ProductSemanticProfileAiV2,
): SemanticConsistencyResult {
  return validateProductSemanticConsistency(profile);
}

export function validateStoredServiceProfileConsistency(
  profile: ServiceSemanticProfileAiV2,
): SemanticConsistencyResult {
  return validateServiceSemanticConsistency(profile);
}
