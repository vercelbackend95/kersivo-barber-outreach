import { describe, expect, it } from 'vitest';
import {
  DEMO_HOURS,
  DEMO_LOCATION,
  DEMO_LOCATION_NOTE,
  DEMO_PHONE,
  DEMO_PHONE_ACCESSIBLE_NAME,
  DEMO_PHONE_FICTION_NOTE,
  DEMO_PHONE_NOTE,
  DEMO_PHONE_TEL,
  DEMO_WALK_INS,
} from './site';

const PROFILE_TEXT = [
  DEMO_LOCATION,
  DEMO_LOCATION_NOTE,
  DEMO_PHONE,
  DEMO_PHONE_TEL,
  DEMO_PHONE_NOTE,
  DEMO_WALK_INS,
  ...DEMO_HOURS.flatMap((row) => [row.days, row.hours]),
].join(' ');

describe('BLACKLINE demo business profile', () => {
  it('uses the fictional Northern Quarter demonstration location without a street or postcode', () => {
    expect(DEMO_LOCATION).toBe('Northern Quarter, Manchester');
    expect(DEMO_LOCATION_NOTE).toBe('Demonstration location');
    expect(DEMO_LOCATION).not.toMatch(/\b(street|road|lane|postcode)\b/i);
    expect(DEMO_LOCATION).not.toMatch(/\bM\d/i);
  });

  it('uses the reserved Ofcom Manchester drama number', () => {
    expect(DEMO_PHONE).toBe('0161 496 0127');
    expect(DEMO_PHONE_TEL).toBe('tel:+441614960127');
    expect(DEMO_PHONE_ACCESSIBLE_NAME).toBe('Call BLACKLINE demo number 0161 496 0127');
    expect(DEMO_PHONE_NOTE.toLowerCase()).not.toContain('disabled');
    expect(DEMO_PHONE_FICTION_NOTE).toBe('Fictional Manchester demo number');
  });

  it('exposes opening hours that include weekday 09:00 starts', () => {
    expect(DEMO_HOURS).toEqual([
      { days: 'Monday–Friday', hours: '09:00–19:00' },
      { days: 'Saturday', hours: '09:00–17:00' },
      { days: 'Sunday', hours: 'Closed' },
    ]);
  });

  it('keeps the qualified walk-in statement', () => {
    expect(DEMO_WALK_INS).toBe('Walk-ins welcome when availability allows.');
    expect(DEMO_WALK_INS.toLowerCase()).not.toContain('always');
    expect(DEMO_WALK_INS.toLowerCase()).not.toContain('guaranteed');
  });

  it('does not reference an external map service', () => {
    expect(PROFILE_TEXT.toLowerCase()).not.toMatch(
      /google\.com\/maps|maps\.apple|mapbox|openstreetmap|bing\.com\/maps|iframe/,
    );
  });
});
