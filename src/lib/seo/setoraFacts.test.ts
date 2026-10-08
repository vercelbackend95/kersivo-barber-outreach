import { describe, expect, it } from 'vitest';
import {
  SETORA_FACTS_CHECKED_ISO,
  SETORA_SOURCES,
  SETORA_UK_COMMERCIAL_FACTS,
  SETORA_COMPARE_SECTIONS,
  requireVerifiedSetoraFact,
  getSetoraSource,
} from './setoraFacts';

describe('Setora UK commercial source of truth', () => {
  it('anchors current price and trial to the main official pricing page', () => {
    expect(SETORA_FACTS_CHECKED_ISO).toBe('2026-10-08');
    expect(requireVerifiedSetoraFact('canonicalMonthlyGbp')).toMatchObject({value:59,unit:expect.stringContaining('per location')});
    expect(requireVerifiedSetoraFact('trialDays').value).toBe(14);
    expect(requireVerifiedSetoraFact('additionalStaffSubscriptionGbp').value).toBe(0);
    expect(requireVerifiedSetoraFact('platformBookingCommissionPercent').value).toBe(0);
    expect(getSetoraSource('pricing').url).toBe('https://www.setora.co.uk/pricing');
  });

  it('checks matching official prices and current VAT statement', () => {
    expect(requireVerifiedSetoraFact('barberLandingMonthlyGbp').value).toBe(59);
    expect(requireVerifiedSetoraFact('vatCurrentlyAdded').value).toBe(false);
    expect(getSetoraSource('barbers').url).toBe('https://www.setora.co.uk/barbershop-booking-software');
  });

  it('does NOT assert that an own domain purchase is included in Setora', () => {
    expect(SETORA_UK_COMMERCIAL_FACTS.ownDomainIncluded.status).toBe('unresolved');
    expect(()=>requireVerifiedSetoraFact('ownDomainIncluded')).toThrow(/unresolved/);
  });

  it('stores official source links and a checked date on every fact', () => {
    for (const fact of Object.values(SETORA_UK_COMMERCIAL_FACTS)) {
      expect(fact.checkedIso).toBe(SETORA_FACTS_CHECKED_ISO);
      expect(getSetoraSource(fact.sourceId).url).toMatch(/^https:\/\//);
    }
    expect(new Set(SETORA_SOURCES.map(x=>x.id)).size).toBe(SETORA_SOURCES.length);
    expect(SETORA_COMPARE_SECTIONS).toHaveLength(5);
    expect(SETORA_COMPARE_SECTIONS.every(x=>x.setoraPoints.length>=3 && x.kersivoPoints.length>=3)).toBe(true);
  });
});
