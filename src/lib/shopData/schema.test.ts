import { describe, expect, it } from 'vitest';
import {
  businessProfilePatchSchema,
  legacyHoursPayloadSchema,
  normaliseUkPostcode,
  openingExceptionSchema,
  openingHoursWeekSchema,
  pricePenceSchema,
  serviceFieldsSchema,
  validateWeeklyHoursRows,
} from './schema';
import { planShopBackfill } from './backfill';

const week = (overrides: Record<number, { isOpen?: boolean; opens?: string; closes?: string }> = {}) =>
  [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, isOpen: d < 7, opens: '09:00', closes: '18:00', ...overrides[d] }));

describe('shared shop data schema', () => {
  it('accepts UK postcodes leniently and normalises them', () => {
    expect(normaliseUkPostcode('sw1a1aa')).toBe('SW1A 1AA');
    expect(normaliseUkPostcode(' M1 1AE ')).toBe('M1 1AE');
    expect(normaliseUkPostcode('gir 0aa')).toBe('GIR 0AA');
    expect(normaliseUkPostcode('12345')).toBeNull();
    expect(businessProfilePatchSchema.parse({ postcode: 'ls16aa' }).postcode).toBe('LS1 6AA');
    expect(businessProfilePatchSchema.safeParse({ postcode: 'not a postcode' }).success).toBe(false);
    expect(businessProfilePatchSchema.parse({ postcode: '' }).postcode).toBeNull();
  });

  it('requires closing after opening on open days only', () => {
    expect(openingHoursWeekSchema.safeParse(week()).success).toBe(true);
    expect(openingHoursWeekSchema.safeParse(week({ 2: { closes: '08:00' } })).success).toBe(false);
    expect(openingHoursWeekSchema.safeParse(week({ 7: { isOpen: false, closes: '08:00' } })).success).toBe(true);
    expect(openingHoursWeekSchema.safeParse(week().slice(0, 6)).success).toBe(false);
    expect(openingHoursWeekSchema.safeParse(week({ 2: { opens: '9am' } })).success).toBe(false);
  });

  it('keeps the dashboard hours API shape and wording', () => {
    const rules = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, active: d === 1, startTime: '10:00', endTime: '09:00' }));
    expect(legacyHoursPayloadSchema.safeParse({ rules }).success).toBe(true);
    expect(validateWeeklyHoursRows(rules)).toBe('Day 1: end time must be later than start time.');
    expect(
      validateWeeklyHoursRows(rules.map((r) => ({ ...r, active: false })), { emptyMessage: 'Open the barbershop on at least one day.' }),
    ).toBe('Open the barbershop on at least one day.');
  });

  it('validates date exceptions', () => {
    expect(openingExceptionSchema.safeParse({ date: '2026-12-25', closed: true }).success).toBe(true);
    expect(openingExceptionSchema.safeParse({ date: '2026-12-24', closed: false, opens: '10:00', closes: '09:00' }).success).toBe(false);
  });

  it('rejects negative or fractional prices and empty names', () => {
    expect(pricePenceSchema.safeParse(-1).success).toBe(false);
    expect(pricePenceSchema.safeParse(10.5).success).toBe(false);
    expect(pricePenceSchema.safeParse(0).success).toBe(true);
    expect(serviceFieldsSchema.safeParse({ name: '  ', durationMinutes: 30, pricePence: 100 }).success).toBe(false);
  });
});

describe('planShopBackfill', () => {
  const base = {
    shopId: 's1',
    townCity: null,
    profile: null,
    onboarding: { shopDescription: 'From wizard', postcode: 'm11ae', townCity: 'Manchester', instagramUrl: null },
    previewRequest: { aboutText: 'From hub', instagramUrl: 'https://www.instagram.com/x/' },
    barbers: [],
  };

  it('fills empty fields, wizard first then hub', () => {
    const plan = planShopBackfill(base);
    expect(plan.profileFill).toEqual({
      description: 'From wizard',
      postcode: 'M1 1AE',
      instagramUrl: 'https://www.instagram.com/x/',
    });
    expect(plan.townCity).toBe('Manchester');
  });

  it('never overwrites a canonical value and is idempotent', () => {
    const plan = planShopBackfill({
      ...base,
      townCity: 'Salford',
      profile: { description: 'Owner wrote this', postcode: 'M1 1AE', instagramUrl: 'https://www.instagram.com/x/' },
    });
    expect(plan.profileFill).toEqual({});
    expect(plan.townCity).toBeNull();
  });

  it('copies barber bio only when the legacy row is newer', () => {
    const older = new Date('2026-01-01');
    const newer = new Date('2026-02-01');
    const plan = planShopBackfill({
      ...base,
      barbers: [
        { id: 'b1', bio: null, showOnWebsite: true, updatedAt: older, onboardingProfile: { bio: 'Hi', showOnWebsite: false, updatedAt: newer } },
        { id: 'b2', bio: 'Canonical', showOnWebsite: true, updatedAt: newer, onboardingProfile: { bio: 'Stale', showOnWebsite: false, updatedAt: older } },
      ],
    });
    expect(plan.barberUpdates).toEqual([{ id: 'b1', data: { bio: 'Hi', showOnWebsite: false } }]);
  });
});
