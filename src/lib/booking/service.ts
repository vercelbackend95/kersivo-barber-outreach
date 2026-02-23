import { BookingStatus, Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { canCancelOrReschedule, pendingExpiryDate } from './policies';
import { generateToken, hashToken } from './tokens';
import { addMinutes, toUtcFromLondon } from './time';
import { sendBookingMagicLinkEmail } from '../email/sender';

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
  const manageToken = generateToken();

  const booking = await prisma.$transaction(async (tx) => {
    await ensureSlotAvailable(tx, { barberId: input.barberId, startAt, endAt });

    return tx.booking.create({
      data: {
        serviceId: input.serviceId,
        barberId: input.barberId,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone || null,
        startAt,
        endAt,
        status: BookingStatus.PENDING_CONFIRMATION,
        confirmTokenHash: hashToken(confirmToken),
        confirmTokenExpiresAt: pendingExpiryDate(settings),
        manageTokenHash: hashToken(manageToken),
        paymentRequired: false,
        paymentStatus: null
      },
      include: { service: true, barber: true }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const baseUrl = import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
  await sendBookingMagicLinkEmail({
    to: booking.email,
    fullName: booking.fullName,
    confirmUrl: `${baseUrl}/book/confirm?token=${confirmToken}`,
    cancelUrl: `${baseUrl}/book/cancel?token=${manageToken}`,
    rescheduleUrl: `${baseUrl}/book/reschedule?token=${manageToken}`
  });

  return booking;
}

export async function confirmBookingByToken(token: string) {
  await expirePendingBookings();
  const hashed = hashToken(token);
  const booking = await prisma.booking.findFirst({ where: { confirmTokenHash: hashed } });
  if (!booking) throw new Error('Invalid token.');
  if (booking.status !== BookingStatus.PENDING_CONFIRMATION) throw new Error('Booking cannot be confirmed.');
  if (!booking.confirmTokenExpiresAt || booking.confirmTokenExpiresAt < new Date()) throw new Error('Token expired.');

  return prisma.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.CONFIRMED, confirmTokenHash: null, confirmTokenExpiresAt: null },
    include: { barber: true, service: true }
  });
}

export async function cancelByManageToken(token: string) {
  const hashed = hashToken(token);
  const booking = await prisma.booking.findFirst({ where: { manageTokenHash: hashed }, include: { barber: true, service: true } });
  if (!booking) throw new Error('Invalid token.');
  const settings = await prisma.shopSettings.findFirstOrThrow();
  if (!canCancelOrReschedule(booking.startAt, settings.cancellationWindowHours)) throw new Error('Cancellation window has passed.');

  return prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELLED_BY_CLIENT } });
}

export async function rescheduleByToken(input: { token: string; serviceId: string; barberId: string; date: string; time: string; }) {
  const hashed = hashToken(input.token);
  const existing = await prisma.booking.findFirst({ where: { manageTokenHash: hashed }, include: { service: true } });
  if (!existing) throw new Error('Invalid token.');
  const settings = await prisma.shopSettings.findFirstOrThrow();
  if (!canCancelOrReschedule(existing.startAt, settings.rescheduleWindowHours)) throw new Error('Reschedule window has passed.');
  const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
  const [h, m] = input.time.split(':').map(Number);
  const startAt = toUtcFromLondon(input.date, h * 60 + m);
  const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));

  return prisma.$transaction(async (tx) => {
    await ensureSlotAvailable(tx, { barberId: input.barberId, startAt, endAt, ignoreBookingId: existing.id });

    const newBooking = await tx.booking.create({
      data: {
        serviceId: input.serviceId,
        barberId: input.barberId,
        fullName: existing.fullName,
        email: existing.email,
        phone: existing.phone,
        startAt,
        endAt,
        status: BookingStatus.CONFIRMED,
        parentBookingId: existing.id,
        manageTokenHash: existing.manageTokenHash,
        manageTokenExpiresAt: existing.manageTokenExpiresAt,
        paymentRequired: existing.paymentRequired,
        depositAmountPence: existing.depositAmountPence,
        paymentStatus: existing.paymentStatus,
        stripeCheckoutSessionId: existing.stripeCheckoutSessionId,
        paidAt: existing.paidAt
      }
    });

    await tx.booking.update({ where: { id: existing.id }, data: { status: BookingStatus.RESCHEDULED, newBookingId: newBooking.id } });

    return newBooking;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
