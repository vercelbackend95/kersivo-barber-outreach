import type { ProductSemanticProfileAiV2 } from './contracts';
import type { IncompatibilityTag } from './taxonomy';

export type HairLengthRestrictionKind = 'NONE' | 'SHORT_ONLY' | 'LONG_ONLY' | 'CONFLICT';

export type CatalogueSourceText = {
  name: string;
  description: string | null;
  category?: string | null;
};

export const SOURCE_EXPLICIT_SHORT_HAIR_ONLY = 'SOURCE_EXPLICIT_SHORT_HAIR_ONLY';
export const SOURCE_EXPLICIT_LONG_HAIR_ONLY = 'SOURCE_EXPLICIT_LONG_HAIR_ONLY';
export const CATALOGUE_HAIR_LENGTH_RESTRICTION_CONFLICT =
  'CATALOGUE_HAIR_LENGTH_RESTRICTION_CONFLICT';

const HAIR_EXCLUSIVITY_TAGS: IncompatibilityTag[] = ['FOR_SHORT_HAIR_ONLY', 'FOR_LONG_HAIR_ONLY'];

/** Normalize catalogue text for phrase matching: lowercase, collapse punctuation to spaces. */
export function normalizeCatalogueSourceText(source: CatalogueSourceText): string {
  const raw = [source.name, source.description ?? ''].join(' ');
  return raw
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPhrase(haystack: string, pattern: RegExp): boolean {
  return pattern.test(haystack);
}

/** Explicit SHORT_ONLY catalogue wording (boundary-aware). */
const SHORT_ONLY_PATTERNS: RegExp[] = [
  /\bfor short hair only\b/,
  /\bshort hair only\b/,
  /\bonly for short hair\b/,
  /\bexclusively for short hair\b/,
  /\bsuitable only for short hair\b/,
  /\bdesigned only for short hair\b/,
  /\bmade only for short hair\b/,
  /\bformulated only for short hair\b/,
  /\bnot for long hair\b/,
  /\bnot suitable for long hair\b/,
];

/** Explicit LONG_ONLY catalogue wording (boundary-aware). */
const LONG_ONLY_PATTERNS: RegExp[] = [
  /\bfor long hair only\b/,
  /\blong hair only\b/,
  /\bonly for long hair\b/,
  /\bexclusively for long hair\b/,
  /\bsuitable only for long hair\b/,
  /\bdesigned only for long hair\b/,
  /\bmade only for long hair\b/,
  /\bformulated only for long hair\b/,
  /\bnot for short hair\b/,
  /\bnot suitable for short hair\b/,
];

/** Negated "only" phrases that must not count as exclusivity by themselves. */
const NEGATED_SHORT_ONLY = /\bnot only for short hair\b/;
const NEGATED_LONG_ONLY = /\bnot only for long hair\b/;

/**
 * Patterns that establish SHORT exclusivity independently of "only for short hair"
 * style wording (so they still apply alongside "not only for short hair").
 */
const INDEPENDENT_SHORT_EXCLUSIONS: RegExp[] = [
  /\bfor short hair only\b/,
  /\bshort hair only\b/,
  /\bexclusively for short hair\b/,
  /\bnot for long hair\b/,
  /\bnot suitable for long hair\b/,
];

const INDEPENDENT_LONG_EXCLUSIONS: RegExp[] = [
  /\bfor long hair only\b/,
  /\blong hair only\b/,
  /\bexclusively for long hair\b/,
  /\bnot for short hair\b/,
  /\bnot suitable for short hair\b/,
];

/**
 * Derive hard hair-length exclusivity from catalogue source text only.
 * Category is ignored. Soft preference phrases do not establish exclusivity.
 */
export function deriveExplicitHairLengthRestriction(
  source: CatalogueSourceText,
): HairLengthRestrictionKind {
  const text = normalizeCatalogueSourceText(source);
  if (!text) return 'NONE';

  const shortNegated = NEGATED_SHORT_ONLY.test(text);
  const longNegated = NEGATED_LONG_ONLY.test(text);

  let shortHit = SHORT_ONLY_PATTERNS.some((p) => hasPhrase(text, p));
  let longHit = LONG_ONLY_PATTERNS.some((p) => hasPhrase(text, p));

  if (shortNegated && !INDEPENDENT_SHORT_EXCLUSIONS.some((p) => hasPhrase(text, p))) {
    shortHit = false;
  }
  if (longNegated && !INDEPENDENT_LONG_EXCLUSIONS.some((p) => hasPhrase(text, p))) {
    longHit = false;
  }

  if (shortHit && longHit) return 'CONFLICT';
  if (shortHit) return 'SHORT_ONLY';
  if (longHit) return 'LONG_ONLY';
  return 'NONE';
}

function stripHairExclusivityTags(
  tags: readonly IncompatibilityTag[],
): IncompatibilityTag[] {
  return tags.filter((tag) => !HAIR_EXCLUSIVITY_TAGS.includes(tag));
}

function appendEvidence(codes: readonly string[], code: string): string[] {
  if (codes.includes(code)) return [...codes];
  return [...codes, code];
}

export type ApplyHairLengthRestrictionResult =
  | { ok: true; draft: ProductSemanticProfileAiV2 }
  | { ok: false; error: typeof CATALOGUE_HAIR_LENGTH_RESTRICTION_CONFLICT };

/**
 * Strip AI-invented hair exclusivity tags, then apply source-derived restriction.
 * Soft hairLengthSuitability is retained on NONE.
 */
export function applyExplicitHairLengthToProductDraft(
  draft: ProductSemanticProfileAiV2,
  source: CatalogueSourceText,
): ApplyHairLengthRestrictionResult {
  const withoutExclusivity: ProductSemanticProfileAiV2 = {
    ...draft,
    incompatibilities: stripHairExclusivityTags(draft.incompatibilities),
  };

  const kind = deriveExplicitHairLengthRestriction(source);

  if (kind === 'CONFLICT') {
    return { ok: false, error: CATALOGUE_HAIR_LENGTH_RESTRICTION_CONFLICT };
  }

  if (kind === 'NONE') {
    return { ok: true, draft: withoutExclusivity };
  }

  if (kind === 'SHORT_ONLY') {
    return {
      ok: true,
      draft: {
        ...withoutExclusivity,
        hairLengthSuitability: 'SHORT',
        incompatibilities: [...withoutExclusivity.incompatibilities, 'FOR_SHORT_HAIR_ONLY'],
        evidenceCodes: appendEvidence(
          withoutExclusivity.evidenceCodes,
          SOURCE_EXPLICIT_SHORT_HAIR_ONLY,
        ),
      },
    };
  }

  return {
    ok: true,
    draft: {
      ...withoutExclusivity,
      hairLengthSuitability: 'LONG',
      incompatibilities: [...withoutExclusivity.incompatibilities, 'FOR_LONG_HAIR_ONLY'],
      evidenceCodes: appendEvidence(
        withoutExclusivity.evidenceCodes,
        SOURCE_EXPLICIT_LONG_HAIR_ONLY,
      ),
    },
  };
}
