import { describe, expect, it } from 'vitest';
import {
 PHOREST_FACTS_CHECKED_ISO, PHOREST_SOURCES, PHOREST_UK_PLANS,
 PHOREST_UK_COMMERCIAL_FACTS, getPhorestSource,
 requireVerifiedPhorestNumericFact, getPublishedPhorestSubscriptionGbp,
 useUserProvidedPhorestMonthlyQuoteGbp,
} from './phorestFacts';

describe('Phorest UK facts and calculator guardrails',()=>{
 it('uses dated official evidence for every fact',()=>{
  expect(PHOREST_FACTS_CHECKED_ISO).toBe('2026-10-08');
  for(const fact of Object.values(PHOREST_UK_COMMERCIAL_FACTS)){
   expect(fact.checkedIso).toBe(PHOREST_FACTS_CHECKED_ISO);
   expect(getPhorestSource(fact.sourceId).url).toMatch(/^https:\/\//);
  }
  expect(new Set(PHOREST_SOURCES.map(x=>x.id)).size).toBe(PHOREST_SOURCES.length);
 });
 it('keeps every subscription quote-required, never free or guessed',()=>{
  expect(PHOREST_UK_COMMERCIAL_FACTS.monthlySubscriptionGbp.status).toBe('quote_required');
  expect(PHOREST_UK_PLANS.map(x=>x.id)).toEqual(['starter','grow','ultimate','elite']);
  for(const plan of PHOREST_UK_PLANS){
   expect(plan.monthlySubscriptionGbp).toBeNull();
   expect(getPublishedPhorestSubscriptionGbp(plan.id)).toBeNull();
  }
  expect(()=>requireVerifiedPhorestNumericFact('monthlySubscriptionGbp')).toThrow(/quote_required/);
  expect(()=>requireVerifiedPhorestNumericFact('onlinePaymentProcessingGbp')).toThrow(/unresolved/);
  expect(()=>requireVerifiedPhorestNumericFact('setupFeeGbp')).toThrow(/unresolved/);
 });
 it('preserves verified plan-specific SMS entries without inventing Elite overage fees',()=>{
  expect(requireVerifiedPhorestNumericFact('smsRateStarterPence')).toBe(9.5);
  expect(requireVerifiedPhorestNumericFact('smsRateGrowPence')).toBe(8.2);
  expect(requireVerifiedPhorestNumericFact('smsRateUltimatePence')).toBe(7);
  expect(requireVerifiedPhorestNumericFact('eliteIncludedSmsMonthly')).toBe(500);
  expect(()=>requireVerifiedPhorestNumericFact('smsRateEliteAfterAllowancePence')).toThrow();
 });
 it('allows only explicit user-provided quotes as a later scenario input',()=>{
  expect(useUserProvidedPhorestMonthlyQuoteGbp(null)).toBeNull();
  expect(useUserProvidedPhorestMonthlyQuoteGbp(undefined)).toBeNull();
  expect(useUserProvidedPhorestMonthlyQuoteGbp(72.124)).toBe(72.12);
  expect(useUserProvidedPhorestMonthlyQuoteGbp(0)).toBe(0);
  expect(()=>useUserProvidedPhorestMonthlyQuoteGbp(-1)).toThrow();
  expect(()=>useUserProvidedPhorestMonthlyQuoteGbp(Number.NaN)).toThrow();
  expect(()=>useUserProvidedPhorestMonthlyQuoteGbp(Infinity)).toThrow();
 });
});
