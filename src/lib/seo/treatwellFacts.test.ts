import { describe, expect, it } from 'vitest';
import {
  TREATWELL_FACTS_CHECKED_ISO,
  TREATWELL_SOURCES,
  TREATWELL_UK_COMMERCIAL_FACTS,
  getTreatwellSource,
  requireVerifiedTreatwellFact,
  estimateTreatwellPublishedBookingFees,
} from './treatwellFacts';

describe('Treatwell UK calculator source of truth', () => {
  it('keeps every commercial fact source-linked and dated', () => {
    expect(TREATWELL_FACTS_CHECKED_ISO).toBe('2026-10-08');
    expect(new Set(TREATWELL_SOURCES.map(x => x.id)).size).toBe(TREATWELL_SOURCES.length);
    for (const fact of Object.values(TREATWELL_UK_COMMERCIAL_FACTS)) {
      expect(fact.checkedIso).toBe(TREATWELL_FACTS_CHECKED_ISO);
      expect(getTreatwellSource(fact.sourceId).url).toMatch(/^https:\/\//);
    }
    expect(TREATWELL_SOURCES.map(x => x.id)).toContain('partnerTerms');
    expect(getTreatwellSource('partnerTerms').supports).toContain('365-day');
  });

  it('distinguishes marketplace acquisition, direct/repeat bookings and online processing', () => {
    const newBooking = requireVerifiedTreatwellFact('newMarketplaceClientCommission');
    expect(newBooking.percent).toBe(35);
    expect(newBooking.vat).toBe('exclusive');
    expect(newBooking.payer).toBe('barbershop');
    expect(requireVerifiedTreatwellFact('repeatBookingMarketplaceCommission').percent).toBe(0);
    expect(requireVerifiedTreatwellFact('directBookingMarketplaceCommission').percent).toBe(0);
    const processing = requireVerifiedTreatwellFact('onlinePrepaymentProcessing');
    expect(processing.percent).toBe(2.5);
    expect(processing.vat).toBe('exclusive');
  });

  it('does not mistake trial invitations for a universal £0/month plan', () => {
    expect(TREATWELL_UK_COMMERCIAL_FACTS.softwareMonthlySubscription.status).toBe('unresolved');
    expect(TREATWELL_UK_COMMERCIAL_FACTS.newClientEligibility.status).toBe('unresolved');
    expect(() => requireVerifiedTreatwellFact('softwareMonthlySubscription')).toThrow(/unresolved/);
    expect(() => requireVerifiedTreatwellFact('newClientEligibility')).toThrow(/unresolved/);
  });

  it('keeps card-present payment rates separate from online prepayments', () => {
    expect(requireVerifiedTreatwellFact('tapToPayProcessing').percent).toBe(1.1);
    expect(requireVerifiedTreatwellFact('cardMachineProcessing').fixedGbp).toBe(0.20);
    expect(requireVerifiedTreatwellFact('cardMachineOneOff').amountGbp).toBe(199);
  });

  it('estimates published variable charges only when booking eligibility is explicit', () => {
    const newPayLater = estimateTreatwellPublishedBookingFees({
      servicePriceGbp: 30, eligibility: 'eligible-new-marketplace', onlinePrepaid: 'no',
    });
    expect(newPayLater).toMatchObject({
      commissionExVatGbp: 10.5, processingExVatGbp: 0, totalExVatGbp: 10.5,
      totalInclVatGbp: null, monthlySoftwareCostKnown: false, isPublishedRateIllustration: true,
    });
    expect(estimateTreatwellPublishedBookingFees({
      servicePriceGbp: 100, eligibility: 'eligible-new-marketplace', onlinePrepaid: 'yes', vatPercent: 20,
    })).toMatchObject({
      commissionExVatGbp: 35, processingExVatGbp: 2.5, totalExVatGbp: 37.5, totalInclVatGbp: 45,
    });
    expect(estimateTreatwellPublishedBookingFees({
      servicePriceGbp: 100, eligibility: 'repeat-or-direct', onlinePrepaid: 'no',
    }).totalExVatGbp).toBe(0);
    expect(estimateTreatwellPublishedBookingFees({
      servicePriceGbp: 100, eligibility: 'unknown', onlinePrepaid: 'no',
    }).totalExVatGbp).toBeNull();
    expect(estimateTreatwellPublishedBookingFees({
      servicePriceGbp: 100, eligibility: 'repeat-or-direct', onlinePrepaid: 'unknown',
    }).totalExVatGbp).toBeNull();
  });

  it('rejects invalid assumptions and amounts', () => {
    const valid = { servicePriceGbp: 30, eligibility: 'eligible-new-marketplace' as const, onlinePrepaid: 'yes' as const };
    expect(() => estimateTreatwellPublishedBookingFees({...valid, servicePriceGbp: -1})).toThrow();
    expect(() => estimateTreatwellPublishedBookingFees({...valid, servicePriceGbp: Number.NaN})).toThrow();
    expect(() => estimateTreatwellPublishedBookingFees({...valid, vatPercent: 101})).toThrow();
    expect(() => estimateTreatwellPublishedBookingFees({...valid, vatPercent: -1})).toThrow();
  });
});
