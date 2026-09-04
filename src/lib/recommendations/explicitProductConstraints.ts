import type { ProductSemanticProfileAiV2 } from './contracts';
import type { IncompatibilityTag } from './taxonomy';

export type CatalogueSourceText = {
  name: string;
  description: string | null;
  category?: string | null;
};

/** Material hard restriction tags derived only from catalogue source (not AI). */
export const SOURCE_AUTHORITATIVE_HARD_TAGS: IncompatibilityTag[] = [
  'HAIR_ONLY',
  'BEARD_ONLY',
  'NOT_FOR_BEARD',
  'NOT_FOR_SHAVE',
  'POST_SHAVE_ONLY',
  'LEAVE_IN_ONLY',
  'RINSE_OUT_ONLY',
];

export const CATALOGUE_PRODUCT_CONSTRAINT_CONFLICT = 'CATALOGUE_PRODUCT_CONSTRAINT_CONFLICT';

export const SOURCE_EXPLICIT_HAIR_ONLY = 'SOURCE_EXPLICIT_HAIR_ONLY';
export const SOURCE_EXPLICIT_BEARD_ONLY = 'SOURCE_EXPLICIT_BEARD_ONLY';
export const SOURCE_EXPLICIT_NOT_FOR_BEARD = 'SOURCE_EXPLICIT_NOT_FOR_BEARD';
export const SOURCE_EXPLICIT_NOT_FOR_SHAVE = 'SOURCE_EXPLICIT_NOT_FOR_SHAVE';
export const SOURCE_EXPLICIT_POST_SHAVE_ONLY = 'SOURCE_EXPLICIT_POST_SHAVE_ONLY';
export const SOURCE_EXPLICIT_LEAVE_IN_ONLY = 'SOURCE_EXPLICIT_LEAVE_IN_ONLY';
export const SOURCE_EXPLICIT_RINSE_OUT_ONLY = 'SOURCE_EXPLICIT_RINSE_OUT_ONLY';

export function normalizeProductConstraintSourceText(source: CatalogueSourceText): string {
  const raw = [source.name, source.description ?? ''].join(' ');
  return raw
    .toLowerCase()
    .normalize('NFKC')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type DerivedConstraints = {
  tags: IncompatibilityTag[];
  evidenceCodes: string[];
  conflict: boolean;
};

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/** Negated exclusivity spans — remove before matching positive only-tags. */
const NEGATED_EXCLUSIVITY_SPANS = [
  /\bnot only for beard\b/g,
  /\bnot just for beard\b/g,
  /\bnot only for hair\b/g,
  /\bnot just for hair\b/g,
];

function neutralizeNegatedExclusivitySpans(text: string): string {
  let out = text;
  for (const pattern of NEGATED_EXCLUSIVITY_SPANS) {
    out = out.replace(pattern, ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

const BEARD_ONLY_PATTERNS = [
  /\bbeard only\b/,
  /\bbeard exclusive\b/,
  /\bfor beard only\b/,
  /\bexclusively for beard\b/,
  /\bonly for beard\b/,
  /\bexclusively for beard use\b/,
];

const HAIR_ONLY_PATTERNS = [
  /\bhair only\b/,
  /\bfor hair only\b/,
  /\bexclusively for hair\b/,
  /\bonly for hair\b/,
  /\bdesigned exclusively for hair\b/,
];

const NOT_FOR_BEARD_PATTERNS = [
  /\bnot for beard use\b/,
  /\bnot for beard\b/,
  /\bunsuitable for beard\b/,
  /\bdo not use on beard\b/,
];

const NOT_FOR_SHAVE_PATTERNS = [
  /\bnot for shave\b/,
  /\bnot for shaving\b/,
  /\bunsuitable for shaving\b/,
  /\bdo not use for shaving\b/,
];

const POST_SHAVE_ONLY_PATTERNS = [
  /\bonly for use after shaving\b/,
  /\bpost shave only\b/,
  /\bafter shave only\b/,
  /\bfor use only after shaving\b/,
];

const LEAVE_IN_ONLY_PATTERNS = [/\bleave in only\b/, /\bleave\-in only\b/];
const RINSE_OUT_ONLY_PATTERNS = [/\brinse out only\b/, /\brinse\-out only\b/];

/**
 * Derive material hard product constraints from catalogue name/description only.
 * Category is ignored.
 */
export function deriveExplicitProductConstraints(source: CatalogueSourceText): DerivedConstraints {
  const text = normalizeProductConstraintSourceText(source);
  if (!text) return { tags: [], evidenceCodes: [], conflict: false };

  // Match exclusivity on neutralized text so "not only for X" does not block
  // an independent "exclusively for X" elsewhere in the same source.
  const exclusivityText = neutralizeNegatedExclusivitySpans(text);

  const tags: IncompatibilityTag[] = [];
  const evidenceCodes: string[] = [];

  const beardOnly = matchAny(exclusivityText, BEARD_ONLY_PATTERNS);
  const hairOnly = matchAny(exclusivityText, HAIR_ONLY_PATTERNS);
  const notForBeard = matchAny(text, NOT_FOR_BEARD_PATTERNS);
  const notForShave = matchAny(text, NOT_FOR_SHAVE_PATTERNS);
  const postShaveOnly = matchAny(text, POST_SHAVE_ONLY_PATTERNS);
  const leaveInOnly = matchAny(text, LEAVE_IN_ONLY_PATTERNS);
  const rinseOutOnly = matchAny(text, RINSE_OUT_ONLY_PATTERNS);

  const dualHairBeard =
    /\bhair\s+(?:and|plus)\s+beard\b/.test(text) ||
    /\bbeard\s+(?:and|plus)\s+hair\b/.test(text) ||
    /\bfor both hair and beard\b/.test(text) ||
    /\bmulti purpose balm for hair and beard\b/.test(text);

  if (beardOnly) {
    tags.push('BEARD_ONLY');
    evidenceCodes.push(SOURCE_EXPLICIT_BEARD_ONLY);
  }
  if (hairOnly) {
    tags.push('HAIR_ONLY');
    evidenceCodes.push(SOURCE_EXPLICIT_HAIR_ONLY);
  }
  if (notForBeard) {
    tags.push('NOT_FOR_BEARD');
    evidenceCodes.push(SOURCE_EXPLICIT_NOT_FOR_BEARD);
  }
  if (notForShave) {
    tags.push('NOT_FOR_SHAVE');
    evidenceCodes.push(SOURCE_EXPLICIT_NOT_FOR_SHAVE);
  }
  if (postShaveOnly) {
    tags.push('POST_SHAVE_ONLY');
    evidenceCodes.push(SOURCE_EXPLICIT_POST_SHAVE_ONLY);
  }
  if (leaveInOnly) {
    tags.push('LEAVE_IN_ONLY');
    evidenceCodes.push(SOURCE_EXPLICIT_LEAVE_IN_ONLY);
  }
  if (rinseOutOnly) {
    tags.push('RINSE_OUT_ONLY');
    evidenceCodes.push(SOURCE_EXPLICIT_RINSE_OUT_ONLY);
  }

  const conflict =
    (tags.includes('BEARD_ONLY') && tags.includes('NOT_FOR_BEARD')) ||
    (tags.includes('HAIR_ONLY') && tags.includes('BEARD_ONLY')) ||
    (tags.includes('POST_SHAVE_ONLY') && tags.includes('NOT_FOR_SHAVE')) ||
    (tags.includes('LEAVE_IN_ONLY') && tags.includes('RINSE_OUT_ONLY')) ||
    (beardOnly && notForBeard) ||
    (dualHairBeard && notForBeard);

  return { tags: [...new Set(tags)], evidenceCodes: [...new Set(evidenceCodes)], conflict };
}

function stripHardTags(tags: readonly IncompatibilityTag[]): IncompatibilityTag[] {
  return tags.filter((tag) => !SOURCE_AUTHORITATIVE_HARD_TAGS.includes(tag));
}

function appendEvidence(codes: readonly string[], extra: readonly string[]): string[] {
  const out = [...codes];
  for (const code of extra) {
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

export type ApplyProductConstraintsResult =
  | { ok: true; draft: ProductSemanticProfileAiV2 }
  | { ok: false; error: typeof CATALOGUE_PRODUCT_CONSTRAINT_CONFLICT };

/**
 * Strip AI-invented material hard tags, then apply source-derived constraints.
 */
export function applyExplicitProductConstraintsToDraft(
  draft: ProductSemanticProfileAiV2,
  source: CatalogueSourceText,
): ApplyProductConstraintsResult {
  const withoutHard: ProductSemanticProfileAiV2 = {
    ...draft,
    incompatibilities: stripHardTags(draft.incompatibilities),
  };

  const derived = deriveExplicitProductConstraints(source);
  if (derived.conflict) {
    return { ok: false, error: CATALOGUE_PRODUCT_CONSTRAINT_CONFLICT };
  }

  if (derived.tags.length === 0) {
    return { ok: true, draft: withoutHard };
  }

  return {
    ok: true,
    draft: {
      ...withoutHard,
      incompatibilities: [...withoutHard.incompatibilities, ...derived.tags],
      evidenceCodes: appendEvidence(withoutHard.evidenceCodes, derived.evidenceCodes),
    },
  };
}
