import { describe, expect, it } from 'vitest';
import { estimateBill, estimateBoost, formatGbp } from './booksyMath';

describe('booksy page maths', () => {
  it('prices Booksy as base plus additional users, plus VAT, against a flat Full KERSIVO', () => {
    expect(estimateBill(1)).toMatchObject({ booksyExVatGbp: 40, booksyVatGbp: 8, booksyIncVatGbp: 48, kersivoFullGbp: 39, starterEligible: true, yearlyDifferenceGbp: 108 });
    expect(estimateBill(5)).toMatchObject({ additionalUsers: 4, booksyExVatGbp: 60, booksyIncVatGbp: 72, starterEligible: false, yearlyDifferenceGbp: 396 });
    expect(estimateBill(10).booksyIncVatGbp).toBe(102);
  });

  it('clamps the team size to the slider range', () => {
    expect(estimateBill(0).teamSize).toBe(1);
    expect(estimateBill(40).teamSize).toBe(12);
  });

  it('charges the Boost percentage with the minimum, only per new Boost client', () => {
    expect(estimateBoost({ newClients: 4, firstVisitGbp: 25 })).toEqual({ perClientExVatGbp: 7.5, monthlyExVatGbp: 30, monthlyIncVatGbp: 36, yearlyIncVatGbp: 432 });
    expect(estimateBoost({ newClients: 2, firstVisitGbp: 12 }).perClientExVatGbp).toBe(5);
    expect(estimateBoost({ newClients: 0, firstVisitGbp: 25 }).monthlyIncVatGbp).toBe(0);
  });

  it('formats pounds without trailing pence on whole numbers', () => {
    expect(formatGbp(48)).toBe('£48');
    expect(formatGbp(7.5)).toBe('£7.50');
    expect(formatGbp(1260)).toBe('£1,260');
  });
});
