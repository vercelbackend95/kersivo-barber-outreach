import { describe, expect, it } from 'vitest';
import { formatMoneyGbp, gbpToPence, multiplyGbp, penceToGbp, percentOfPence, roundGbp } from './money';

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

  it('formats GBP with two decimals independent of locale', () => {
    expect(formatMoneyGbp(0)).toBe('£0.00');
    expect(formatMoneyGbp(5)).toBe('£5.00');
    expect(formatMoneyGbp(35.82)).toBe('£35.82');
    expect(formatMoneyGbp(35.8)).toBe('£35.80');
    expect(formatMoneyGbp(0.1 + 0.2)).toBe('£0.30');
  });

  it('groups thousands for large projected values', () => {
    expect(formatMoneyGbp(999.99)).toBe('£999.99');
    expect(formatMoneyGbp(1234.5)).toBe('£1,234.50');
    expect(formatMoneyGbp(12345.67)).toBe('£12,345.67');
    expect(formatMoneyGbp(1234567.8)).toBe('£1,234,567.80');
  });

  it('returns two-decimal pounds', () => {
    expect(penceToGbp(2001)).toBe(20.01);
    expect(roundGbp(19.998)).toBe(20);
    expect(roundGbp(0.1 + 0.2)).toBe(0.3);
  });

  it('multiplies by whole periods exactly via integer pence', () => {
    expect(multiplyGbp(20.01, 12)).toBe(240.12);
    expect(formatMoneyGbp(multiplyGbp(20.01, 12))).toBe('£240.12');
    expect(multiplyGbp(35.82, 36)).toBe(1289.52);
    expect(multiplyGbp(0.1 + 0.2, 12)).toBe(3.6);
    expect(multiplyGbp(9.95, 1)).toBe(9.95);
    expect(multiplyGbp(0, 36)).toBe(0);
    expect(() => multiplyGbp(10, 1.5)).toThrow();
  });
});
