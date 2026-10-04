import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_SHOP_ID } from '../db/shopScope';
import { canSellRetail, evaluateRetailSelling } from '../shop/cardPaymentsGate';
import { accessForState, resolveKersivoAccess } from '../shop/kersivoAccess';
import { canTakeBookingPayments, evaluateBookingPayments } from './bookingPaymentsGate';
import { canCollectBookingDeposit } from './depositGate';

const NOW = new Date('2026-10-04T12:00:00.000Z');

function shop(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shop_1',
    shopPaidAt: null as Date | null,
    smsRemindersEnabled: false,
    freeBookingActivatedAt: null as Date | null,
    stripeConnectAccountId: 'acct_ready' as string | null,
    stripeConnectChargesEnabled: true,
    retailEnabled: false,
    depositsEnabled: false,
    ...overrides,
  };
}

const freeShop = (overrides: Record<string, unknown> = {}) =>
  shop({ freeBookingActivatedAt: new Date('2026-10-01T00:00:00.000Z'), ...overrides });
const fullShop = (overrides: Record<string, unknown> = {}) =>
  shop({ shopPaidAt: new Date('2026-01-01T00:00:00.000Z'), ...overrides });

function evaluate(s: ReturnType<typeof shop>) {
  return evaluateBookingPayments({ shop: s, access: resolveKersivoAccess(s, null, NOW) });
}

describe('bookingPaymentsGate', () => {
  it('J: SETUP shop is denied even with Connect ready', () => {
    const s = shop();
    expect(resolveKersivoAccess(s, null, NOW).state).toBe('SETUP');
    expect(evaluate(s)).toEqual({ ok: false, reason: 'no_booking_payments_capability' });
  });

  it('K: FREE_BOOKING with Connect ready is technically eligible', () => {
    const s = freeShop();
    expect(resolveKersivoAccess(s, null, NOW).state).toBe('FREE_BOOKING');
    expect(evaluate(s)).toEqual({ ok: true, reason: 'ok' });
    expect(canTakeBookingPayments({ shop: s, access: resolveKersivoAccess(s, null, NOW) })).toBe(true);
  });

  it('L: FULL_KERSIVO with Connect ready is eligible', () => {
    const s = fullShop();
    expect(resolveKersivoAccess(s, null, NOW).state).toBe('FULL_KERSIVO');
    expect(evaluate(s)).toEqual({ ok: true, reason: 'ok' });
  });

  it('M: Free without Connect is denied (connect_missing / connect_not_ready)', () => {
    expect(evaluate(freeShop({ stripeConnectAccountId: null }))).toEqual({
      ok: false,
      reason: 'connect_missing',
    });
    expect(evaluate(freeShop({ stripeConnectAccountId: '   ' }))).toEqual({
      ok: false,
      reason: 'connect_missing',
    });
    expect(evaluate(freeShop({ stripeConnectChargesEnabled: false }))).toEqual({
      ok: false,
      reason: 'connect_not_ready',
    });
  });

  it('N: demo shop is denied, even if handed Full access', () => {
    const s = fullShop({ id: DEMO_SHOP_ID });
    expect(
      evaluateBookingPayments({ shop: s, access: accessForState('FULL_KERSIVO') }),
    ).toEqual({ ok: false, reason: 'demo_shop' });
    expect(evaluate(s).ok).toBe(false);
  });

  it('is not wired into live deposit collection yet (Free still cannot collect legacy deposits)', () => {
    const s = freeShop({ depositsEnabled: true });
    expect(evaluate(s).ok).toBe(true);
    expect(canCollectBookingDeposit(s)).toBe(false);

    const serviceSource = readFileSync(resolve(__dirname, 'service.ts'), 'utf8');
    expect(serviceSource).not.toMatch(/bookingPaymentsGate/);
  });
});

describe('Retail remains FULL_KERSIVO-only', () => {
  it('O: FREE_BOOKING + Connect ready + retailEnabled is still denied Retail', () => {
    const s = freeShop({ retailEnabled: true });
    expect(evaluate(s).ok).toBe(true);
    expect(canSellRetail(s)).toBe(false);
    expect(evaluateRetailSelling(s)).toEqual({ ok: false, reason: 'unpaid_shop' });
  });

  it('Full + Connect ready + retailEnabled can still sell Retail', () => {
    expect(canSellRetail(fullShop({ retailEnabled: true }))).toBe(true);
  });
});
