import { describe, expect, it } from 'vitest';
import { DEMO_SHOP_ID } from '../db/shopScope';
import {
  BOOKING_DEPOSIT_PENCE,
  canCollectBookingDeposit,
  evaluateDepositCollection,
  resolveBookingDepositPence,
} from './depositGate';

const readyShop = {
  id: 'shop-paid-1',
  shopPaidAt: new Date('2026-07-01T00:00:00.000Z'),
  smsRemindersEnabled: true,
  depositsEnabled: true,
  stripeConnectAccountId: 'acct_test',
  stripeConnectChargesEnabled: true,
};

describe('depositGate', () => {
  it('caps deposit at £5', () => {
    expect(BOOKING_DEPOSIT_PENCE).toBe(500);
  });

  it('resolves deposit as min(service price, £5)', () => {
    expect(resolveBookingDepositPence(0)).toBe(0);
    expect(resolveBookingDepositPence(300)).toBe(300);
    expect(resolveBookingDepositPence(500)).toBe(500);
    expect(resolveBookingDepositPence(2500)).toBe(500);
    expect(resolveBookingDepositPence(-100)).toBe(0);
    expect(resolveBookingDepositPence(399.9)).toBe(399);
  });

  it('allows collection when paid + toggle + Connect ready', () => {
    expect(canCollectBookingDeposit(readyShop)).toBe(true);
    expect(evaluateDepositCollection(readyShop)).toEqual({ ok: true, reason: 'ok' });
  });

  it('blocks demo shop', () => {
    expect(
      evaluateDepositCollection({ ...readyShop, id: DEMO_SHOP_ID }),
    ).toEqual({ ok: false, reason: 'demo_shop' });
  });

  it('blocks unpaid shop', () => {
    expect(
      evaluateDepositCollection({
        ...readyShop,
        shopPaidAt: null,
        smsRemindersEnabled: false,
      }),
    ).toEqual({ ok: false, reason: 'unpaid_shop' });
  });

  it('blocks when deposits disabled', () => {
    expect(
      evaluateDepositCollection({ ...readyShop, depositsEnabled: false }),
    ).toEqual({ ok: false, reason: 'deposits_disabled' });
  });

  it('blocks when Connect missing or not ready', () => {
    expect(
      evaluateDepositCollection({ ...readyShop, stripeConnectAccountId: null }),
    ).toEqual({ ok: false, reason: 'connect_missing' });
    expect(
      evaluateDepositCollection({ ...readyShop, stripeConnectChargesEnabled: false }),
    ).toEqual({ ok: false, reason: 'connect_not_ready' });
  });
});
