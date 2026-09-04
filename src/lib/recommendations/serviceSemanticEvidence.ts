import { SOURCE_EVIDENCE_CONFIDENCE } from './constants';
import type { ServiceSemanticProfileAiV2 } from './contracts';
import { canonicalizeRetailNeeds } from './retailNeeds';
import type { RetailNeed, TargetArea } from './taxonomy';
import { TARGET_AREAS, isEnumValue } from './taxonomy';

export type ServiceCatalogueSource = {
  name: string;
  description: string | null;
  category?: string | null;
};

export type ServiceSemanticEvidenceInference = {
  targetAreas: TargetArea[];
  retailNeeds: RetailNeed[];
  evidenceCodes: string[];
  fieldConfidence: Partial<Record<'targetAreas' | 'retailNeeds', number>>;
};

type EvidenceComponent = {
  code: string;
  targetAreas: TargetArea[];
  retailNeeds: RetailNeed[];
};

/**
 * Normalize catalogue text for phrase matching.
 * Meaningful connectors are preserved before generic punctuation stripping:
 * `&` → ` and `, `+` → ` plus `.
 */
export function normalizeServiceSourceText(source: ServiceCatalogueSource): string {
  const raw = [source.name, source.description ?? '', source.category ?? ''].join(' ');
  return raw
    .toLowerCase()
    .normalize('NFKC')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Isolated ambiguous tokens that must not alone establish retail semantics. */
const AMBIGUOUS_ONLY = /^(premium|package|treatment|trim|classic|deluxe|the works)$/;

function isAmbiguousOnly(text: string): boolean {
  return AMBIGUOUS_ONLY.test(text);
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const HAIRCUT_BEARD_PATTERNS = [
  /\bhaircut\s+(?:and|plus)\s+beard(?:\s+trim)?\b/,
  /\bhair\s+cut\s+(?:and|plus)\s+beard(?:\s+trim)?\b/,
];

const GENERIC_HAIRCUT_PATTERNS = [
  /\bhaircut\b/,
  /\bcut\s+(?:and|plus)\s+finish\b/,
  /\brestyle\b/,
];

const BEARD_TRIM_PATTERNS = [
  /\bbeard\s+trim\b/,
  /\bbeard\s+shape\b/,
  /\bbeard\s+sculpt\b/,
];

const HOT_SHAVE_PATTERNS = [
  /\bhot\s+towel\s+shave\b/,
  /\bwet\s+shave\b/,
  /\bstraight\s+razor\s+shave\b/,
];

const SCALP_PATTERNS = [/\bscalp\s+treatment\b/, /\bscalp\s+cleanse\b/];

const COLOUR_PATTERNS = [/\bhair\s+colou?r\b/, /\bgrey\s+blend\b/, /\bgray\s+blend\b/];

const BUZZ_HEAD_BALD_PATTERNS = [/\bbuzz\s+cut\b/, /\bhead\s+shave\b/, /\bbald\s+shave\b/];

/** Fixed evaluation order for deterministic evidenceCodes and contribution order. */
const COMPONENT_MATCHERS: Array<{
  code: string;
  patterns: RegExp[];
  targetAreas: TargetArea[];
  retailNeeds: RetailNeed[];
}> = [
  {
    code: 'SOURCE_EVIDENCE_HAIRCUT_BEARD',
    patterns: HAIRCUT_BEARD_PATTERNS,
    targetAreas: ['HAIR', 'BEARD'],
    retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING', 'BEARD_SHAPING'],
  },
  {
    code: 'SOURCE_EVIDENCE_GENERIC_HAIRCUT',
    patterns: GENERIC_HAIRCUT_PATTERNS,
    targetAreas: ['HAIR'],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
  },
  {
    code: 'SOURCE_EVIDENCE_BEARD_TRIM',
    patterns: BEARD_TRIM_PATTERNS,
    targetAreas: ['BEARD'],
    retailNeeds: ['BEARD_SOFTENING', 'BEARD_SHAPING'],
  },
  {
    code: 'SOURCE_EVIDENCE_HOT_SHAVE',
    patterns: HOT_SHAVE_PATTERNS,
    targetAreas: ['SHAVE', 'FACE'],
    retailNeeds: ['SHAVE_PREPARATION', 'POST_SHAVE_SOOTHING'],
  },
  {
    code: 'SOURCE_EVIDENCE_SCALP',
    patterns: SCALP_PATTERNS,
    targetAreas: ['SCALP'],
    retailNeeds: ['SCALP_CARE'],
  },
  {
    code: 'SOURCE_EVIDENCE_COLOUR',
    patterns: COLOUR_PATTERNS,
    targetAreas: ['HAIR'],
    retailNeeds: ['COLOUR_MAINTENANCE'],
  },
  {
    code: 'SOURCE_EVIDENCE_BUZZ_HEAD_BALD_AREA',
    patterns: BUZZ_HEAD_BALD_PATTERNS,
    targetAreas: ['HAIR'],
    retailNeeds: [],
  },
];

function collectComponents(text: string): EvidenceComponent[] {
  const matched: EvidenceComponent[] = [];
  for (const matcher of COMPONENT_MATCHERS) {
    if (!matchesAny(text, matcher.patterns)) continue;
    matched.push({
      code: matcher.code,
      targetAreas: matcher.targetAreas,
      retailNeeds: matcher.retailNeeds,
    });
  }
  return matched;
}

function unionAreasFromComponents(components: readonly EvidenceComponent[]): TargetArea[] {
  const seen = new Set<TargetArea>();
  for (const component of components) {
    for (const area of component.targetAreas) {
      if (isEnumValue(TARGET_AREAS, area)) seen.add(area);
    }
  }
  const ordered = TARGET_AREAS.filter((area) => area !== 'UNKNOWN' && seen.has(area));
  return ordered.length > 0 ? [...ordered] : ['UNKNOWN'];
}

function unionNeedsFromComponents(components: readonly EvidenceComponent[]): RetailNeed[] {
  return canonicalizeRetailNeeds(components.flatMap((component) => component.retailNeeds));
}

/**
 * Conservative catalogue-derived service semantics for obvious service families.
 * Independently supported components are unioned; returns null when nothing matches.
 */
export function inferServiceSemanticEvidence(
  source: ServiceCatalogueSource,
): ServiceSemanticEvidenceInference | null {
  const text = normalizeServiceSourceText(source);
  if (!text || isAmbiguousOnly(text)) return null;

  const components = collectComponents(text);
  if (components.length === 0) return null;

  const targetAreas = unionAreasFromComponents(components);
  const retailNeeds = unionNeedsFromComponents(components);
  const evidenceCodes = components.map((component) => component.code);

  const fieldConfidence: ServiceSemanticEvidenceInference['fieldConfidence'] = {
    targetAreas: SOURCE_EVIDENCE_CONFIDENCE,
  };
  const hasRetailNeeds = retailNeeds.length > 0 && !retailNeeds.every((need) => need === 'UNKNOWN');
  if (hasRetailNeeds) {
    fieldConfidence.retailNeeds = SOURCE_EVIDENCE_CONFIDENCE;
  }

  return {
    targetAreas,
    retailNeeds: hasRetailNeeds ? retailNeeds : [],
    evidenceCodes,
    fieldConfidence,
  };
}

function unionTargetAreas(
  existing: readonly TargetArea[],
  inferred: readonly TargetArea[],
): TargetArea[] {
  const seen = new Set<TargetArea>();
  for (const area of [...existing, ...inferred]) {
    if (!isEnumValue(TARGET_AREAS, area)) continue;
    seen.add(area);
  }
  const known = TARGET_AREAS.filter((area) => area !== 'UNKNOWN' && seen.has(area));
  if (known.length > 0) return [...known];
  if (seen.has('UNKNOWN')) return ['UNKNOWN'];
  return ['UNKNOWN'];
}

function appendEvidence(codes: readonly string[], extra: readonly string[]): string[] {
  const out = [...codes];
  for (const code of extra) {
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * Merge conservative source evidence into an AI service draft.
 * Leaves typicalHairLength unchanged (generic haircut / hair-beard stay UNKNOWN).
 */
export function mergeServiceSemanticEvidence(
  draft: ServiceSemanticProfileAiV2,
  source: ServiceCatalogueSource,
): ServiceSemanticProfileAiV2 {
  const inference = inferServiceSemanticEvidence(source);
  if (!inference) return draft;

  const targetAreas = unionTargetAreas(draft.targetAreas, inference.targetAreas);
  const retailNeeds = canonicalizeRetailNeeds([
    ...draft.retailNeeds,
    ...inference.retailNeeds,
  ]);

  const fieldConfidence = { ...draft.fieldConfidence };
  let evidencedCriticalFields = 0;

  if (inference.fieldConfidence.targetAreas != null) {
    fieldConfidence.targetAreas = Math.max(
      fieldConfidence.targetAreas ?? 0,
      inference.fieldConfidence.targetAreas,
    );
    evidencedCriticalFields += 1;
  }
  if (inference.fieldConfidence.retailNeeds != null) {
    fieldConfidence.retailNeeds = Math.max(
      fieldConfidence.retailNeeds ?? 0,
      inference.fieldConfidence.retailNeeds,
    );
    evidencedCriticalFields += 1;
  }

  const confidence =
    evidencedCriticalFields >= 2
      ? Math.max(draft.confidence, 0.75)
      : draft.confidence;

  return {
    ...draft,
    targetAreas,
    retailNeeds,
    fieldConfidence,
    confidence,
    evidenceCodes: appendEvidence(draft.evidenceCodes, inference.evidenceCodes),
  };
}
