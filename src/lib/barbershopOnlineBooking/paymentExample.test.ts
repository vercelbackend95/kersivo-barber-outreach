import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_SERVICE_PRICE_PENCE,
  buildPaymentExample,
  formatGbp,
  starterPaymentOptions,
} from './paymentExample';

describe('Section 04 payment example', () => {
  const example = buildPaymentExample();
  const [deposit, full] = example.options;

  it('uses an illustrative £25 service with the fixed £5 Starter deposit and 0% KERSIVO fee', () => {
    expect(EXAMPLE_SERVICE_PRICE_PENCE).toBe(2500);
    expect(formatGbp(example.pricePence)).toBe('£25');
    expect(example.depositPence).toBe(500);
    expect(example.minimumPricePence).toBe(500);
    expect(example.platformFeeBps).toBe(0);
  });

  it('offers exactly two alternative choices for a £25 service', () => {
    expect(example.options.map((option) => [option.choice, option.label])).toEqual([
      ['DEPOSIT', 'Pay £5 deposit'],
      ['FULL', 'Pay in full'],
    ]);
  });

  it('£5 deposit leaves £20 at the shop and counts towards the £25 price', () => {
    expect(deposit).toEqual({ choice: 'DEPOSIT', label: 'Pay £5 deposit', nowPence: 500, atShopPence: 2000, totalPence: 2500 });
    expect(formatGbp(deposit.atShopPence)).toBe('£20');
  });

  it('paying in full leaves £0 at the shop', () => {
    expect(full).toEqual({ choice: 'FULL', label: 'Pay in full', nowPence: 2500, atShopPence: 0, totalPence: 2500 });
    expect(formatGbp(full.atShopPence)).toBe('£0');
  });

  it('never adds the deposit on top of the service price', () => {
    for (const option of example.options) {
      expect(option.nowPence + option.atShopPence).toBe(example.pricePence);
      expect(option.totalPence).toBe(example.pricePence);
    }
  });

  it('gives a £5 service one £5 full payment and rejects prices below £5', () => {
    expect(starterPaymentOptions(500)).toEqual([
      { choice: 'FULL', label: 'Pay in full', nowPence: 500, atShopPence: 0, totalPence: 500 },
    ]);
    expect(starterPaymentOptions(499)).toEqual([]);
    expect(starterPaymentOptions(0)).toEqual([]);
  });

  it('formats pence as pounds', () => {
    expect(formatGbp(0)).toBe('£0');
    expect(formatGbp(2050)).toBe('£20.50');
  });
});
