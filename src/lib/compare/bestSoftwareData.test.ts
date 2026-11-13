import { describe, expect, it } from 'vitest';
import { HUB_CRITERION_IDS } from '@/lib/compare/alternativesHubCriteria';
import { COMPETITOR_HUB_PLATFORMS } from '@/lib/compare/alternativesHubData';
import { estimateBooksyMonthlySubscription } from '@/lib/seo/booksyFacts';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { estimateFreshaMonthlySubscription } from '@/lib/seo/freshaFacts';
import {
  CONTROL_CRITERIA,
  COST_METER_DEFAULT_BARBERS,
  COST_METER_MAX_BARBERS,
  COST_METER_NOTE,
  COST_METER_ROWS,
  DUEL_CRITERIA,
  DUEL_DEFAULT_ID,
  NEW_CLIENT_FEE_NOTE,
  NEW_CLIENT_FEE_ROWS,
  costMeterValue,
  costMeterYearlyGap,
  newClientFee,
  referenceNewClientFee,
} from './bestSoftwareData';

describe('best barber software data', () => {
  it('derives every cost meter figure from the facts modules', () => {
    const [kersivo, , booksy, fresha] = COST_METER_ROWS;
    expect(kersivo.isFirstParty).toBe(true);
    for (let n = 1; n <= COST_METER_MAX_BARBERS; n += 1) {
      expect(costMeterValue(kersivo, n)).toBe(SAAS_MONTHLY_GBP);
      expect(costMeterValue(booksy, n)).toBe(estimateBooksyMonthlySubscription(n).incVatGbp);
      expect(costMeterValue(fresha, n)).toBe(estimateFreshaMonthlySubscription(n).incVatGbp);
    }
    expect(COST_METER_DEFAULT_BARBERS).toBe(5);
    expect(costMeterYearlyGap(5).gbp).toBeGreaterThan(0);
    expect(COST_METER_NOTE).toMatch(/Subscription only/);
  });

  it('matches the facts modules’ own new-client fee estimators', () => {
    for (const price of [10, 18, 25, 40, 60]) {
      for (const row of NEW_CLIENT_FEE_ROWS) {
        const reference = referenceNewClientFee(row.id, price);
        if (reference !== null) expect(newClientFee(row, price), `${row.id} at £${price}`).toBe(reference);
      }
    }
    expect(newClientFee(NEW_CLIENT_FEE_ROWS[0], 25)).toBe(0);
  });

  it('keeps 0% KERSIVO commission next to the Stripe fees note', () => {
    const kersivo = NEW_CLIENT_FEE_ROWS.find((row) => row.isFirstParty)!;
    expect(kersivo.when).toMatch(/0% KERSIVO commission.*Stripe fees apply/);
    expect(NEW_CLIENT_FEE_NOTE).toMatch(/Card processing is separate/);
  });

  it('uses real criteria ids and a real default competitor', () => {
    for (const c of [...DUEL_CRITERIA, ...CONTROL_CRITERIA]) expect(HUB_CRITERION_IDS).toContain(c.id);
    expect(COMPETITOR_HUB_PLATFORMS.map((p) => p.id)).toContain(DUEL_DEFAULT_ID);
  });
});
