import { describe, expect, it } from 'vitest';
import {
  VAGARO_FACTS_CHECKED_ISO,
  VAGARO_SOURCES,
  VAGARO_UK_COMMERCIAL_FACTS,
  estimateVagaroDisplayedSubscriptionGbp,
  getVagaroSource,
  requireVerifiedVagaroFact,
  resolveVagaroUkAcquisitionPercent,
  type VagaroFeeContext,
} from './vagaroFacts';

const context: VagaroFeeContext = {
  channel: 'marketplace',
  isNewClient: true,
  marketplaceListingActive: true,
  fillMyBooksEnabled: false,
  promotedBooking: false,
};

describe('Vagaro UK commercial source of truth', () => {
  it('has unique official URLs and dated provenance for every fact', () => {
    expect(VAGARO_FACTS_CHECKED_ISO).toBe('2026-10-08');
    expect(new Set(VAGARO_SOURCES.map((s) => s.id)).size).toBe(VAGARO_SOURCES.length);
    for (const fact of Object.values(VAGARO_UK_COMMERCIAL_FACTS)) {
      expect(fact.checkedIso).toBe(VAGARO_FACTS_CHECKED_ISO);
      expect(getVagaroSource(fact.sourceId).url).toMatch(/^https:\/\//);
    }
  });

  it('keeps promotional and unresolved prices clearly separate', () => {
    const displayed = requireVerifiedVagaroFact('oneCalendarDisplayedMonthlyGbp');
    expect(displayed.value).toBe(20);
    expect(displayed.pricingStatus).toBe('displayed-discount');
    expect(requireVerifiedVagaroFact('oneCalendarStruckThroughMonthlyGbp').value).toBe(30);
    expect(requireVerifiedVagaroFact('additionalCalendarMonthlyGbp').value).toBe(10);
    expect(requireVerifiedVagaroFact('monthlyMySiteAddOnGbp').value).toBe(15);
    expect(VAGARO_UK_COMMERCIAL_FACTS.paymentProcessingFees.status).toBe('unresolved');
    expect(requireVerifiedVagaroFact('standardOnlineProcessingPercent').value).toBe(1.4);
    expect(requireVerifiedVagaroFact('standardOnlineProcessingFixedGbp').value).toBe(0.25);
    expect(VAGARO_UK_COMMERCIAL_FACTS.vatOnSubscriptionPercent.status).toBe('unresolved');
    expect(() => requireVerifiedVagaroFact('paymentProcessingFees')).toThrow(/unresolved/);
  });

  it('models the displayed calendar prices only as illustrations', () => {
    expect([1,2,3,5,7,8,30].map(estimateVagaroDisplayedSubscriptionGbp))
      .toEqual([20,30,40,60,80,80,80]);
    for (const bad of [0,-1,1.5,Number.NaN,Number.POSITIVE_INFINITY]) {
      expect(() => estimateVagaroDisplayedSubscriptionGbp(bad)).toThrow();
    }
  });

  it('charges the conditional UK new-client fee only in relevant channels', () => {
    expect(resolveVagaroUkAcquisitionPercent(context)).toBe(20);
    expect(resolveVagaroUkAcquisitionPercent({...context,marketplaceListingActive:false})).toBe(0);
    expect(resolveVagaroUkAcquisitionPercent({...context,channel:'partner-network'})).toBe(20);
    expect(resolveVagaroUkAcquisitionPercent({...context,channel:'partner-network',marketplaceListingActive:false})).toBe(0);
    expect(resolveVagaroUkAcquisitionPercent({...context,channel:'own-channel'})).toBe(0);
    expect(resolveVagaroUkAcquisitionPercent({...context,channel:'own-channel',fillMyBooksEnabled:true})).toBe(20);
    expect(resolveVagaroUkAcquisitionPercent({...context,channel:'direct-other'})).toBe(0);
  });

  it('does not apply an existing-client fee to ordinary return bookings', () => {
    expect(resolveVagaroUkAcquisitionPercent({...context,isNewClient:false})).toBe(0);
    expect(resolveVagaroUkAcquisitionPercent({...context,isNewClient:false,promotedBooking:true})).toBe(5);
    expect(resolveVagaroUkAcquisitionPercent({...context,isNewClient:false,promotedBooking:true,marketplaceListingActive:false})).toBe(0);
    expect(requireVerifiedVagaroFact('marketplaceNewClientFirstBookingPercent').value).toBe(20);
    expect(requireVerifiedVagaroFact('fillMyBooksExistingClientPercent').value).toBe(5);
  });
});
