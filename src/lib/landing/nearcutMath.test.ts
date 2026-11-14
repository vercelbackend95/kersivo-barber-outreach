import { describe, expect, it } from 'vitest';
import {
  NEARCUT_BOOKINGS_MAX,
  NEARCUT_BOOKINGS_MIN,
  NEARCUT_EXAMPLE_CHARGE_GBP,
  clampBookings,
  estimateNearcutClientCharges,
  formatGbpWhole,
} from './nearcutMath';

describe('nearcut estimator maths', () => {
  it('uses Nearcut’s illustrative £1.50 example charge', () => {
    expect(NEARCUT_EXAMPLE_CHARGE_GBP).toBe(1.5);
  });

  it('multiplies bookings by the example charge and keeps KERSIVO flat', () => {
    const e = estimateNearcutClientCharges(200);
    expect(e.clientChargesMonthly).toBe(300);
    expect(e.clientChargesYearly).toBe(3600);
    expect(e.kersivoClientCharges).toBe(0);
    expect(e.kersivoMonthly).toBe(39);
    expect(estimateNearcutClientCharges(800).kersivoMonthly).toBe(39);
  });

  it('clamps out-of-range and invalid input', () => {
    expect(clampBookings(1)).toBe(NEARCUT_BOOKINGS_MIN);
    expect(clampBookings(99999)).toBe(NEARCUT_BOOKINGS_MAX);
    expect(clampBookings(Number.NaN)).toBe(240);
    expect(clampBookings(120.6)).toBe(121);
  });

  it('formats whole pounds in en-GB', () => {
    expect(formatGbpWhole(3600)).toBe('£3,600');
  });
});
