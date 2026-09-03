import { GENERAL_GROOMING_RETAIL_NEED_F1_MIN } from './constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';
import type { PairRejectionCode } from './pairEvaluation';
import { knownRetailNeeds, retailNeedOverlap } from './retailNeeds';
import { domainsForOverlapNeeds } from './retailNeedDomains';
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
  retailNeedF1: number;
  serviceKnownAreas: TargetArea[];
  productKnownAreas: TargetArea[];
  serviceConcreteAreas: TargetArea[];
  productConcreteAreas: TargetArea[];
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

function computeRetailNeedF1(
  serviceNeeds: ReturnType<typeof knownRetailNeeds>,
  productNeeds: ReturnType<typeof knownRetailNeeds>,
  overlap: ReturnType<typeof retailNeedOverlap>,
): number {
  if (overlap.length === 0) return 0;
  const precision = overlap.length / productNeeds.length;
  const recall = overlap.length / serviceNeeds.length;
  const denominator = precision + recall;
  if (denominator === 0) return 0;
  return (2 * precision * recall) / denominator;
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

function hairLengthHardConflict(
  serviceLength: HairLengthSuitability,
  productLength: HairLengthSuitability,
  productIncompat: IncompatibilityTag[],
): boolean {
  if (hasTag(productIncompat, 'FOR_LONG_HAIR_ONLY') && serviceLength === 'SHORT') return true;
  if (hasTag(productIncompat, 'FOR_SHORT_HAIR_ONLY') && serviceLength === 'LONG') return true;
  if (productLength === 'LONG' && serviceLength === 'SHORT') return true;
  if (productLength === 'SHORT' && serviceLength === 'LONG') return true;
  return false;
}

function applyHairLengthConstraints(
  matchedAreas: TargetArea[],
  service: ServiceSemanticProfileV2,
  product: ProductSemanticProfileV2,
): { ok: true; matchedAreas: TargetArea[] } | { ok: false; reasonCode: PairRejectionCode } {
  if (!matchedAreas.includes('HAIR')) {
    return { ok: true, matchedAreas };
  }

  if (
    hairLengthHardConflict(
      service.typicalHairLength,
      product.hairLengthSuitability,
      product.incompatibilities,
    )
  ) {
    const withoutHair = matchedAreas.filter((area) => area !== 'HAIR');
    if (withoutHair.length === 0) {
      return { ok: false, reasonCode: 'HAIR_LENGTH_MISMATCH' };
    }
    return { ok: true, matchedAreas: sortMatchedAreas(withoutHair) };
  }

  return { ok: true, matchedAreas };
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

  const matchedComponent = pickMatchedComponent(matchedAreas);

  return {
    ok: true,
    context: {
      serviceKnownNeeds,
      productKnownNeeds,
      overlapNeeds,
      retailNeedF1,
      serviceKnownAreas,
      productKnownAreas,
      serviceConcreteAreas,
      productConcreteAreas,
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
