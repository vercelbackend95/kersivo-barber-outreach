import { describe, expect, it } from 'vitest';

import { getHeritageReportsResponse } from '../admin/heritageDemoFixtures/reports';
import {
  getLandingBookingsReportsData,
  landingBookingsReportsBarbers,
} from './landingBookingsReportsData';

describe('getLandingBookingsReportsData', () => {
  it('uses the same Heritage Grooming generator as the demo owner dashboard', () => {
    const landing = getLandingBookingsReportsData('1d');
    const adminDemo = getHeritageReportsResponse('1d');
    expect(landing).toEqual(adminDemo);
    expect(landing.range).toBe('1d');
    // Before London open+1h, 1d hourly series is just the open hour (09:00).
    expect(landing.revenueSeries.length).toBeGreaterThanOrEqual(1);
    expect(landing.revenueSeries.every((point) => /^\d{2}:00$/.test(point.label))).toBe(true);
  });

  it('gives demo barbers with todayShiftWindow canonical null break fields', () => {
    const withShift = landingBookingsReportsBarbers.filter((barber) => barber.todayShiftWindow);
    expect(withShift.length).toBeGreaterThan(0);
    for (const barber of withShift) {
      expect(barber.todayShiftWindow).toEqual(
        expect.objectContaining({
          breakStartMin: null,
          breakEndMin: null,
        }),
      );
    }
  });
});
