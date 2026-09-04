import { SOURCE_EVIDENCE_CONFIDENCE } from './constants';
import type { ProductSemanticProfileAiV2 } from './contracts';
import { canonicalizeRetailNeeds } from './retailNeeds';
import type { RetailNeed, TargetArea } from './taxonomy';
import { TARGET_AREAS, isEnumValue } from './taxonomy';
import { normalizeProductConstraintSourceText, type CatalogueSourceText } from './explicitProductConstraints';

export const SOURCE_EVIDENCE_HAIR_AND_BEARD_PRODUCT = 'SOURCE_EVIDENCE_HAIR_AND_BEARD_PRODUCT';

const DUAL_PATTERNS = [
  /\bhair\s+(?:and|plus)\s+beard\b/,
  /\bbeard\s+(?:and|plus)\s+hair\b/,
  /\bfor both hair and beard\b/,
  /\bfor hair\s*(?:and|&)\s*beard\b/,
  /\bmulti purpose (?:balm|cream|oil|wax)?\s*for hair and beard\b/,
];

type DualFunctionNeeds = {
  needs: RetailNeed[];
  raiseRetailConfidence: boolean;
};

/**
 * Infer retail needs from dual-domain product function cues.
 * Dual wording alone never invents known retail needs.
 * Valid AI-classified needs are preserved by the caller via merge.
 */
function inferDualFunctionNeeds(text: string): DualFunctionNeeds {
  if (/\b(comb|brush|tool)\b/.test(text)) {
    return { needs: ['GROOMING_TOOL'], raiseRetailConfidence: true };
  }
  if (/\b(wash|shampoo|cleanser|cleansing)\b/.test(text)) {
    return { needs: ['HAIR_CLEANSING', 'BEARD_CLEANSING'], raiseRetailConfidence: true };
  }
  if (/\bconditioner\b/.test(text)) {
    const needs: RetailNeed[] = ['HAIR_CONDITIONING'];
    if (/\bsoften|softening|soft\b/.test(text)) needs.push('BEARD_SOFTENING');
    return { needs, raiseRetailConfidence: true };
  }
  if (/\bbalm\b/.test(text)) {
    return {
      needs: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING', 'BEARD_SHAPING'],
      raiseRetailConfidence: true,
    };
  }
  if (/\b(pomade|clay|wax|paste|gel|fibre|fiber)\b/.test(text)) {
    return {
      needs: ['HAIR_STYLING_CONTROL', 'BEARD_SHAPING'],
      raiseRetailConfidence: true,
    };
  }
  if (/\boil\b/.test(text)) {
    return {
      needs: ['BEARD_SOFTENING'],
      raiseRetailConfidence: true,
    };
  }
  // Generic cream / dual wording without a clear function cue.
  return { needs: [], raiseRetailConfidence: false };
}

/**
 * Narrow positive source evidence for explicitly combined hair+beard products.
 * Establishes HAIR+BEARD areas; retail needs only when function is clear.
 */
export function mergeProductDualDomainEvidence(
  draft: ProductSemanticProfileAiV2,
  source: CatalogueSourceText,
): ProductSemanticProfileAiV2 {
  const text = normalizeProductConstraintSourceText(source);
  if (!text || !DUAL_PATTERNS.some((p) => p.test(text))) return draft;

  const areas = new Set<TargetArea>();
  for (const area of [...draft.targetAreas, 'HAIR' as TargetArea, 'BEARD' as TargetArea]) {
    if (isEnumValue(TARGET_AREAS, area) && area !== 'UNKNOWN') areas.add(area);
  }
  const targetAreas = TARGET_AREAS.filter((a) => a !== 'UNKNOWN' && areas.has(a));

  const inferred = inferDualFunctionNeeds(text);
  const retailNeeds = canonicalizeRetailNeeds([...draft.retailNeeds, ...inferred.needs]);

  const fieldConfidence = { ...draft.fieldConfidence };
  fieldConfidence.targetAreas = Math.max(
    fieldConfidence.targetAreas ?? 0,
    SOURCE_EVIDENCE_CONFIDENCE,
  );
  if (inferred.raiseRetailConfidence) {
    fieldConfidence.retailNeeds = Math.max(
      fieldConfidence.retailNeeds ?? 0,
      SOURCE_EVIDENCE_CONFIDENCE,
    );
  }

  const evidenceCodes = draft.evidenceCodes.includes(SOURCE_EVIDENCE_HAIR_AND_BEARD_PRODUCT)
    ? [...draft.evidenceCodes]
    : [...draft.evidenceCodes, SOURCE_EVIDENCE_HAIR_AND_BEARD_PRODUCT];

  return {
    ...draft,
    targetAreas: targetAreas.length > 0 ? targetAreas : draft.targetAreas,
    retailNeeds,
    fieldConfidence,
    confidence: Math.max(draft.confidence, 0.75),
    evidenceCodes,
  };
}
