import { describe, expect, it } from 'vitest';
import {
  TIMELY_FACTS_CHECKED_ISO,
  TIMELY_SOURCES,
  TIMELY_COMMERCIAL_FACTS,
  getTimelySource,
  requireVerifiedTimelyFact,
  resolveTimelyMonthlyShopQuoteGbp,
  weeklyToMonthlyGbp,
} from './timelyFacts';

describe('Timely commercial source of truth: calculator safety',()=>{
  it('records provenance and a single verification date for all facts',()=>{
    expect(TIMELY_FACTS_CHECKED_ISO).toBe('2026-11-14');
    expect(new Set(TIMELY_SOURCES.map(x=>x.id)).size).toBe(TIMELY_SOURCES.length);
    for(const fact of Object.values(TIMELY_COMMERCIAL_FACTS)){
      expect(fact.checkedIso).toBe(TIMELY_FACTS_CHECKED_ISO);
      expect(getTimelySource(fact.sourceId).url).toMatch(/^https:\/\//);
    }
  });
  it('holds the published UK weekly starting prices and leaves the booking-volume scale unresolved',()=>{
    const tiers=(['runFromWeekly','boostFromWeekly','thriveFromWeekly'] as const).map(k=>requireVerifiedTimelyFact(k));
    expect(tiers.map(x=>('amountGbp' in x?x.amountGbp:null))).toEqual([4,7,9]);
    expect(requireVerifiedTimelyFact('advancedTeamAddOnWeekly')).toMatchObject({amountGbp:8});
    expect(requireVerifiedTimelyFact('unlimitedTeamMembers')).toMatchObject({value:true});
    expect(requireVerifiedTimelyFact('bookingBasedBilling')).toMatchObject({value:true});
    for(const unknown of ['bookingVolumeScale','ukVatTreatment','ownDomainWebsite'] as const){
      expect(()=>requireVerifiedTimelyFact(unknown)).toThrow(/unresolved/);
    }
  });
  it('converts weekly prices to a monthly average',()=>{
    expect(weeklyToMonthlyGbp(4)).toBe(17.33);
    expect(weeklyToMonthlyGbp(7)).toBe(30.33);
    expect(weeklyToMonthlyGbp(9)).toBe(39);
  });
  it('uses only a real UK monthly shop quote for calculator cost estimates',()=>{
    expect(resolveTimelyMonthlyShopQuoteGbp(undefined)).toBeNull();
    expect(resolveTimelyMonthlyShopQuoteGbp(null)).toBeNull();
    expect(resolveTimelyMonthlyShopQuoteGbp(0)).toBeNull();
    expect(resolveTimelyMonthlyShopQuoteGbp(39.999)).toBe(40);
    for(const invalid of [-1,Infinity,Number.NaN]){
      expect(()=>resolveTimelyMonthlyShopQuoteGbp(invalid)).toThrow();
    }
  });
  it('distinguishes no new-client fees from card-processing fees',()=>{
    expect(requireVerifiedTimelyFact('noNewClientFees').status).toBe('verified');
    expect(requireVerifiedTimelyFact('ukOnlinePaymentProcessing')).toMatchObject({percent:1.85,fixedGbp:0.30});
    expect(requireVerifiedTimelyFact('ukInternationalOnlinePaymentProcessing')).toMatchObject({percent:3,fixedGbp:0.30});
    expect(requireVerifiedTimelyFact('ukInPersonPaymentProcessing')).toMatchObject({percent:1.59,fixedGbp:0.05});
  });
});
