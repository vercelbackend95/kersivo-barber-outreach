import { BookingStatus, Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { canCancelOrReschedule, pendingExpiryDate } from './policies';
import { generateToken, hashToken } from './tokens';
import { addMinutes, toUtcFromLondon } from './time';
import { sendBookingConfirmationEmail, sendManageBookingEmail, sendRescheduledBookingEmail, sendShopCancelledBookingEmail } from '../email/sender';
const CANCELLED_BOOKING_MESSAGE = 'This booking is already cancelled. Please create a new booking.';
const MANAGE_LINKS_NOT_READY_MESSAGE = 'Please confirm your booking first. Manage links become active after confirmation.';

export class BookingActionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'BookingActionError';
    this.statusCode = statusCode;
  }
}

function isCancelledStatus(status: BookingStatus): boolean {
  return status === BookingStatus.CANCELLED_BY_CLIENT || status === BookingStatus.CANCELLED_BY_ADMIN || String(status) === 'CANCELLED_BY_SHOP';
}

async function resolveConfirmTokenBooking(token: string) {
  const hashed = hashToken(token);
  const booking = await prisma.booking.findFirst({ where: { confirmTokenHash: hashed } });
  if (!booking) throw new BookingActionError('Invalid token.');

  if (isCancelledStatus(booking.status)) {
    throw new BookingActionError(CANCELLED_BOOKING_MESSAGE, 409);
  }


  return booking;
}

async function resolveManageTokenBooking(token: string) {
  const hashed = hashToken(token);
  const booking = await prisma.booking.findFirst({ where: { manageTokenHash: hashed }, include: { barber: true, service: true } });
  if (!booking) throw new BookingActionError('Invalid token.');

  if (isCancelledStatus(booking.status)) {
    throw new BookingActionError(CANCELLED_BOOKING_MESSAGE, 409);
  }

  return booking;
}

export async function getRescheduleTokenStatus(token: string): Promise<{ valid: true } | { valid: false; message: string }> {
  try {
    await resolveManageTokenBooking(token);
    return { valid: true };
  } catch (error) {
    if (error instanceof BookingActionError) {
      return { valid: false, message: error.message };
    }

    return { valid: false, message: 'Unable to validate booking token.' };
  }
}

export async function expirePendingBookings() {
  await prisma.booking.updateMany({
    where: {
      status: BookingStatus.PENDING_CONFIRMATION,
      confirmTokenExpiresAt: { lt: new Date() }
    },
    data: { status: BookingStatus.EXPIRED }
  });
}

async function ensureSlotAvailable(tx: Prisma.TransactionClient, input: {
  barberId: string; startAt: Date; endAt: Date; ignoreBookingId?: string;
}) {
  const overlapping = await tx.booking.findFirst({
    where: {
      barberId: input.barberId,
      id: input.ignoreBookingId ? { not: input.ignoreBookingId } : undefined,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_CONFIRMATION] },
      NOT: [{ endAt: { lte: input.startAt } }, { startAt: { gte: input.endAt } }]
    }
  });

  if (overlapping) throw new Error('This slot is no longer available.');

  const block = await tx.barberTimeOff.findFirst({
    where: {
      barberId: input.barberId,
      NOT: [{ endsAt: { lte: input.startAt } }, { startsAt: { gte: input.endAt } }]
    }
  });

  if (block) throw new Error('Selected time is blocked.');
}

export async function createPendingBooking(input: {
  serviceId: string; barberId: string; date: string; time: string; fullName: string; email: string; phone?: string;
}) {
  await expirePendingBookings();
  const settings = await prisma.shopSettings.findFirstOrThrow();
  const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
  const [h, m] = input.time.split(':').map(Number);
  const startAt = toUtcFromLondon(input.date, h * 60 + m);
  const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));

  const confirmToken = generateToken();

  const booking = await prisma.$transaction(async (tx) => {
    await ensureSlotAvailable(tx, { barberId: input.barberId, startAt, endAt });

    return tx.booking.create({
      data: {
        service: { connect: { id: input.serviceId } },
        barber: { connect: { id: input.barberId } },

        fullName: input.fullName,
        email: input.email,
        phone: input.phone || null,
        startAt,
        endAt,
        status: BookingStatus.PENDING_CONFIRMATION,
        confirmTokenHash: hashToken(confirmToken),
        confirmTokenExpiresAt: pendingExpiryDate(settings),
        manageTokenHash: null,
        manageTokenExpiresAt: null,
        paymentRequired: false,
        paymentStatus: null
      },
      include: { service: true, barber: true }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const baseUrl = import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
  await sendBookingConfirmationEmail({
    to: booking.email,
    fullName: booking.fullName,
    confirmUrl: `${baseUrl}/book/confirm?token=${confirmToken}`,
    shopName: settings.name,
    serviceName: booking.service.name,
    barberName: booking.barber.name,
    startAt: booking.startAt
  });

  return booking;
}

export async function confirmBookingByToken(token: string) {
  await expirePendingBookings();
  const booking = await resolveConfirmTokenBooking(token);
  if (booking.status !== BookingStatus.PENDING_CONFIRMATION) throw new BookingActionError('This booking is already confirmed.', 409);
  if (!booking.confirmTokenExpiresAt || booking.confirmTokenExpiresAt < new Date()) throw new BookingActionError('Token expired.');

  const manageToken = generateToken();

  const { confirmedBooking, settings } = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CONFIRMED,
        confirmTokenHash: null,
        confirmTokenExpiresAt: null,
        manageTokenHash: hashToken(manageToken)
      },
      include: { barber: true, service: true }
    });

    const shopSettings = await tx.shopSettings.findFirstOrThrow();

    return { confirmedBooking: updatedBooking, settings: shopSettings };
  });

  const baseUrl = import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
  await sendManageBookingEmail({
    to: confirmedBooking.email,
    fullName: confirmedBooking.fullName,
    cancelUrl: `${baseUrl}/book/cancel?token=${manageToken}`,
    rescheduleUrl: `${baseUrl}/book/reschedule?token=${manageToken}`,
    shopName: settings.name,
    serviceName: confirmedBooking.service.name,
    barberName: confirmedBooking.barber.name,
    startAt: confirmedBooking.startAt
  });

  return confirmedBooking;
}

export async function cancelByManageToken(token: string) {
  const booking = await resolveManageTokenBooking(token);

  const settings = await prisma.shopSettings.findFirstOrThrow();
  if (!canCancelOrReschedule(booking.startAt, settings.cancellationWindowHours)) throw new BookingActionError('Cancellation window has passed.', 409);
  return prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELLED_BY_CLIENT } });
}

export async function cancelByShop(input: { bookingId: string; reason?: string }) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { barber: true, service: true }
  });

  if (!booking) {
    throw new BookingActionError('Booking not found.', 404);
  }

  if (booking.status === BookingStatus.EXPIRED || isCancelledStatus(booking.status)) {
    throw new BookingActionError('This booking has already been cancelled or expired.', 409);
  }

  const settings = await prisma.shopSettings.findFirstOrThrow();

  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: 'CANCELLED_BY_SHOP' as BookingStatus
    },
    include: { barber: true, service: true }
  });

  await sendShopCancelledBookingEmail({
    to: updatedBooking.email,
    fullName: updatedBooking.fullName,
    shopName: settings.name,
    serviceName: updatedBooking.service.name,
    barberName: updatedBooking.barber.name,
    startAt: updatedBooking.startAt,
    reason: input.reason
  });

  return updatedBooking;
}


export async function rescheduleByToken(input: { token: string; serviceId: string; barberId: string; date: string; time: string; }) {
  const existing = await resolveManageTokenBooking(input.token);

  if (existing.status === BookingStatus.EXPIRED) {
    throw new BookingActionError('This booking has expired and can no longer be rescheduled.', 409);
  }

  if (isCancelledStatus(existing.status)) {
    throw new BookingActionError(CANCELLED_BOOKING_MESSAGE, 409);
  }

  if (existing.status !== BookingStatus.CONFIRMED) {
    throw new BookingActionError('Only confirmed bookings can be rescheduled.', 409);
  }

  const settings = await prisma.shopSettings.findFirstOrThrow();
  const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
  const [h, m] = input.time.split(':').map(Number);
  const startAt = toUtcFromLondon(input.date, h * 60 + m);
  const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));

 const updatedBooking = await prisma.$transaction(async (tx) => {
    await ensureSlotAvailable(tx, { barberId: input.barberId, startAt, endAt, ignoreBookingId: existing.id });

    // Sanity rule: rescheduling must mutate the existing booking row (same id), never create another booking.
    return tx.booking.update({
      where: { id: existing.id },

      data: {
        service: { connect: { id: input.serviceId } },
        barber: { connect: { id: input.barberId } },
        startAt,
        endAt,
        rescheduledAt: new Date(),
        originalStartAt: existing.originalStartAt ?? existing.startAt,
        originalEndAt: existing.originalEndAt ?? existing.endAt,
        status: BookingStatus.CONFIRMED
      },

      include: { service: true, barber: true }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  
  const baseUrl = import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
  const settingsForEmail = await prisma.shopSettings.findFirstOrThrow();
  await sendRescheduledBookingEmail({
    to: updatedBooking.email,
    fullName: updatedBooking.fullName,
    cancelUrl: `${baseUrl}/book/cancel?token=${input.token}`,
    rescheduleUrl: `${baseUrl}/book/reschedule?token=${input.token}`,
    shopName: settingsForEmail.name,
    serviceName: updatedBooking.service.name,
    barberName: updatedBooking.barber.name,
    startAt: updatedBooking.startAt,
    previousStartAt: updatedBooking.originalStartAt,
    previousEndAt: updatedBooking.originalEndAt
  });

  return updatedBooking;

}
