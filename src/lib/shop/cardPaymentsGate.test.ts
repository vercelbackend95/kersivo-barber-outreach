import { describe, expect, it } from 'vitest';
import { BLACKLINE_SHOP_ID } from '../demo/products';
import { DEMO_SHOP_ID } from '../db/shopScope';
import {
  canSellRetail,
  canShopTakeCardPayments,
  evaluateRetailSelling,
} from './cardPaymentsGate';
import { canCollectBookingDeposit, evaluateDepositCollection } from '../booking/depositGate';

const readyBase = {
  id: 'shop-paid-1',
  shopPaidAt: new Date('2026-07-01T00:00:00.000Z'),
  smsRemindersEnabled: true,
  stripeConnectAccountId: 'acct_test',
  stripeConnectChargesEnabled: true,
};

describe('cardPaymentsGate', () => {
  it('allows card payments when paid + Connect ready', () => {
    expect(canShopTakeCardPayments(readyBase)).toBe(true);
  });

  it('blocks demo / unpaid / connect gaps', () => {
    expect(canShopTakeCardPayments({ ...readyBase, id: DEMO_SHOP_ID })).toBe(false);
    expect(canShopTakeCardPayments({ ...readyBase, id: BLACKLINE_SHOP_ID })).toBe(false);
    expect(
      canShopTakeCardPayments({
        ...readyBase,
        shopPaidAt: null,
        smsRemindersEnabled: false,
      }),
    ).toBe(false);
    expect(canShopTakeCardPayments({ ...readyBase, stripeConnectAccountId: null })).toBe(false);
    expect(canShopTakeCardPayments({ ...readyBase, stripeConnectChargesEnabled: false })).toBe(
      false,
    );
  });

  it('canSellRetail requires retailEnabled on top of card payments', () => {
    expect(canSellRetail({ ...readyBase, retailEnabled: false })).toBe(false);
    expect(evaluateRetailSelling({ ...readyBase, retailEnabled: false })).toEqual({
      ok: false,
      reason: 'retail_disabled',
    });
    expect(canSellRetail({ ...readyBase, retailEnabled: true })).toBe(true);
    expect(evaluateRetailSelling({ ...readyBase, retailEnabled: true })).toEqual({
      ok: true,
      reason: 'ok',
    });
  });

  it('deposit gate still composes depositsEnabled on shared card payments', () => {
    expect(
      canCollectBookingDeposit({ ...readyBase, depositsEnabled: true }),
    ).toBe(true);
    expect(
      evaluateDepositCollection({ ...readyBase, depositsEnabled: false }),
    ).toEqual({ ok: false, reason: 'deposits_disabled' });
    expect(
      evaluateDepositCollection({
        ...readyBase,
        depositsEnabled: true,
        stripeConnectAccountId: null,
      }),
    ).toEqual({ ok: false, reason: 'connect_missing' });
  });
});
