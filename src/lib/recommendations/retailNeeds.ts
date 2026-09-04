import { RETAIL_NEEDS, type RetailNeed } from './taxonomy';
import { canonicalizeClosedEnumArray } from './canonicalizeClosedEnumArray';

const MAX_RETAIL_NEEDS = 8;

export function canonicalizeRetailNeeds(input: readonly RetailNeed[]): RetailNeed[] {
  const canonical = canonicalizeClosedEnumArray(RETAIL_NEEDS, input, 'UNKNOWN');
  if (canonical.length === 1 && canonical[0] === 'UNKNOWN') return canonical;
  return canonical.slice(0, MAX_RETAIL_NEEDS);
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
