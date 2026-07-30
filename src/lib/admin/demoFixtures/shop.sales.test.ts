import { describe, expect, it } from 'vitest';

import { getDemoRetailLedger, getDemoShopSalesResponse } from './shop';

const FIXED_NOW = new Date('2026-07-15T12:00:00.000Z');

describe('getDemoShopSalesResponse', () => {
  it('reconciles leaderboard revenue with KPI revenuePence', () => {
    const params = new URLSearchParams({ from: '2026-07-01', to: '2026-07-15' });
    const sales = getDemoShopSalesResponse(params, FIXED_NOW);
    const leaderboardSum = sales.leaderboard.reduce((sum, row) => sum + row.revenuePence, 0);
    expect(leaderboardSum).toBe(sales.kpis.revenuePence);
  });

  it('reconciles series overall sum with KPI revenuePence', () => {
    const params = new URLSearchParams({ from: '2026-07-01', to: '2026-07-15' });
    const sales = getDemoShopSalesResponse(params, FIXED_NOW);
    const seriesSum = sales.series.overall.reduce((sum, point) => sum + point.revenuePence, 0);
    expect(seriesSum).toBe(sales.kpis.revenuePence);
  });

  it('uses ORD- style public references', () => {
    const ledger = getDemoRetailLedger(FIXED_NOW);
    expect(ledger.length).toBeGreaterThan(0);
    for (const order of ledger.slice(0, 10)) {
      expect(order.reference).toMatch(/^ORD-[A-Z0-9]+$/i);
      expect(order.id).toBe(order.reference);
      expect(order.reference).not.toMatch(/demo-order/i);
    }
  });
});
