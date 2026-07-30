import { BookingStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../db/client';
import { refundPaymentIntent } from '../shop/stripeConnect';

export async function refundBookingDepositIfEligible(input: {
  bookingId: string;
  reason: 'client_cancel_in_window' | 'shop_cancel';
}): Promise<'refunded' | 'skipped_unpaid' | 'skipped_already' | 'failed'> {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      barber: {
        select: {
          shopId: true,
          shop: { select: { stripeConnectAccountId: true } },
        },
      },
    },
  });
  if (!booking) return 'skipped_unpaid';
  if (!booking.paymentRequired || booking.paymentStatus !== PaymentStatus.PAID) return 'skipped_unpaid';
  if (booking.depositRefundedAt || booking.depositForfeitedAt) return 'skipped_already';
  if (!booking.stripePaymentIntentId) return 'failed';

  const connectAccountId = booking.barber.shop.stripeConnectAccountId?.trim() || null;

  try {
    const result = await refundPaymentIntent(booking.stripePaymentIntentId, {
      stripeAccount: connectAccountId ?? undefined,
      reverseTransfer: true,
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: PaymentStatus.REFUNDED,
        depositRefundedAt: new Date(),
      },
    });
    console.info('[deposit] refund ok', {
      bookingId: booking.id,
      reason: input.reason,
      mode: result.mode,
      connectAccountId,
      refundId: result.id,
    });
    return 'refunded';
  } catch (error) {
    console.error('[deposit] refund failed', {
      bookingId: booking.id,
      reason: input.reason,
      connectAccountId,
      error: error instanceof Error ? error.message : error,
    });
    return 'failed';
  }
}

export async function forfeitBookingDeposit(bookingId: string): Promise<void> {
  await prisma.booking.updateMany({
    where: {
      id: bookingId,
      paymentRequired: true,
      paymentStatus: PaymentStatus.PAID,
      depositRefundedAt: null,
      depositForfeitedAt: null,
    },
    data: { depositForfeitedAt: new Date() },
  });
}

export async function expireUnpaidDepositHolds(now: Date = new Date()): Promise<number> {
  const result = await prisma.booking.updateMany({
    where: {
      status: BookingStatus.PENDING_PAYMENT,
      paymentExpiresAt: { lte: now },
    },
    data: { status: BookingStatus.EXPIRED },
  });
  return result.count;
}
