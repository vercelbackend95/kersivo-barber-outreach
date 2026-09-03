import { isEnumValue, RETAIL_NEEDS, type RetailNeed } from './taxonomy';

const MAX_RETAIL_NEEDS = 8;

export function canonicalizeRetailNeeds(input: readonly RetailNeed[]): RetailNeed[] {
  const seen = new Set<RetailNeed>();
  const deduped: RetailNeed[] = [];

  for (const value of input) {
    if (!isEnumValue(RETAIL_NEEDS, value) || seen.has(value)) continue;
    seen.add(value);
    deduped.push(value);
    if (deduped.length >= MAX_RETAIL_NEEDS) break;
  }

  const known = deduped.filter((value) => value !== 'UNKNOWN');
  if (known.length > 0) return known;
  return ['UNKNOWN'];
}

export function knownRetailNeeds(input: readonly RetailNeed[]): RetailNeed[] {
  return canonicalizeRetailNeeds(input).filter((value) => value !== 'UNKNOWN');
}

export function retailNeedOverlap(
  serviceNeeds: readonly RetailNeed[],
  productNeeds: readonly RetailNeed[],
): RetailNeed[] {
  const productSet = new Set(knownRetailNeeds(productNeeds));
  return knownRetailNeeds(serviceNeeds).filter((need) => productSet.has(need));
}
