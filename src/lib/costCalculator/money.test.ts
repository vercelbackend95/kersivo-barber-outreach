import { describe, expect, it } from 'vitest';
import { gbpToPence, penceToGbp, percentOfPence, roundGbp } from './money';

describe('calculator money helpers', () => {
  it('converts pounds to integer pence without floating-point drift', () => {
    expect(gbpToPence(14.95)).toBe(1495);
    expect(gbpToPence(9.95 * 3)).toBe(2985);
    expect(gbpToPence(0.1 + 0.2)).toBe(30);
    expect(gbpToPence(1.005)).toBe(101);
    expect(gbpToPence(12.345)).toBe(1235);
  });

  it('rounds percentages of pence half-up', () => {
    expect(percentOfPence(2500, 30)).toBe(750);
    expect(percentOfPence(3333, 30)).toBe(1000);
    expect(percentOfPence(3333, 20)).toBe(667);
    expect(percentOfPence(1495, 20)).toBe(299);
    expect(percentOfPence(25, 50)).toBe(13);
    expect(percentOfPence(1000, 1.4)).toBe(14);
  });

  it('returns two-decimal pounds', () => {
    expect(penceToGbp(2001)).toBe(20.01);
    expect(roundGbp(19.998)).toBe(20);
    expect(roundGbp(0.1 + 0.2)).toBe(0.3);
  });
});
