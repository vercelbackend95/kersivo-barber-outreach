import { GENERAL_GROOMING_RETAIL_NEED_F1_MIN } from './constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';
import type { PairRejectionCode } from './pairEvaluation';
import { knownRetailNeeds, retailNeedOverlap } from './retailNeeds';
import { domainsForOverlapNeeds, RETAIL_NEED_DOMAINS } from './retailNeedDomains';
import type {
  HairLengthSuitability,
  IncompatibilityTag,
  RetailNeed,
  TargetArea,
} from './taxonomy';

export type HardEligibilityContext = {
  serviceKnownNeeds: ReturnType<typeof knownRetailNeeds>;
  productKnownNeeds: ReturnType<typeof knownRetailNeeds>;
  overlapNeeds: ReturnType<typeof retailNeedOverlap>;
  /** Whole-profile retail F1 (legacy diagnostic). Prefer pairRetailNeedF1 for scoring. */
  retailNeedF1: number;
  /** Service known needs whose domains intersect matchedAreas. */
  matchedServiceNeeds: RetailNeed[];
  /** Product known needs whose domains intersect matchedAreas. */
  matchedProductNeeds: RetailNeed[];
  /** Pair-scoped retail-need F1 used for scoring. */
  pairRetailNeedF1: number;
  serviceKnownAreas: TargetArea[];
  productKnownAreas: TargetArea[];
  serviceConcreteAreas: TargetArea[];
  productConcreteAreas: TargetArea[];
  /** Concrete service areas restricted to matched semantic domains. */
  pairServiceConcreteAreas: TargetArea[];
  /** Concrete product areas restricted to matched semantic domains. */
  pairProductConcreteAreas: TargetArea[];
  matchedAreas: TargetArea[];
  matchedComponent: TargetArea | null;
};

const GROOMING_DOMAINS: TargetArea[] = ['HAIR', 'BEARD', 'MOUSTACHE', 'SCALP', 'FACE', 'SHAVE'];

const DOMAIN_PRIORITY: TargetArea[] = [
  'HAIR',
  'BEARD',
  'MOUSTACHE',
  'SCALP',
  'FACE',
  'SHAVE',
  'GENERAL_GROOMING',
  'TOOLS_ACCESSORIES',
];

function hasTag(tags: IncompatibilityTag[], tag: IncompatibilityTag): boolean {
  return tags.includes(tag);
}

export function knownAreas(areas: TargetArea[]): TargetArea[] {
  return areas.filter((area) => area !== 'UNKNOWN');
}

export function concreteGroomingDomains(areas: TargetArea[]): TargetArea[] {
  return knownAreas(areas).filter((area) => GROOMING_DOMAINS.includes(area));
}

export function hasGeneralGrooming(areas: TargetArea[]): boolean {
  return knownAreas(areas).includes('GENERAL_GROOMING');
}

export function hasToolsAccessories(areas: TargetArea[]): boolean {
  return knownAreas(areas).includes('TOOLS_ACCESSORIES');
}

function sortMatchedAreas(areas: TargetArea[]): TargetArea[] {
  const unique = [...new Set(areas)];
  return DOMAIN_PRIORITY.filter((area) => unique.includes(area));
}

export function computeRetailNeedF1(
  serviceNeeds: readonly RetailNeed[],
  productNeeds: readonly RetailNeed[],
  overlap: readonly RetailNeed[],
): number {
  if (overlap.length === 0) return 0;
  if (productNeeds.length === 0 || serviceNeeds.length === 0) return 0;
  const precision = overlap.length / productNeeds.length;
  const recall = overlap.length / serviceNeeds.length;
  const denominator = precision + recall;
  if (denominator === 0) return 0;
  return (2 * precision * recall) / denominator;
}

function needIntersectsMatchedAreas(need: RetailNeed, matchedAreas: readonly TargetArea[]): boolean {
  const domains = RETAIL_NEED_DOMAINS[need];
  if (domains.length === 0) return false;
  return domains.some((domain) => matchedAreas.includes(domain));
}

export function filterNeedsForMatchedAreas(
  needs: readonly RetailNeed[],
  matchedAreas: readonly TargetArea[],
): RetailNeed[] {
  return needs.filter((need) => needIntersectsMatchedAreas(need, matchedAreas));
}

function intersectWithNeedDomains(areas: TargetArea[], needDomains: TargetArea[]): TargetArea[] {
  const needDomainSet = new Set(needDomains);
  return sortMatchedAreas(areas.filter((area) => needDomainSet.has(area)));
}

function resolveSemanticMatchedAreas(
  serviceKnown: TargetArea[],
  productKnown: TargetArea[],
  overlapNeeds: RetailNeed[],
  retailNeedF1: number,
): TargetArea[] {
  const needDomains = domainsForOverlapNeeds(overlapNeeds);
  const serviceConcrete = concreteGroomingDomains(serviceKnown);
  const productConcrete = concreteGroomingDomains(productKnown);
  const rawOverlap = serviceConcrete.filter((area) => productConcrete.includes(area));

  const directSemantic = intersectWithNeedDomains(rawOverlap, needDomains);
  if (directSemantic.length > 0) return directSemantic;

  if (
    overlapNeeds.length > 0 &&
    retailNeedF1 >= GENERAL_GROOMING_RETAIL_NEED_F1_MIN &&
    (hasGeneralGrooming(serviceKnown) || hasGeneralGrooming(productKnown))
  ) {
    const bridged: TargetArea[] = [];
    if (serviceConcrete.length > 0 && hasGeneralGrooming(productKnown)) {
      bridged.push(...intersectWithNeedDomains(serviceConcrete, needDomains));
    }
    if (productConcrete.length > 0 && hasGeneralGrooming(serviceKnown)) {
      bridged.push(...intersectWithNeedDomains(productConcrete, needDomains));
    }
    if (hasGeneralGrooming(serviceKnown) && hasGeneralGrooming(productKnown)) {
      bridged.push('GENERAL_GROOMING');
    }
    if (bridged.length > 0) return sortMatchedAreas(bridged);
  }

  if (
    hasToolsAccessories(serviceKnown) &&
    hasToolsAccessories(productKnown) &&
    overlapNeeds.includes('GROOMING_TOOL')
  ) {
    return ['TOOLS_ACCESSORIES'];
  }

  return [];
}

function pickMatchedComponent(matchedAreas: TargetArea[]): TargetArea | null {
  if (matchedAreas.length === 0) return null;
  return matchedAreas[0] ?? null;
}

function isBeardArea(area: TargetArea): boolean {
  return area === 'BEARD' || area === 'MOUSTACHE';
}

function applyDomainConstraints(
  matchedAreas: TargetArea[],
  incompatibilities: IncompatibilityTag[],
): { ok: true; matchedAreas: TargetArea[] } | { ok: false; reasonCode: PairRejectionCode } {
  let areas = [...matchedAreas];

  if (hasTag(incompatibilities, 'BEARD_ONLY')) {
    areas = areas.filter((area) => isBeardArea(area));
    if (areas.length === 0) return { ok: false, reasonCode: 'BEARD_ONLY_PRODUCT' };
  }

  if (hasTag(incompatibilities, 'HAIR_ONLY')) {
    areas = areas.filter((area) => area === 'HAIR');
    if (areas.length === 0) return { ok: false, reasonCode: 'HAIR_ONLY_PRODUCT' };
  }

  if (hasTag(incompatibilities, 'NOT_FOR_BEARD')) {
    areas = areas.filter((area) => !isBeardArea(area));
    if (areas.length === 0) return { ok: false, reasonCode: 'NOT_FOR_BEARD' };
  }

  if (hasTag(incompatibilities, 'NOT_FOR_SHAVE')) {
    areas = areas.filter((area) => area !== 'SHAVE');
    if (areas.length === 0) return { ok: false, reasonCode: 'NOT_FOR_SHAVE' };
  }

  return { ok: true, matchedAreas: sortMatchedAreas(areas) };
}

function hasExclusivityTag(productIncompat: IncompatibilityTag[]): boolean {
  return (
    hasTag(productIncompat, 'FOR_LONG_HAIR_ONLY') || hasTag(productIncompat, 'FOR_SHORT_HAIR_ONLY')
  );
}

/**
 * Hard hair-length conflict uses exclusivity tags only.
 * Suitability SHORT/LONG alone is soft evidence and must not hard-reject.
 */
function exclusivityHardRejection(
  serviceLength: HairLengthSuitability,
  productIncompat: IncompatibilityTag[],
): PairRejectionCode | null {
  const longOnly = hasTag(productIncompat, 'FOR_LONG_HAIR_ONLY');
  const shortOnly = hasTag(productIncompat, 'FOR_SHORT_HAIR_ONLY');

  if (!longOnly && !shortOnly) return null;

  if (serviceLength === 'UNKNOWN') {
    return 'HAIR_LENGTH_UNRESOLVED_FOR_EXCLUSIVE_PRODUCT';
  }
  if (longOnly && serviceLength === 'SHORT') return 'HAIR_LENGTH_MISMATCH';
  if (shortOnly && serviceLength === 'LONG') return 'HAIR_LENGTH_MISMATCH';
  return null;
}

function applyHairLengthConstraints(
  matchedAreas: TargetArea[],
  service: ServiceSemanticProfileV2,
  product: ProductSemanticProfileV2,
): { ok: true; matchedAreas: TargetArea[] } | { ok: false; reasonCode: PairRejectionCode } {
  if (!matchedAreas.includes('HAIR')) {
    return { ok: true, matchedAreas };
  }

  const rejection = exclusivityHardRejection(
    service.typicalHairLength,
    product.incompatibilities,
  );
  if (!rejection) {
    return { ok: true, matchedAreas };
  }

  const withoutHair = matchedAreas.filter((area) => area !== 'HAIR');
  if (withoutHair.length === 0) {
    return { ok: false, reasonCode: rejection };
  }
  // Combo salvage: exclusivity blocks HAIR component only.
  // UNRESOLVED exclusivity still strips HAIR when other domains remain.
  return { ok: true, matchedAreas: sortMatchedAreas(withoutHair) };
}

export function evaluateHardEligibility(
  service: ServiceSemanticProfileV2,
  product: ProductSemanticProfileV2,
): { ok: true; context: HardEligibilityContext } | { ok: false; reasonCode: PairRejectionCode } {
  const serviceKnownNeeds = knownRetailNeeds(service.retailNeeds);
  const productKnownNeeds = knownRetailNeeds(product.retailNeeds);

  if (serviceKnownNeeds.length === 0) {
    return { ok: false, reasonCode: 'SERVICE_RETAIL_NEEDS_UNKNOWN' };
  }
  if (productKnownNeeds.length === 0) {
    return { ok: false, reasonCode: 'PRODUCT_RETAIL_NEEDS_UNKNOWN' };
  }

  const overlapNeeds = retailNeedOverlap(service.retailNeeds, product.retailNeeds);
  if (overlapNeeds.length === 0) {
    return { ok: false, reasonCode: 'NO_RETAIL_NEED_OVERLAP' };
  }

  if (productKnownNeeds.includes('GIFTING') && !serviceKnownNeeds.includes('GIFTING')) {
    return { ok: false, reasonCode: 'NO_RETAIL_NEED_OVERLAP' };
  }

  const retailNeedF1 = computeRetailNeedF1(serviceKnownNeeds, productKnownNeeds, overlapNeeds);

  const serviceKnownAreas = knownAreas(service.targetAreas);
  const productKnownAreas = knownAreas(product.targetAreas);
  const serviceConcreteAreas = concreteGroomingDomains(serviceKnownAreas);
  const productConcreteAreas = concreteGroomingDomains(productKnownAreas);

  let matchedAreas = resolveSemanticMatchedAreas(
    serviceKnownAreas,
    productKnownAreas,
    overlapNeeds,
    retailNeedF1,
  );

  if (matchedAreas.length === 0) {
    return { ok: false, reasonCode: 'NO_TARGET_AREA_OVERLAP' };
  }

  if (
    hasTag(product.incompatibilities, 'POST_SHAVE_ONLY') &&
    !serviceKnownNeeds.includes('POST_SHAVE_SOOTHING') &&
    !service.techniques.includes('HOT_TOWEL_SHAVE')
  ) {
    return { ok: false, reasonCode: 'POST_SHAVE_ONLY_PRODUCT' };
  }

  const domainConstraints = applyDomainConstraints(matchedAreas, product.incompatibilities);
  if (!domainConstraints.ok) return domainConstraints;
  matchedAreas = domainConstraints.matchedAreas;

  const hairLengthConstraints = applyHairLengthConstraints(matchedAreas, service, product);
  if (!hairLengthConstraints.ok) return hairLengthConstraints;
  matchedAreas = hairLengthConstraints.matchedAreas;

  const matchedServiceNeeds = filterNeedsForMatchedAreas(serviceKnownNeeds, matchedAreas);
  const matchedProductNeeds = filterNeedsForMatchedAreas(productKnownNeeds, matchedAreas);
  const pairOverlap = matchedServiceNeeds.filter((need) => matchedProductNeeds.includes(need));
  const pairRetailNeedF1 = computeRetailNeedF1(matchedServiceNeeds, matchedProductNeeds, pairOverlap);

  const matchedAreaSet = new Set(matchedAreas);
  const pairServiceConcreteAreas = serviceConcreteAreas.filter((area) => matchedAreaSet.has(area));
  const pairProductConcreteAreas = productConcreteAreas.filter((area) => matchedAreaSet.has(area));

  const matchedComponent = pickMatchedComponent(matchedAreas);

  return {
    ok: true,
    context: {
      serviceKnownNeeds,
      productKnownNeeds,
      overlapNeeds,
      retailNeedF1,
      matchedServiceNeeds,
      matchedProductNeeds,
      pairRetailNeedF1,
      serviceKnownAreas,
      productKnownAreas,
      serviceConcreteAreas,
      productConcreteAreas,
      pairServiceConcreteAreas,
      pairProductConcreteAreas,
      matchedAreas,
      matchedComponent,
    },
  };
}

export function serviceHasShaveContext(service: ServiceSemanticProfileV2): boolean {
  return (
    knownAreas(service.targetAreas).includes('SHAVE') ||
    knownRetailNeeds(service.retailNeeds).some(
      (need) => need === 'POST_SHAVE_SOOTHING' || need === 'SHAVE_PREPARATION',
    ) ||
    service.techniques.includes('HOT_TOWEL_SHAVE')
  );
}

export function isHairFocusedProduct(product: ProductSemanticProfileV2): boolean {
  return product.targetAreas.some((area) => area === 'HAIR' || area === 'SCALP');
}

export function isBeardFocusedProduct(product: ProductSemanticProfileV2): boolean {
  return product.targetAreas.some((area) => area === 'BEARD' || area === 'MOUSTACHE');
}

export function isHairAndBeardComboService(service: ServiceSemanticProfileV2): boolean {
  const areas = knownAreas(service.targetAreas);
  return areas.includes('HAIR') && areas.some((area) => area === 'BEARD' || area === 'MOUSTACHE');
}

/** @deprecated Exported for tests that previously probed suitability-only hard conflict. */
export function hasHairLengthExclusivity(productIncompat: IncompatibilityTag[]): boolean {
  return hasExclusivityTag(productIncompat);
}
