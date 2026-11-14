import { describe, expect, it } from 'vitest';
import { estimateMonthlyCommission, formatGbp, readRuleScenario } from './treatwellMath';

describe('treatwell page maths', () => {
  it('treats a lapsed marketplace client as new again at the published 35%', () => {
    expect(readRuleScenario({ monthsSinceVisit: 15, channel: 'marketplace', priceGbp: 25 })).toEqual({
      status: 'new-again', commissionExVatGbp: 8.75, commissionInclVatGbp: 10.5,
    });
  });
  it('charges 0% marketplace commission within 365 days and on direct bookings', () => {
    expect(readRuleScenario({ monthsSinceVisit: 12, channel: 'marketplace', priceGbp: 25 }).status).toBe('repeat');
    expect(readRuleScenario({ monthsSinceVisit: 20, channel: 'direct', priceGbp: 25 })).toMatchObject({ status: 'direct', commissionExVatGbp: 0 });
  });
  it('estimates a month of eligible new marketplace clients', () => {
    expect(estimateMonthlyCommission({ newClients: 10, firstVisitGbp: 25 })).toEqual({ exVatGbp: 87.5, inclVatGbp: 105, yearlyInclVatGbp: 1260 });
    expect(estimateMonthlyCommission({ newClients: 0, firstVisitGbp: 25 }).inclVatGbp).toBe(0);
  });
  it('formats pounds without trailing pence on whole numbers', () => {
    expect(formatGbp(105)).toBe('£105');
    expect(formatGbp(87.5)).toBe('£87.50');
    expect(formatGbp(1260)).toBe('£1,260');
  });
});
