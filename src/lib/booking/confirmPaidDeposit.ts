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
import { getPublicSiteUrl } from '../setup/siteUrl';
import type { StripeSession } from '../shop/stripe';
import {
  isBookingCheckoutMetadataType,
  LEGACY_BOOKING_DEPOSIT_METADATA_TYPE,
} from './bookingPaymentPolicy';
import { attemptDepositRefund, requestDepositRefund } from './depositMoney';
import { generateToken, hashToken } from './tokens';

export type BookingWithRelations = Booking & {
  barber: Barber;
  service: Service;
};

export type ConfirmPaidBookingPaymentResult =
  | { outcome: 'confirmed'; booking: BookingWithRelations }
  | { outcome: 'duplicate'; booking: BookingWithRelations }
  | { outcome: 'not_found' }
  | { outcome: 'conflicting_payment'; booking: BookingWithRelations }
  | { outcome: 'reinstated'; booking: BookingWithRelations }
  | { outcome: 'late_refunded'; booking: BookingWithRelations }
  /** Session is not paid, or not a booking session for this booking/shop. */
  | { outcome: 'invalid_session' }
  | { outcome: 'payment_type_mismatch'; booking: BookingWithRelations }
  | { outcome: 'amount_mismatch'; booking: BookingWithRelations };

/** @deprecated alias kept for existing callers. */
export type ConfirmPaidDepositResult = ConfirmPaidBookingPaymentResult;

/** Fields of the retrieved Stripe Checkout Session used to verify a booking payment. */
export type BookingPaymentSessionEvidence = Pick<
  StripeSession,
  'amount_total' | 'currency' | 'payment_status' | 'metadata'
> & { id?: string };

type SessionVerdict =
  | { ok: true }
  | { ok: false; outcome: 'payment_type_mismatch' | 'amount_mismatch'; detail: string };

function sessionBelongsToBooking(input: {
  session: BookingPaymentSessionEvidence;
  sessionId: string;
  bookingId: string;
  shopId: string;
}): boolean {
  const { session } = input;
  if ((session.payment_status ?? '').toLowerCase() !== 'paid') return false;
  if (session.id && session.id !== input.sessionId) return false;
  const metadata = session.metadata ?? {};
  if (!isBookingCheckoutMetadataType(metadata.type)) return false;
  return metadata.bookingId?.trim() === input.bookingId && metadata.shopId?.trim() === input.shopId;
}

/**
 * The Booking snapshot is authoritative: payment type and amount_total must match it exactly.
 * Metadata never supplies money amounts.
 */
function verifySessionAgainstSnapshot(
  booking: BookingWithRelations,
  session: BookingPaymentSessionEvidence,
): SessionVerdict {
  const metadata = session.metadata ?? {};
  const isLegacy = metadata.type?.trim() === LEGACY_BOOKING_DEPOSIT_METADATA_TYPE;
  const storedType = booking.bookingPaymentType ?? (booking.paymentRequired ? 'DEPOSIT' : null);

  if (!storedType || storedType === 'NONE') {
    return { ok: false, outcome: 'payment_type_mismatch', detail: `stored=${storedType ?? 'null'}` };
  }
  const sessionType = isLegacy ? 'DEPOSIT' : metadata.bookingPaymentType?.trim();
  if (sessionType !== storedType) {
    return {
      ok: false,
      outcome: 'payment_type_mismatch',
      detail: `stored=${storedType} session=${sessionType ?? 'missing'}`,
    };
  }

  const expected = booking.paymentAmountPence ?? booking.depositAmountPence;
  if (typeof expected !== 'number' || expected <= 0) {
    return { ok: false, outcome: 'amount_mismatch', detail: 'missing stored payment amount' };
  }
  const currency = session.currency?.trim().toLowerCase();
  if (currency && currency !== 'gbp') {
    return { ok: false, outcome: 'amount_mismatch', detail: `currency=${currency}` };
  }
  const total = session.amount_total;
  if (typeof total !== 'number') {
    // Pre-4B deposit sessions were confirmed without amount evidence; keep accepting them.
    if (isLegacy) return { ok: true };
    return { ok: false, outcome: 'amount_mismatch', detail: 'missing amount_total' };
  }
  if (total !== expected) {
    return { ok: false, outcome: 'amount_mismatch', detail: `expected=${expected} paid=${total}` };
  }
  return { ok: true };
}

function alertSessionVerificationFailed(input: {
  booking: BookingWithRelations;
  shopId: string;
  sessionId: string;
  outcome: 'payment_type_mismatch' | 'amount_mismatch';
  detail: string;
}): void {
  captureOpsException(
    new Error(
      `Booking payment ${input.outcome} for booking ${input.booking.id} (session ${input.sessionId}): ${input.detail}. Booking not confirmed.`,
    ),
    {
      route: 'confirmPaidBookingPayment',
      shopId: input.shopId,
      opsAlert: true,
      tags: { bookingId: input.booking.id, sessionId: input.sessionId, outcome: input.outcome },
    },
  );
}

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
  captureOpsException(new Error(message), {
    route: 'confirmPaidDeposit',
    shopId,
    opsAlert: true,
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
  captureOpsException(new Error(message), {
    route: 'confirmPaidDeposit.latePaid',
    shopId,
    opsAlert: true,
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
 * Single domain entry for confirming a paid booking payment (deposit today).
 * Webhook, success page and hold expiry all call this — CAS ensures one token rotation
 * and one confirmation email per booking. Accepts legacy `booking_deposit` and generic
 * `booking_payment` sessions; the stored Booking snapshot is authoritative for type + amount.
 */
export async function confirmPaidBookingPayment(input: {
  bookingId: string;
  shopId: string;
  sessionId: string;
  paymentIntentId: string | null;
  /** Retrieved Checkout Session — verified against the Booking before any state change. */
  session: BookingPaymentSessionEvidence;
  paidAt?: Date;
}): Promise<ConfirmPaidBookingPaymentResult> {
  const bookingId = input.bookingId.trim();
  const shopId = input.shopId.trim();
  const sessionId = input.sessionId.trim();
  if (!bookingId || !shopId || !sessionId) {
    return { outcome: 'not_found' };
  }
  if (!sessionBelongsToBooking({ session: input.session, sessionId, bookingId, shopId })) {
    return { outcome: 'invalid_session' };
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

  const verdict = verifySessionAgainstSnapshot(existing, input.session);
  if (!verdict.ok) {
    alertSessionVerificationFailed({
      booking: existing,
      shopId,
      sessionId,
      outcome: verdict.outcome,
      detail: verdict.detail,
    });
    return { outcome: verdict.outcome, booking: existing };
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

/** @deprecated compatibility alias — use confirmPaidBookingPayment. */
export const confirmPaidDeposit = confirmPaidBookingPayment;
