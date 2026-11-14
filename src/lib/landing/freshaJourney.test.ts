import { describe, expect, it } from 'vitest';
import { FRESHA_ESTIMATOR_CONFIG } from '@/lib/seo/freshaAlternativeContent';
import { estimateFreshaMonthlySubscription, estimateFreshaMarketplaceNewClientFee } from '@/lib/seo/freshaFacts';
import { describeEstimate, estimateFreshaBill, formatPounds } from './freshaJourney';

const config = FRESHA_ESTIMATOR_CONFIG;

describe('Fresha estimator maths', () => {
  it('matches the verified subscription helper for every team size it offers', () => {
    for (let barbers = 1; barbers <= config.maxBarbers; barbers += 1) {
      const estimate = estimateFreshaBill(config, { barbers, newClients: 0, firstVisitGbp: 25 });
      expect(estimate.freshaSubscriptionGbp).toBe(estimateFreshaMonthlySubscription(barbers).incVatGbp);
      expect(estimate.freshaMarketplaceGbp).toBe(0);
    }
  });

  it('adds VAT to one-time Marketplace fees, with the minimum applied per client', () => {
    const higher = estimateFreshaBill(config, { barbers: 1, newClients: 2, firstVisitGbp: 25 });
    expect(higher.freshaMarketplaceGbp).toBe(Math.round(estimateFreshaMarketplaceNewClientFee(25) * 2 * 1.2 * 100) / 100);
    const lower = estimateFreshaBill(config, { barbers: 1, newClients: 1, firstVisitGbp: 10 });
    expect(lower.freshaMarketplaceGbp).toBe(Math.round(config.marketplaceMinimumGbp * 1.2 * 100) / 100);
  });

  it('compares against the flat Full price and flags Starter eligibility', () => {
    const small = estimateFreshaBill(config, { barbers: 2, newClients: 0, firstVisitGbp: 25 });
    expect(small.kersivoFullGbp).toBe(config.kersivoFullGbp);
    expect(small.starterEligible).toBe(true);
    expect(estimateFreshaBill(config, { barbers: 5, newClients: 0, firstVisitGbp: 25 }).starterEligible).toBe(false);
  });

  it('says plainly when Fresha costs less on the numbers entered', () => {
    const solo = estimateFreshaBill(config, { barbers: 1, newClients: 0, firstVisitGbp: 25 });
    expect(solo.monthlyDifferenceGbp).toBeLessThan(0);
    expect(describeEstimate(solo)).toContain('cost less than Full KERSIVO');
    expect(describeEstimate(solo)).toContain('Starter');

    const team = estimateFreshaBill(config, { barbers: 8, newClients: 0, firstVisitGbp: 25 });
    expect(describeEstimate(team)).toMatch(/^On these numbers, Full KERSIVO comes to £[\d.,]+ less a month/);
    expect(describeEstimate(team)).toContain('before payment processing');
  });

  it('formats pounds the British way', () => {
    expect(formatPounds(1234.5)).toBe('£1,234.50');
  });
});
