import { describe, expect, it } from 'vitest';
import {
  TIMELY_FACTS_CHECKED_ISO,
  TIMELY_SOURCES,
  TIMELY_COMMERCIAL_FACTS,
  TIMELY_COMPARE_SECTIONS,
  getTimelySource,
  requireVerifiedTimelyFact,
  resolveTimelyMonthlyShopQuoteGbp,
} from './timelyFacts';

describe('Timely commercial source of truth: calculator safety',()=>{
  it('records provenance and a single verification date for all facts',()=>{
    expect(TIMELY_FACTS_CHECKED_ISO).toBe('2026-10-08');
    expect(new Set(TIMELY_SOURCES.map(x=>x.id)).size).toBe(TIMELY_SOURCES.length);
    for(const fact of Object.values(TIMELY_COMMERCIAL_FACTS)){
      expect(fact.checkedIso).toBe(TIMELY_FACTS_CHECKED_ISO);
      expect(getTimelySource(fact.sourceId).url).toMatch(/^https:\/\//);
    }
  });
  it('separates verified USA USD tier prices from UK GBP unknowns',()=>{
    const tiers=[
      requireVerifiedTimelyFact('buildUsMonthlyPerStaff'),
      requireVerifiedTimelyFact('elevateUsMonthlyPerStaff'),
      requireVerifiedTimelyFact('innovateUsMonthlyPerStaff'),
    ];
    expect(tiers.map(x=>('amount' in x?x.amount:null))).toEqual([26,39,47]);
    expect(tiers.every(x=>'currency' in x&&x.currency==='USD'&&x.market==='US')).toBe(true);
    expect(TIMELY_COMMERCIAL_FACTS.ukMonthlyPerStaffGbp.status).toBe('unresolved');
    for(const unknown of ['ukMonthlyPerStaffGbp','ukVatTreatment','ukInPersonPaymentProcessing','ukAddOnsAndOverages'] as const){
      expect(()=>requireVerifiedTimelyFact(unknown)).toThrow(/unresolved/);
    }
  });
  it('uses only a real UK monthly shop quote for optional later cost calculations',()=>{
    expect(resolveTimelyMonthlyShopQuoteGbp(undefined)).toBeNull();
    expect(resolveTimelyMonthlyShopQuoteGbp(null)).toBeNull();
    expect(resolveTimelyMonthlyShopQuoteGbp(0)).toBeNull(); // default/blank quote must not imply a free Timely plan
    expect(resolveTimelyMonthlyShopQuoteGbp(39.999)).toBe(40);
    for(const invalid of [-1,Infinity,Number.NaN]){
      expect(()=>resolveTimelyMonthlyShopQuoteGbp(invalid)).toThrow();
    }
  });
  it('distinguishes no new-client fees from card-processing fees',()=>{
    expect(requireVerifiedTimelyFact('noNewClientFees').status).toBe('verified');
    expect(TIMELY_COMMERCIAL_FACTS.ukOnlinePaymentProcessing.status).toBe('verified');
    expect(requireVerifiedTimelyFact('ukOnlinePaymentProcessing')).toMatchObject({percent:1.85,fixedGbp:0.30,market:'UK'});
    expect(requireVerifiedTimelyFact('ukInternationalOnlinePaymentProcessing')).toMatchObject({percent:3,fixedGbp:0.30,market:'UK'});
    expect(TIMELY_COMMERCIAL_FACTS.ukInPersonPaymentProcessing.status).toBe('unresolved');
    expect(TIMELY_COMPARE_SECTIONS.map(x=>x.id)).toEqual(['bookings','payments','brand','retail','clients','reports']);
  });
});
