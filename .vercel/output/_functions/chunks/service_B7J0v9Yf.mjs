import { BookingStatus, Prisma } from '@prisma/client';
import { p as prisma } from './client_C4jvTHHS.mjs';
import crypto from 'node:crypto';
import { t as toUtcFromLondon, a as addMinutes } from './time_Bf5AYUQW.mjs';
import { s as sendShopCancelledBookingEmail, a as sendManageBookingEmail, b as sendBookingConfirmationEmail, c as sendRescheduledBookingEmail } from './sender_DNpVcW2v.mjs';

function canCancelOrReschedule(startAt, windowHours) {
  const diff = startAt.getTime() - Date.now();
  return diff >= windowHours * 60 * 6e4;
}
function pendingExpiryDate(settings) {
  return new Date(Date.now() + settings.pendingConfirmationMins * 6e4);
}

function generateToken() {
  return crypto.randomBytes(24).toString("base64url");
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const CANCELLED_BOOKING_MESSAGE = "This booking is already cancelled. Please create a new booking.";
class BookingActionError extends Error {
  statusCode;
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "BookingActionError";
    this.statusCode = statusCode;
  }
}
function isCancelledStatus(status) {
  return status === BookingStatus.CANCELLED_BY_CLIENT || status === BookingStatus.CANCELLED_BY_ADMIN || String(status) === "CANCELLED_BY_SHOP";
}
async function resolveConfirmTokenBooking(token) {
  const hashed = hashToken(token);
  const booking = await prisma.booking.findFirst({ where: { confirmTokenHash: hashed } });
  if (!booking) throw new BookingActionError("Invalid token.");
  if (isCancelledStatus(booking.status)) {
    throw new BookingActionError(CANCELLED_BOOKING_MESSAGE, 409);
  }
  return booking;
}
async function resolveManageTokenBooking(token) {
  const hashed = hashToken(token);
  const booking = await prisma.booking.findFirst({ where: { manageTokenHash: hashed }, include: { barber: true, service: true } });
  if (!booking) throw new BookingActionError("Invalid token.");
  if (isCancelledStatus(booking.status)) {
    throw new BookingActionError(CANCELLED_BOOKING_MESSAGE, 409);
  }
  return booking;
}
async function getRescheduleTokenStatus(token) {
  try {
    await resolveManageTokenBooking(token);
    return { valid: true };
  } catch (error) {
    if (error instanceof BookingActionError) {
      return { valid: false, message: error.message };
    }
    return { valid: false, message: "Unable to validate booking token." };
  }
}
async function expirePendingBookings() {
  await prisma.booking.updateMany({
    where: {
      status: BookingStatus.PENDING_CONFIRMATION,
      confirmTokenExpiresAt: { lt: /* @__PURE__ */ new Date() }
    },
    data: { status: BookingStatus.EXPIRED }
  });
}
async function getPrimaryShopId(tx) {
  const client = tx ?? prisma;
  const shop = await client.shopSettings.findFirstOrThrow({ select: { id: true } });
  return shop.id;
}
async function upsertClientForBooking(tx, input) {
  const shopId = await getPrimaryShopId(tx);
  const clientDelegate = tx.client;
  if (!clientDelegate || typeof clientDelegate.upsert !== "function") {
    if (process.env.NODE_ENV !== "production") {
      console.error('Prisma delegate "client" is unavailable on transaction client. Check generated Prisma client + schema model names.', {
        delegates: Object.keys(tx).filter((key) => !key.startsWith("$")).sort()
      });
    }
    throw new Error("Database client model delegate is unavailable. Expected `prisma.client` from `model Client`. Run `npx prisma generate` after schema changes.");
  }
  return clientDelegate.upsert({
    where: { shopId_email: { shopId, email: input.email } },
    update: {
      fullName: input.fullName ?? void 0,
      phone: input.phone ?? void 0
    },
    create: {
      shopId,
      email: input.email,
      fullName: input.fullName ?? null,
      phone: input.phone ?? null
    }
  });
}
async function ensureSlotAvailable(tx, input) {
  const overlapping = await tx.booking.findFirst({
    where: {
      barberId: input.barberId,
      id: input.ignoreBookingId ? { not: input.ignoreBookingId } : void 0,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_CONFIRMATION] },
      NOT: [{ endAt: { lte: input.startAt } }, { startAt: { gte: input.endAt } }]
    }
  });
  if (overlapping) throw new Error("This slot is no longer available.");
  const block = await tx.barberTimeOff.findFirst({
    where: {
      barberId: input.barberId,
      NOT: [{ endsAt: { lte: input.startAt } }, { startsAt: { gte: input.endAt } }]
    }
  });
  if (block) throw new Error("Selected time is blocked.");
}
async function createPendingBooking(input) {
  await expirePendingBookings();
  const settings = await prisma.shopSettings.findFirstOrThrow();
  const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
  const [h, m] = input.time.split(":").map(Number);
  const startAt = toUtcFromLondon(input.date, h * 60 + m);
  const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));
  const confirmToken = generateToken();
  const booking = await prisma.$transaction(async (tx) => {
    await ensureSlotAvailable(tx, { barberId: input.barberId, startAt, endAt });
    const client = await upsertClientForBooking(tx, {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone || null
    });
    return tx.booking.create({
      data: {
        service: { connect: { id: input.serviceId } },
        barber: { connect: { id: input.barberId } },
        client: { connect: { id: client.id } },
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
  const baseUrl = "http://localhost:4321";
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
async function confirmBookingByToken(token) {
  await expirePendingBookings();
  const booking = await resolveConfirmTokenBooking(token);
  if (booking.status !== BookingStatus.PENDING_CONFIRMATION) throw new BookingActionError("This booking is already confirmed.", 409);
  if (!booking.confirmTokenExpiresAt || booking.confirmTokenExpiresAt < /* @__PURE__ */ new Date()) throw new BookingActionError("Token expired.");
  const manageToken = generateToken();
  const { confirmedBooking, settings } = await prisma.$transaction(async (tx) => {
    const client = await upsertClientForBooking(tx, {
      email: booking.email,
      fullName: booking.fullName,
      phone: booking.phone
    });
    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        clientId: client.id,
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
  const baseUrl = "http://localhost:4321";
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
async function cancelByManageToken(token) {
  const booking = await resolveManageTokenBooking(token);
  const settings = await prisma.shopSettings.findFirstOrThrow();
  if (!canCancelOrReschedule(booking.startAt, settings.cancellationWindowHours)) throw new BookingActionError("Cancellation window has passed.", 409);
  return prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELLED_BY_CLIENT } });
}
async function cancelByShop(input) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { barber: true, service: true }
  });
  if (!booking) {
    throw new BookingActionError("Booking not found.", 404);
  }
  if (booking.status === BookingStatus.EXPIRED || isCancelledStatus(booking.status)) {
    throw new BookingActionError("This booking has already been cancelled or expired.", 409);
  }
  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.CANCELLED_BY_SHOP
    },
    include: { barber: true, service: true }
  });
  try {
    const settings = await prisma.shopSettings.findFirstOrThrow();
    await sendShopCancelledBookingEmail({
      to: updatedBooking.email,
      fullName: updatedBooking.fullName,
      shopName: settings.name,
      serviceName: updatedBooking.service.name,
      barberName: updatedBooking.barber.name,
      startAt: updatedBooking.startAt,
      reason: input.reason
    });
  } catch (error) {
    console.warn("Failed to send shop cancellation email.", {
      bookingId: updatedBooking.id,
      error: error instanceof Error ? error.message : error
    });
    if (error instanceof Error && error.stack) {
      console.warn(error.stack);
    }
  }
  return updatedBooking;
}
async function rescheduleByToken(input) {
  const existing = await resolveManageTokenBooking(input.token);
  if (existing.status === BookingStatus.EXPIRED) {
    throw new BookingActionError("This booking has expired and can no longer be rescheduled.", 409);
  }
  if (isCancelledStatus(existing.status)) {
    throw new BookingActionError(CANCELLED_BOOKING_MESSAGE, 409);
  }
  if (existing.status !== BookingStatus.CONFIRMED) {
    throw new BookingActionError("Only confirmed bookings can be rescheduled.", 409);
  }
  const settings = await prisma.shopSettings.findFirstOrThrow();
  const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
  const [h, m] = input.time.split(":").map(Number);
  const startAt = toUtcFromLondon(input.date, h * 60 + m);
  const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));
  const updatedBooking = await prisma.$transaction(async (tx) => {
    await ensureSlotAvailable(tx, { barberId: input.barberId, startAt, endAt, ignoreBookingId: existing.id });
    return tx.booking.update({
      where: { id: existing.id },
      data: {
        service: { connect: { id: input.serviceId } },
        barber: { connect: { id: input.barberId } },
        startAt,
        endAt,
        rescheduledAt: /* @__PURE__ */ new Date(),
        originalStartAt: existing.originalStartAt ?? existing.startAt,
        originalEndAt: existing.originalEndAt ?? existing.endAt,
        status: BookingStatus.CONFIRMED
      },
      include: { service: true, barber: true }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const baseUrl = "http://localhost:4321";
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

export { BookingActionError as B, cancelByManageToken as a, confirmBookingByToken as b, cancelByShop as c, createPendingBooking as d, expirePendingBookings as e, getRescheduleTokenStatus as g, rescheduleByToken as r };
