import { describe, expect, it } from 'vitest';

import { getDemoReportsResponse } from '../admin/demoFixtures/reports';
import { getLandingBookingsReportsData } from './landingBookingsReportsData';

describe('getLandingBookingsReportsData', () => {
  it('uses the same shared demo generator as admin-demo', () => {
    const landing = getLandingBookingsReportsData('1d');
    const adminDemo = getDemoReportsResponse('1d');
    expect(landing).toBe(adminDemo);
    expect(landing.range).toBe('1d');
    expect(landing.revenueSeries.length).toBeGreaterThanOrEqual(2);
    expect(landing.revenueSeries.every((point) => /^\d{2}:00$/.test(point.label))).toBe(true);
  });
});
