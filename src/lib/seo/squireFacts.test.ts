import { describe, expect, it } from 'vitest';
import {
  SQUIRE_FACTS_CHECKED_ISO,
  SQUIRE_UK_COMMERCIAL_FACTS,
  SQUIRE_UK_PLAN_SUBSCRIPTION_KEYS,
  SQUIRE_US_LIST_PLANS,
  SQUIRE_UNVERIFIED_GBP_REPORTS,
  SQUIRE_OFFICIAL_SOURCES,
  getSquireSource,
  isVerifiedSquireUkFact,
  requireVerifiedSquireUkFact,
  getSquireUkCalculatorReadiness,
} from './squireFacts';

describe('SQUIRE shared commercial facts: UK calculator readiness', () => {
  it('does not promote unconfirmed third-party GBP reports as verified UK prices', () => {
    expect(SQUIRE_US_LIST_PLANS.map(plan => plan.usdMonthly)).toEqual([30, 50, 150, 250]);
    expect(SQUIRE_UNVERIFIED_GBP_REPORTS.map(plan => plan.reportedMonthlyGbp)).toEqual([20, 30, 60, 90]);
    expect(SQUIRE_UNVERIFIED_GBP_REPORTS.map(plan => plan.status)).toEqual(['unverified','unverified','unverified','unverified']);
    expect(SQUIRE_UNVERIFIED_GBP_REPORTS.map(plan => plan.id)).toEqual(SQUIRE_US_LIST_PLANS.map(plan => plan.id));
    for (const fact of Object.values(SQUIRE_UK_COMMERCIAL_FACTS)) {
      expect(fact.checkedIso).toBe(SQUIRE_FACTS_CHECKED_ISO);
      expect(getSquireSource(fact.sourceId).url).toMatch(/^https:\/\/(www\.)?getsquire\.com\//);
      expect(fact.status).toBe('unresolved');
      expect(isVerifiedSquireUkFact(fact)).toBe(false);
      expect(fact).not.toHaveProperty('amountGbp');
      expect(fact).not.toHaveProperty('percent');
    }
  });

  it('contains plan-specific subscription keys and explicit fee inputs needed for a future calculator', () => {
    expect(Object.keys(SQUIRE_UK_PLAN_SUBSCRIPTION_KEYS).sort()).toEqual(
      SQUIRE_US_LIST_PLANS.map(plan=>plan.id).sort(),
    );
    for(const field of [
      'additionalBarberFee', 'onlineDepositProcessing', 'bookingOrPlatformFee',
      'acquisitionFee', 'inPersonProcessing', 'brandedLandingPageAddOn'
    ]) {
      expect(SQUIRE_UK_COMMERCIAL_FACTS).toHaveProperty(field);
    }
  });

  it('does not treat unverified UK prices as a calculated subscription or VAT-inclusive bill', () => {
    for (const plan of SQUIRE_US_LIST_PLANS) {
      const status = getSquireUkCalculatorReadiness(plan.id);
      expect(status.status).toBe('unresolved-uk-pricing');
      expect(status.currency).toBe('GBP');
      expect(status.plan).toBe(plan.id);
      expect(status.missingFacts).toContain(SQUIRE_UK_PLAN_SUBSCRIPTION_KEYS[plan.id]);
      expect(status.missingFacts).toContain('onlineDepositProcessing');
    }
    expect(() => requireVerifiedSquireUkFact('proSubscription')).toThrow(/not been verified/);
    expect(() => requireVerifiedSquireUkFact('onlineDepositProcessing')).toThrow(/not been verified/);
  });

  it('keeps traceable, unique first-party sources', () => {
    const sourceIds = SQUIRE_OFFICIAL_SOURCES.map(source => source.id);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    SQUIRE_OFFICIAL_SOURCES.forEach(source => {
      expect(source.supports.length).toBeGreaterThan(15);
      expect(source.url).toMatch(/^https:\/\//);
    });
  });
});
