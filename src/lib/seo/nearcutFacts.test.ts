import { describe, expect, it } from 'vitest';
import {
  NEARCUT_FACTS_CHECKED_ISO,
  NEARCUT_SOURCES,
  NEARCUT_UK_COMMERCIAL_FACTS,
  NEARCUT_STANDARD_ONLINE_PAYMENT_TIERS,
  getNearcutSource,
  requireVerifiedNearcutFact,
  requireIllustrativeNearcutFact,
  estimateNearcutStandardPaymentFeeGbp,
} from './nearcutFacts';

describe('Nearcut UK commercial source of truth', () => {
  it('holds official sources and a checked date for every commercial entry', () => {
    expect(NEARCUT_FACTS_CHECKED_ISO).toBe('2026-10-08');
    for (const fact of Object.values(NEARCUT_UK_COMMERCIAL_FACTS)) {
      expect(fact.checkedIso).toBe(NEARCUT_FACTS_CHECKED_ISO);
      const source = getNearcutSource(fact.sourceId);
      expect(source.url).toMatch(/^https:\/\//);
    }
    expect(new Set(NEARCUT_SOURCES.map(s => s.id)).size).toBe(NEARCUT_SOURCES.length);
  });

  it('keeps the £1.50 customer charge an illustration, not a universal rate', () => {
    const example = requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample');
    expect(example.amountGbp).toBe(1.5);
    expect(example.exampleServicePriceGbp).toBe(20);
    expect(example.payer).toBe('client');
    expect(example.status).toBe('illustrative');
    expect(() => requireVerifiedNearcutFact('freeForYouCustomerBookingFeeExample'))
      .toThrow(/illustrative/);
  });

  it('models Free for You as £0 per month and quote-based Subscription as unresolved', () => {
    const free = requireVerifiedNearcutFact('freeForYouMonthlySubscription');
    expect(free.amountGbp).toBe(0);
    expect(free.payer).toBe('barbershop');
    expect(free.plan).toBe('free-for-you');
    expect(NEARCUT_UK_COMMERCIAL_FACTS.subscriptionMonthlyPrice.status).toBe('unresolved');
    expect(() => requireVerifiedNearcutFact('subscriptionMonthlyPrice')).toThrow(/unresolved/);
    const noCustomerCharge = requireVerifiedNearcutFact('subscriptionCustomerBookingFee');
    expect(noCustomerCharge.amountGbp).toBe(0);
    expect(noCustomerCharge.payer).toBe('client');
  });

  it('distinguishes plan-advertised zero payment fees from generic Help Centre payment rates', () => {
    const freeOnline = requireVerifiedNearcutFact('freeForYouOnlinePayments');
    expect(freeOnline.percent).toBe(0);
    expect(freeOnline.amountGbp).toBe(0);
    expect(freeOnline.sourceId).toBe('pricingUk');
    const standard = requireVerifiedNearcutFact('standardOnlinePaymentProcessing');
    expect(standard.percent).toBe(2.9);
    expect(standard.amountGbp).toBe(0.2);
    expect(standard.sourceId).toBe('onlinePayments');
    expect(standard.note).toMatch(/Not necessarily chargeable on Free for You/);
  });

  it('does not invent GBP booster pricing or prices for very large card volumes', () => {
    expect(NEARCUT_UK_COMMERCIAL_FACTS.subscriptionBoosterPrice.status).toBe('unresolved');
    expect(NEARCUT_UK_COMMERCIAL_FACTS.standardProcessingAboveGbp30000.status).toBe('unresolved');
    expect(() => requireVerifiedNearcutFact('subscriptionBoosterPrice')).toThrow();
    expect(estimateNearcutStandardPaymentFeeGbp(5, 30000)).toBeNull();
  });

  it('can estimate known standard processing tiers, only when the plan is confirmed', () => {
    expect(NEARCUT_STANDARD_ONLINE_PAYMENT_TIERS.map(x => x.minPrevious30DayVolumeGbp))
      .toEqual([0, 2500, 5000, 10000]);
    expect(estimateNearcutStandardPaymentFeeGbp(100, 0)).toBe(3.1);
    expect(estimateNearcutStandardPaymentFeeGbp(100, 2499)).toBe(3.1);
    expect(estimateNearcutStandardPaymentFeeGbp(100, 2500)).toBe(2.6);
    expect(estimateNearcutStandardPaymentFeeGbp(100, 5000)).toBe(2.2);
    expect(estimateNearcutStandardPaymentFeeGbp(100, 10000)).toBe(2);
    expect(estimateNearcutStandardPaymentFeeGbp(100, 30000)).toBeNull();
    expect(() => estimateNearcutStandardPaymentFeeGbp(-1, 0)).toThrow();
    expect(() => estimateNearcutStandardPaymentFeeGbp(5, -1)).toThrow();
    expect(() => estimateNearcutStandardPaymentFeeGbp(Number.NaN, 1000)).toThrow();
  });
});
