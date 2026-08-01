import {
  BookingStatus,
  EmailOutboundPurpose,
  PaymentStatus,
  Prisma,
  type Barber,
  type Booking,
  type Service,
} from '@prisma/client';
import { prisma } from '../db/client';
import { buildInstantBookingConfirmationEmail, buildLateDepositRefundEmail } from '../email/sender';
import { enqueueEmail, tryDeliverOutboxEmail } from '../email/outbox';
import { captureOpsException } from '../ops/sentry';
import { notifyOpsDurable } from '../ops/stripeWebhookLedger';
import { getPublicSiteUrl } from '../setup/siteUrl';
import { attemptDepositRefund, requestDepositRefund } from './depositMoney';
import { generateToken, hashToken } from './tokens';

export type BookingWithRelations = Booking & {
  barber: Barber;
  service: Service;
};

export type ConfirmPaidDepositResult =
  | { outcome: 'confirmed'; booking: BookingWithRelations }
  | { outcome: 'duplicate'; booking: BookingWithRelations }
  | { outcome: 'not_found' }
  | { outcome: 'conflicting_payment'; booking: BookingWithRelations }
  | { outcome: 'reinstated'; booking: BookingWithRelations }
  | { outcome: 'late_refunded'; booking: BookingWithRelations };

async function loadBooking(
  bookingId: string,
  shopId: string,
): Promise<BookingWithRelations | null> {
  return prisma.booking.findFirst({
    where: { id: bookingId, barber: { shopId } },
    include: { barber: true, service: true },
  });
}

async function alertConflictingPayment(input: {
  booking: BookingWithRelations;
  shopId: string;
  sessionId: string;
  paymentIntentId: string | null;
}): Promise<void> {
  const { booking, shopId, sessionId, paymentIntentId } = input;
  const message = `Booking ${booking.id} already paid via session ${booking.stripeCheckoutSessionId ?? 'unknown'}; rejecting session ${sessionId}.`;
  await notifyOpsDurable({
    severity: 'critical',
    title: 'Deposit double-charge suspected',
    body: message.slice(0, 500),
    dedupeKey: `deposit:double-charge:${booking.id}`,
    fields: {
      bookingId: booking.id,
      shopId,
      existingSessionId: booking.stripeCheckoutSessionId ?? '',
      newSessionId: sessionId,
      paymentIntentId: paymentIntentId ?? '',
      status: booking.status,
      paymentStatus: booking.paymentStatus ?? '',
    },
  });
  captureOpsException(new Error(message), {
    route: 'confirmPaidDeposit',
    shopId,
    tags: {
      bookingId: booking.id,
      sessionId,
    },
  });
}

async function alertLatePaidSlotLost(input: {
  booking: BookingWithRelations;
  shopId: string;
  sessionId: string;
  paymentIntentId: string | null;
}): Promise<void> {
  const { booking, shopId, sessionId, paymentIntentId } = input;
  const message = `Late deposit payment for expired booking ${booking.id}; slot unavailable — refund queued.`;
  await notifyOpsDurable({
    severity: 'critical',
    title: 'Late deposit payment — slot lost, refund queued',
    body: message.slice(0, 500),
    dedupeKey: `deposit:late-paid:${booking.id}`,
    fields: {
      bookingId: booking.id,
      shopId,
      sessionId,
      paymentIntentId: paymentIntentId ?? '',
      status: booking.status,
      paymentStatus: booking.paymentStatus ?? '',
    },
  });
  captureOpsException(new Error(message), {
    route: 'confirmPaidDeposit.latePaid',
    shopId,
    tags: { bookingId: booking.id, sessionId },
  });
}

async function slotStillAvailable(
  tx: Prisma.TransactionClient,
  booking: BookingWithRelations,
): Promise<boolean> {
  const overlapping = await tx.booking.findFirst({
    where: {
      barberId: booking.barberId,
      id: { not: booking.id },
      status: { in: [BookingStatus.BOOKED, BookingStatus.PENDING_PAYMENT] },
      NOT: [{ endAt: { lte: booking.startAt } }, { startAt: { gte: booking.endAt } }],
    },
    select: { id: true },
  });
  if (overlapping) return false;

  const block = await tx.barberTimeOff.findFirst({
    where: {
      barberId: booking.barberId,
      NOT: [{ endsAt: { lte: booking.startAt } }, { startsAt: { gte: booking.endAt } }],
    },
    select: { id: true },
  });
  return !block;
}

/**
 * Handle payment that arrived after the local hold was released (EXPIRED + UNPAID).
 * Reinstate if the slot is free; otherwise stamp PAID on the expired row and refund.
 */
async function handleLatePaidDeposit(input: {
  booking: BookingWithRelations;
  shopId: string;
  sessionId: string;
  paymentIntentId: string | null;
  paidAt: Date;
}): Promise<ConfirmPaidDepositResult> {
  const { booking, shopId, sessionId, paymentIntentId, paidAt } = input;
  let outboxId: string | null = null;
  let mode: 'reinstated' | 'late_refunded' | null = null;

  const claimed = await prisma.$transaction(
    async (tx) => {
      const available = await slotStillAvailable(tx, booking);

      if (available) {
        const manageToken = generateToken();
        const cas = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: BookingStatus.EXPIRED,
            paymentStatus: PaymentStatus.UNPAID,
          },
          data: {
            status: BookingStatus.BOOKED,
            paymentStatus: PaymentStatus.PAID,
            paidAt,
            stripeCheckoutSessionId: sessionId,
            stripePaymentIntentId: paymentIntentId,
            manageTokenHash: hashToken(manageToken),
            paymentExpiresAt: null,
          },
        });
        if (cas.count === 0) return null;

        const updated = await tx.booking.findFirstOrThrow({
          where: { id: booking.id, barber: { shopId } },
          include: { barber: true, service: true },
        });

        const shop = await tx.shopSettings.findUnique({
          where: { id: shopId },
          select: { name: true },
        });
        const baseUrl = getPublicSiteUrl();
        const rendered = buildInstantBookingConfirmationEmail({
          to: updated.email,
          fullName: updated.fullName,
          cancelUrl: `${baseUrl}/book/cancel?token=${manageToken}`,
          rescheduleUrl: `${baseUrl}/book/reschedule?token=${manageToken}`,
          shopName: shop?.name ?? 'Barbershop',
          serviceName: updated.serviceNameAtBooking ?? updated.service.name,
          barberName: updated.barber.name,
          startAt: updated.startAt,
        });
        const outbound = await enqueueEmail(tx, {
          shopId,
          bookingId: updated.id,
          purpose: EmailOutboundPurpose.BOOKING_CONFIRMATION,
          to: updated.email,
          subject: rendered.subject,
          html: rendered.html,
        });
        outboxId = outbound.id;
        mode = 'reinstated';
        return updated;
      }

      // Slot taken — stamp payment so the refund ledger can run, keep EXPIRED.
      const cas = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: BookingStatus.EXPIRED,
          paymentStatus: PaymentStatus.UNPAID,
        },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paidAt,
          stripeCheckoutSessionId: sessionId,
          stripePaymentIntentId: paymentIntentId,
          paymentExpiresAt: null,
        },
      });
      if (cas.count === 0) return null;

      const updated = await tx.booking.findFirstOrThrow({
        where: { id: booking.id, barber: { shopId } },
        include: { barber: true, service: true },
      });

      const shop = await tx.shopSettings.findUnique({
        where: { id: shopId },
        select: { name: true },
      });
      const rendered = buildLateDepositRefundEmail({
        to: updated.email,
        fullName: updated.fullName,
        shopName: shop?.name ?? 'Barbershop',
        serviceName: updated.serviceNameAtBooking ?? updated.service.name,
        barberName: updated.barber.name,
        startAt: updated.startAt,
        depositAmountPence: updated.depositAmountPence ?? 0,
      });
      const outbound = await enqueueEmail(tx, {
        shopId,
        bookingId: updated.id,
        purpose: EmailOutboundPurpose.DEPOSIT_REFUNDED_SLOT_LOST,
        to: updated.email,
        subject: rendered.subject,
        html: rendered.html,
      });
      outboxId = outbound.id;
      mode = 'late_refunded';
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!claimed || !mode) {
    const fresh = await loadBooking(booking.id, shopId);
    if (!fresh) return { outcome: 'not_found' };
    if (fresh.status === BookingStatus.BOOKED && fresh.paymentStatus === PaymentStatus.PAID) {
      if (fresh.stripeCheckoutSessionId === sessionId) {
        return { outcome: 'duplicate', booking: fresh };
      }
      await alertConflictingPayment({
        booking: fresh,
        shopId,
        sessionId,
        paymentIntentId,
      });
      return { outcome: 'conflicting_payment', booking: fresh };
    }
    if (
      fresh.status === BookingStatus.EXPIRED &&
      fresh.paymentStatus === PaymentStatus.PAID &&
      fresh.stripeCheckoutSessionId === sessionId
    ) {
      return { outcome: 'late_refunded', booking: fresh };
    }
    await alertConflictingPayment({
      booking: fresh,
      shopId,
      sessionId,
      paymentIntentId,
    });
    return { outcome: 'conflicting_payment', booking: fresh };
  }

  await tryDeliverOutboxEmail(outboxId);

  if (mode === 'late_refunded') {
    await alertLatePaidSlotLost({
      booking: claimed,
      shopId,
      sessionId,
      paymentIntentId,
    });
    const requested = await requestDepositRefund({
      bookingId: claimed.id,
      reason: 'late_payment_slot_lost',
    });
    if (requested.refund) {
      await attemptDepositRefund(requested.refund.id);
    }
    return { outcome: 'late_refunded', booking: claimed };
  }

  return { outcome: 'reinstated', booking: claimed };
}

/**
 * Single domain entry for confirming a paid booking deposit.
 * Webhook and success page both call this — CAS ensures one token rotation
 * and one confirmation email per booking.
 */
export async function confirmPaidDeposit(input: {
  bookingId: string;
  shopId: string;
  sessionId: string;
  paymentIntentId: string | null;
  paidAt?: Date;
}): Promise<ConfirmPaidDepositResult> {
  const bookingId = input.bookingId.trim();
  const shopId = input.shopId.trim();
  const sessionId = input.sessionId.trim();
  if (!bookingId || !shopId || !sessionId) {
    return { outcome: 'not_found' };
  }

  const existing = await loadBooking(bookingId, shopId);
  if (!existing) {
    return { outcome: 'not_found' };
  }

  if (
    existing.status === BookingStatus.BOOKED &&
    existing.paymentStatus === PaymentStatus.PAID
  ) {
    if (existing.stripeCheckoutSessionId === sessionId) {
      return { outcome: 'duplicate', booking: existing };
    }
    await alertConflictingPayment({
      booking: existing,
      shopId,
      sessionId,
      paymentIntentId: input.paymentIntentId,
    });
    return { outcome: 'conflicting_payment', booking: existing };
  }

  // Already processed late-payment refund for this session.
  if (
    existing.status === BookingStatus.EXPIRED &&
    existing.paymentStatus === PaymentStatus.PAID &&
    existing.stripeCheckoutSessionId === sessionId
  ) {
    return { outcome: 'late_refunded', booking: existing };
  }

  const paidAt = input.paidAt ?? new Date();
  let outboxId: string | null = null;

  const claimed = await prisma.$transaction(
    async (tx) => {
      // Token is minted inside the transaction. Concurrent losers may mint a discarded
      // token in memory, but only the CAS winner persists a hash and enqueues email.
      const manageToken = generateToken();
      const cas = await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.UNPAID,
        },
        data: {
          status: BookingStatus.BOOKED,
          paymentStatus: PaymentStatus.PAID,
          paidAt,
          stripeCheckoutSessionId: sessionId,
          stripePaymentIntentId: input.paymentIntentId,
          manageTokenHash: hashToken(manageToken),
          paymentExpiresAt: null,
        },
      });

      if (cas.count === 0) {
        return null;
      }

      const updated = await tx.booking.findFirstOrThrow({
        where: { id: bookingId, barber: { shopId } },
        include: { barber: true, service: true },
      });

      const shop = await tx.shopSettings.findUnique({
        where: { id: shopId },
        select: { name: true },
      });
      const baseUrl = getPublicSiteUrl();
      const rendered = buildInstantBookingConfirmationEmail({
        to: updated.email,
        fullName: updated.fullName,
        cancelUrl: `${baseUrl}/book/cancel?token=${manageToken}`,
        rescheduleUrl: `${baseUrl}/book/reschedule?token=${manageToken}`,
        shopName: shop?.name ?? 'Barbershop',
        serviceName: updated.serviceNameAtBooking ?? updated.service.name,
        barberName: updated.barber.name,
        startAt: updated.startAt,
      });

      const outbound = await enqueueEmail(tx, {
        shopId,
        bookingId: updated.id,
        purpose: EmailOutboundPurpose.BOOKING_CONFIRMATION,
        to: updated.email,
        subject: rendered.subject,
        html: rendered.html,
      });
      outboxId = outbound.id;

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!claimed) {
    const fresh = await loadBooking(bookingId, shopId);
    if (!fresh) {
      return { outcome: 'not_found' };
    }
    if (
      fresh.status === BookingStatus.BOOKED &&
      fresh.paymentStatus === PaymentStatus.PAID
    ) {
      if (fresh.stripeCheckoutSessionId === sessionId) {
        return { outcome: 'duplicate', booking: fresh };
      }
      await alertConflictingPayment({
        booking: fresh,
        shopId,
        sessionId,
        paymentIntentId: input.paymentIntentId,
      });
      return { outcome: 'conflicting_payment', booking: fresh };
    }

    if (fresh.status === BookingStatus.EXPIRED && fresh.paymentStatus === PaymentStatus.UNPAID) {
      return handleLatePaidDeposit({
        booking: fresh,
        shopId,
        sessionId,
        paymentIntentId: input.paymentIntentId,
        paidAt,
      });
    }

    if (
      fresh.status === BookingStatus.EXPIRED &&
      fresh.paymentStatus === PaymentStatus.PAID &&
      fresh.stripeCheckoutSessionId === sessionId
    ) {
      return { outcome: 'late_refunded', booking: fresh };
    }

    await alertConflictingPayment({
      booking: fresh,
      shopId,
      sessionId,
      paymentIntentId: input.paymentIntentId,
    });
    return { outcome: 'conflicting_payment', booking: fresh };
  }

  await tryDeliverOutboxEmail(outboxId);
  return { outcome: 'confirmed', booking: claimed };
}
