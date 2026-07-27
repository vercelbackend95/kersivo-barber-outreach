import { describe, expect, it } from 'vitest';
import { DEMO_SHOP_ID } from '../db/shopScope';
import { isPaidShop } from './paidShop';

describe('isPaidShop', () => {
  it('rejects demo shop', () => {
    expect(isPaidShop({ id: DEMO_SHOP_ID, shopPaidAt: new Date() })).toBe(false);
  });

  it('accepts shopPaidAt', () => {
    expect(isPaidShop({ id: 's1', shopPaidAt: new Date() })).toBe(true);
  });

  it('falls back to smsRemindersEnabled', () => {
    expect(isPaidShop({ id: 's1', shopPaidAt: null, smsRemindersEnabled: true })).toBe(true);
    expect(isPaidShop({ id: 's1', shopPaidAt: null, smsRemindersEnabled: false })).toBe(false);
  });
});
