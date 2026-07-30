import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn();
const refundPaymentIntent = vi.fn();

vi.mock('../db/client', () => ({
  prisma: {
    booking: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

vi.mock('../shop/stripeConnect', () => ({
  refundPaymentIntent: (...args: unknown[]) => refundPaymentIntent(...args),
}));

import { refundBookingDepositIfEligible } from './depositMoney';

describe('refundBookingDepositIfEligible', () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    refundPaymentIntent.mockReset();
  });

  it('passes connect account id to refundPaymentIntent', async () => {
    findUnique.mockResolvedValue({
      id: 'book_1',
      paymentRequired: true,
      paymentStatus: 'PAID',
      depositRefundedAt: null,
      depositForfeitedAt: null,
      stripePaymentIntentId: 'pi_1',
      barber: { shopId: 'shop_1', shop: { stripeConnectAccountId: 'acct_shop' } },
    });
    refundPaymentIntent.mockResolvedValue({ id: 're_1', mode: 'direct' });
    update.mockResolvedValue({});

    const result = await refundBookingDepositIfEligible({
      bookingId: 'book_1',
      reason: 'shop_cancel',
    });

    expect(result).toBe('refunded');
    expect(refundPaymentIntent).toHaveBeenCalledWith('pi_1', {
      stripeAccount: 'acct_shop',
      reverseTransfer: true,
    });
    expect(update).toHaveBeenCalled();
  });

  it('returns failed when Stripe refund throws', async () => {
    findUnique.mockResolvedValue({
      id: 'book_1',
      paymentRequired: true,
      paymentStatus: 'PAID',
      depositRefundedAt: null,
      depositForfeitedAt: null,
      stripePaymentIntentId: 'pi_1',
      barber: { shopId: 'shop_1', shop: { stripeConnectAccountId: 'acct_shop' } },
    });
    refundPaymentIntent.mockRejectedValue(new Error('boom'));

    const result = await refundBookingDepositIfEligible({
      bookingId: 'book_1',
      reason: 'client_cancel_in_window',
    });
    expect(result).toBe('failed');
    expect(update).not.toHaveBeenCalled();
  });
});
