import { describe, expect, it } from 'vitest';
import { describeEstimate, estimateBill } from './timelyAlternative';
import { BUILDER_CONFIG } from '@/lib/seo/timelyAlternativeContent';

const base = { barbers: 3, bookingsPerWeek: 60, actualWeeklyGbp: 0 };

describe('/timely-alternative bill builder', () => {
  it('picks the lowest Timely plan that covers every ticked feature', () => {
    expect(estimateBill(BUILDER_CONFIG, { ...base, features: ['online-booking', 'deposits'] }).tierId).toBe('run');
    expect(estimateBill(BUILDER_CONFIG, { ...base, features: ['deposits', 'brand'] }).tierId).toBe('boost');
    const thrive = estimateBill(BUILDER_CONFIG, { ...base, features: ['brand', 'rebooking', 'team-targets'] });
    expect(thrive.tierId).toBe('thrive');
    expect(thrive.needsTeamAddOn).toBe(true);
    expect(thrive.timelyFromWeeklyGbp).toBe(17);
    expect(thrive.timelyFromMonthlyGbp).toBe(73.67);
  });

  it('only charges Full KERSIVO when a Full feature or more than four barbers is needed', () => {
    expect(estimateBill(BUILDER_CONFIG, { ...base, features: ['online-booking', 'deposits'] }).kersivoMonthlyGbp).toBe(0);
    expect(estimateBill(BUILDER_CONFIG, { ...base, barbers: 6, features: ['online-booking'] }).kersivoPlan).toBe('full');
    expect(estimateBill(BUILDER_CONFIG, { ...base, features: ['website'] }).kersivoMonthlyGbp).toBe(39);
  });

  it('never claims a saving without the shop’s own Timely invoice', () => {
    const estimate = estimateBill(BUILDER_CONFIG, { ...base, features: ['website', 'brand'] });
    expect(estimate.monthlyDifferenceGbp).toBeNull();
    expect(estimate.timelyPerBookingGbp).toBeNull();
    expect(describeEstimate(estimate)).toContain('Add your weekly Timely invoice');
  });

  it('compares a real weekly invoice both ways and lists what KERSIVO lacks', () => {
    const dearer = estimateBill(BUILDER_CONFIG, { ...base, actualWeeklyGbp: 20, features: ['website', 'waitlist'] });
    expect(dearer.timelyActualMonthlyGbp).toBe(86.67);
    expect(dearer.monthlyDifferenceGbp).toBe(47.67);
    expect(describeEstimate(dearer)).toContain('less a month');
    expect(dearer.missingInKersivo).toEqual(['Waitlist']);
    const cheaper = estimateBill(BUILDER_CONFIG, { ...base, actualWeeklyGbp: 5, features: ['website'] });
    expect(describeEstimate(cheaper)).toMatch(/^On your real invoice, Timely costs/);
  });
});
