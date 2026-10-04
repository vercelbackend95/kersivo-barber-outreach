import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirstBooking = vi.fn();

vi.mock('../db/client', () => ({
  prisma: {
    booking: { findFirst: (...args: unknown[]) => findFirstBooking(...args) },
  },
}));

import {
  isMissingRequiredPaymentAccountSnapshot,
  resolveBookingPaymentAccount,
  resolveCheckoutSessionPaymentAccount,
} from './bookingPaymentAccount';

describe('resolveBookingPaymentAccount', () => {
  it('uses the Booking snapshot over the current shop account', () => {
    expect(
      resolveBookingPaymentAccount({
        booking: { stripeConnectAccountIdAtPayment: 'acct_original', kersivoPlatformFeePence: 5 },
        currentShopAccountId: 'acct_new',
      }),
    ).toEqual({ ok: true, accountId: 'acct_original', source: 'snapshot' });
  });

  it('Q: legacy 0%-fee row without a snapshot falls back to the current shop account', () => {
    for (const fee of [0, null, undefined]) {
      expect(
        resolveBookingPaymentAccount({
          booking: { stripeConnectAccountIdAtPayment: null, kersivoPlatformFeePence: fee },
          currentShopAccountId: ' acct_current ',
        }),
      ).toEqual({ ok: true, accountId: 'acct_current', source: 'legacy_shop_account' });
    }
  });

  it('fee-bearing row without a snapshot is an integrity failure (no fallback)', () => {
    const booking = { stripeConnectAccountIdAtPayment: null, kersivoPlatformFeePence: 5 };
    expect(isMissingRequiredPaymentAccountSnapshot(booking)).toBe(true);
    expect(resolveBookingPaymentAccount({ booking, currentShopAccountId: 'acct_current' })).toEqual({
      ok: false,
      reason: 'missing_payment_account_snapshot',
    });
  });

  it('requireSnapshot (new paid bookings) never falls back', () => {
    expect(
      resolveBookingPaymentAccount({
        booking: { stripeConnectAccountIdAtPayment: '  ', kersivoPlatformFeePence: 0 },
        currentShopAccountId: 'acct_current',
        requireSnapshot: true,
      }),
    ).toEqual({ ok: false, reason: 'missing_payment_account_snapshot' });
  });

  it('legacy row with no shop account either has no account', () => {
    expect(
      resolveBookingPaymentAccount({ booking: {}, currentShopAccountId: null }),
    ).toEqual({ ok: false, reason: 'no_connect_account' });
  });
});

describe('resolveCheckoutSessionPaymentAccount (success page + calendar)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('L: finds the Booking by stored session id within the shop and uses its snapshot', async () => {
    findFirstBooking.mockResolvedValue({
      stripeConnectAccountIdAtPayment: 'acct_original',
      kersivoPlatformFeePence: 5,
    });

    const result = await resolveCheckoutSessionPaymentAccount({
      shopId: 'shop_1',
      sessionId: 'cs_1',
      currentShopAccountId: 'acct_new',
    });

    expect(result).toEqual({ ok: true, accountId: 'acct_original', source: 'snapshot' });
    expect(findFirstBooking).toHaveBeenCalledWith({
      where: { stripeCheckoutSessionId: 'cs_1', barber: { shopId: 'shop_1' } },
      select: { stripeConnectAccountIdAtPayment: true, kersivoPlatformFeePence: true },
    });
  });

  it('Q: legacy booking (null snapshot) uses the current shop account', async () => {
    findFirstBooking.mockResolvedValue({ stripeConnectAccountIdAtPayment: null, kersivoPlatformFeePence: 0 });
    expect(
      await resolveCheckoutSessionPaymentAccount({
        shopId: 'shop_1',
        sessionId: 'cs_1',
        currentShopAccountId: 'acct_current',
      }),
    ).toEqual({ ok: true, accountId: 'acct_current', source: 'legacy_shop_account' });
  });
});

describe('book/[shopId]/success.astro payment account (static)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '../../pages/book/[shopId]/success.astro'), 'utf8');

  it('L: retrieves the session on the Booking payment account and passes it for verification', () => {
    expect(source).toContain('resolveCheckoutSessionPaymentAccount');
    expect(source).toContain('retrieveBookingDepositSession(sessionId, connectAccountId)');
    expect(source).toContain('stripeAccountId: connectAccountId');
    expect(source).not.toMatch(/const connectAccountId = shopForConnect\?\.stripeConnectAccountId/);
    expect(source).toContain("result.outcome === 'account_mismatch'");
  });
});
