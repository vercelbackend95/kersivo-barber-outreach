import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueShop = vi.fn();
const findFirstBooking = vi.fn();
const retrieveCheckoutSession = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...args: unknown[]) => findUniqueShop(...args) },
    booking: { findFirst: (...args: unknown[]) => findFirstBooking(...args) },
  },
}));

vi.mock('@/lib/shop/stripe', () => ({
  retrieveCheckoutSession: (...args: unknown[]) => retrieveCheckoutSession(...args),
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.co.uk',
}));

import { GET } from './calendar.ics';

function ctx(sessionId = 'cs_1') {
  return {
    params: { shopId: 'shop_1' },
    url: new URL(`https://kersivo.co.uk/book/shop_1/calendar.ics?session_id=${sessionId}`),
  };
}

const paidBooking = {
  id: 'book_1',
  startAt: new Date('2026-08-10T10:00:00.000Z'),
  endAt: new Date('2026-08-10T10:30:00.000Z'),
  serviceNameAtBooking: 'Fade',
  service: { name: 'Fade' },
  barber: { name: 'Alex' },
};

describe('GET /book/[shopId]/calendar.ics — payment account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueShop.mockResolvedValue({ name: 'Fade Room', stripeConnectAccountId: 'acct_new' });
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_1',
      payment_status: 'paid',
      metadata: { type: 'booking_payment', bookingId: 'book_1', shopId: 'shop_1' },
    });
  });

  it('M: retrieves the session on the original Booking account, not the current shop account', async () => {
    findFirstBooking
      .mockResolvedValueOnce({ stripeConnectAccountIdAtPayment: 'acct_original', kersivoPlatformFeePence: 5 })
      .mockResolvedValueOnce(paidBooking);

    const res = await GET(ctx() as never);

    expect(res.status).toBe(200);
    expect(findFirstBooking).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { stripeCheckoutSessionId: 'cs_1', barber: { shopId: 'shop_1' } },
      }),
    );
    expect(retrieveCheckoutSession).toHaveBeenCalledWith('cs_1', { stripeAccount: 'acct_original' });
    expect(await res.text()).toContain('BEGIN:VCALENDAR');
  });

  it('Q: legacy booking without a snapshot uses the current shop account', async () => {
    findFirstBooking
      .mockResolvedValueOnce({ stripeConnectAccountIdAtPayment: null, kersivoPlatformFeePence: 0 })
      .mockResolvedValueOnce(paidBooking);

    await GET(ctx() as never);

    expect(retrieveCheckoutSession).toHaveBeenCalledWith('cs_1', { stripeAccount: 'acct_new' });
  });

  it('fee-bearing booking without a snapshot is not retrieved via a guessed account', async () => {
    findFirstBooking.mockResolvedValueOnce({ stripeConnectAccountIdAtPayment: null, kersivoPlatformFeePence: 5 });

    const res = await GET(ctx() as never);

    expect(res.status).toBe(404);
    expect(retrieveCheckoutSession).not.toHaveBeenCalled();
  });
});
