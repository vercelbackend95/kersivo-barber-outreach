import { BookingStatus, Prisma, type Service, type ShopSettings } from '@prisma/client';
import { prisma } from '../db/client';
import { PUBLIC_BOOKING_UNAVAILABLE_MESSAGE, isPrismaQuotaExceededError } from '../db/resilience';
import { getTimeBlockDelegate } from '../db/timeBlocks';
import { sendInstantBookingConfirmationEmail, sendRescheduledBookingEmail, sendShopCancelledBookingEmail } from '../email/sender';

import { ANY_BARBER_ID } from './constants';
import { canCancelOrReschedule, canShopAdminCancelByLeadTime } from './policies';
import { generateSlots } from './slots';
import { addMinutes, londonDayOfWeekFromIsoDate, toUtcFromLondon } from './time';
import { generateToken, hashToken } from './tokens';
const CANCELLED_BOOKING_MESSAGE = 'This booking is already cancelled. Please create a new booking.';
const BOOKING_DATABASE_UNAVAILABLE_STATUS = 503;



function resolvePublicSiteUrl(): string {
  const configured = (import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? '').trim();
  if (configured) return configured.replace(/\/$/, '');

  return 'https://kersivo.co.uk';
}



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
function rethrowBookingQuotaError(error: unknown): never {
  if (isPrismaQuotaExceededError(error)) {
    throw new BookingActionError(PUBLIC_BOOKING_UNAVAILABLE_MESSAGE, BOOKING_DATABASE_UNAVAILABLE_STATUS);
  }

  throw error;
}


async function resolveManageTokenBooking(token: string) {
  try {
    const hashed = hashToken(token);
    const booking = await prisma.booking.findFirst({ where: { manageTokenHash: hashed }, include: { barber: true, service: true } });
    if (!booking) throw new BookingActionError('Invalid token.');

    if (isCancelledStatus(booking.status)) {
      throw new BookingActionError(CANCELLED_BOOKING_MESSAGE, 409);
    }

    return booking;
  } catch (error) {
    rethrowBookingQuotaError(error);
  }

}

export async function getRescheduleTokenStatus(token: string): Promise<{ valid: true } | { valid: false; message: string }> {
  try {
    await resolveManageTokenBooking(token);
    return { valid: true };
  } catch (error) {
    if (error instanceof BookingActionError) {
      return { valid: false, message: error.message };
    }
    if (isPrismaQuotaExceededError(error)) {
      return { valid: false, message: PUBLIC_BOOKING_UNAVAILABLE_MESSAGE };
    }


    return { valid: false, message: 'Unable to validate booking token.' };
  }
}

async function getPrimaryShopId(tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const shop = await client.shopSettings.findFirstOrThrow({ select: { id: true } });
  return shop.id;
}

async function upsertClientForBooking(
  tx: Prisma.TransactionClient,
  input: { email: string; fullName?: string | null; phone?: string | null }
) {
  const shopId = await getPrimaryShopId(tx);
  const clientDelegate = (tx as Prisma.TransactionClient & { client?: { upsert?: Function } }).client;

  if (!clientDelegate || typeof clientDelegate.upsert !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Prisma delegate "client" is unavailable on transaction client. Check generated Prisma client + schema model names.', {
        delegates: Object.keys(tx as object).filter((key) => !key.startsWith('$')).sort()
      });
    }

    throw new Error('Database client model delegate is unavailable. Expected `prisma.client` from `model Client`. Run `npx prisma generate` after schema changes.');
  }

  return clientDelegate.upsert({

    where: { shopId_email: { shopId, email: input.email } },
    update: {
      fullName: input.fullName ?? undefined,
      phone: input.phone ?? undefined
    },
    create: {
      shopId,
      email: input.email,
      fullName: input.fullName ?? null,
      phone: input.phone ?? null
    }
  });
}

async function listEligibleBarbersForService(serviceId: string) {
  return prisma.barber.findMany({
    where: {
      active: true,
      barberServices: {
        some: { serviceId }
      }
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true }
  });
}

async function getAvailableSlotsForBarber(input: {

  barberId: string;
  date: string;
  service: Service;
  settings: ShopSettings;
  ignoreBookingId?: string;
}) {
  const dayOfWeek = londonDayOfWeekFromIsoDate(input.date);
  if (dayOfWeek == null) throw new Error('Invalid booking date.');

  const dayStartUtc = toUtcFromLondon(input.date, 0);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);
  const timeBlockDelegate = getTimeBlockDelegate();

  const [rules, bookings, timeOff, timeBlocks] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { barberId: input.barberId, active: true, dayOfWeek } }),
    prisma.booking.findMany({
      where: {
        barberId: input.barberId,
        id: input.ignoreBookingId ? { not: input.ignoreBookingId } : undefined,
        status: { in: [BookingStatus.BOOKED] },
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc }
      },
      select: { startAt: true, endAt: true }
    }),
    prisma.barberTimeOff.findMany({
      where: {
        barberId: input.barberId,
        startsAt: { lt: dayEndUtc },
        endsAt: { gt: dayStartUtc }
      },
      select: { startsAt: true, endsAt: true }
    }),
    timeBlockDelegate
      ? timeBlockDelegate.findMany({
          where: {
            shopId: input.settings.id,
            OR: [{ barberId: input.barberId }, { barberId: null }],
            startAt: { lt: dayEndUtc },
            endAt: { gt: dayStartUtc }
          },
          select: { startAt: true, endAt: true }
        })
      : Promise.resolve([])
  ]);

  return generateSlots({
    date: input.date,
    service: input.service,
    rules,
    confirmedBookings: bookings,
    timeOff,
    timeBlocks,
    settings: input.settings
  });
}

export async function getAvailabilitySlots(input: { serviceId: string; barberId: string; date: string; ignoreBookingId?: string }) {
  try {
    const settings = await prisma.shopSettings.findFirstOrThrow();
    const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
    if (!service.isActive) {
      return { slots: [], service, settings };
    }
    if (input.barberId === ANY_BARBER_ID) {
      const eligibleBarbers = await listEligibleBarbersForService(input.serviceId);
      const slotGroups = await Promise.all(
        eligibleBarbers.map(async (barber) =>
          getAvailableSlotsForBarber({
            barberId: barber.id,
            date: input.date,
            service,
            settings,
            ignoreBookingId: input.ignoreBookingId
          })
        )
      );

      const slots = Array.from(new Set(slotGroups.flat())).sort((left, right) => left.localeCompare(right));
      return { slots, service, settings };
    }

    const slots = await getAvailableSlotsForBarber({
      barberId: input.barberId,
      date: input.date,
      service,
      settings,
      ignoreBookingId: input.ignoreBookingId
    });

    return { slots, service, settings };
      } catch (error) {
    rethrowBookingQuotaError(error);

  }

}

async function ensureRequestedSlotSelectable(input: {
  barberId: string;
  date: string;
  time: string;
  service: Service;
  settings: ShopSettings;
  ignoreBookingId?: string;
  }) {
  const availableSlots = await getAvailableSlotsForBarber(input);

  if (!availableSlots.includes(input.time)) {
    throw new Error('Selected time is no longer available.');
  }
}

async function ensureSlotAvailable(
  tx: Prisma.TransactionClient,
  input: {
    barberId: string;
    startAt: Date;
    endAt: Date;
    ignoreBookingId?: string;
  }
) {
  const overlapping = await tx.booking.findFirst({
    where: {
      barberId: input.barberId,
      id: input.ignoreBookingId ? { not: input.ignoreBookingId } : undefined,
      status: { in: [BookingStatus.BOOKED] },
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

async function resolveRequestedBarber(input: {
  barberId: string;
  serviceId: string;
  date: string;
  time: string;
  service: Service;
  settings: ShopSettings;
  ignoreBookingId?: string;
}) {
  if (input.barberId !== ANY_BARBER_ID) {
    const [barber, barberService] = await Promise.all([
      prisma.barber.findUnique({
        where: { id: input.barberId },
        select: { id: true, active: true, name: true }
      }),
      prisma.barberService.findUnique({
        where: { barberId_serviceId: { barberId: input.barberId, serviceId: input.serviceId } },
        select: { serviceId: true }
      })
    ]);

    if (!barber || !barber.active) throw new Error('Selected barber is unavailable for new bookings.');
    if (!barberService) throw new Error('Selected barber does not provide this service.');

    await ensureRequestedSlotSelectable({
      barberId: input.barberId,
      date: input.date,
      time: input.time,
      service: input.service,
      settings: input.settings,
      ignoreBookingId: input.ignoreBookingId
    });

    return barber;
  }

  const eligibleBarbers = await listEligibleBarbersForService(input.serviceId);

  for (const barber of eligibleBarbers) {
    const availableSlots = await getAvailableSlotsForBarber({
      barberId: barber.id,
      date: input.date,
      service: input.service,
      settings: input.settings,
      ignoreBookingId: input.ignoreBookingId
    });

    if (availableSlots.includes(input.time)) {
      return {
        id: barber.id,
        active: true,
        name: barber.name
      };
    }
  }

  throw new Error('Selected time is no longer available for any barber.');
}


export async function createInstantBooking(input: {
  serviceId: string;
  barberId: string;
  date: string;
  time: string;
  fullName: string;
  email: string;
  phone?: string;

}) {
  try {
    const settings = await prisma.shopSettings.findFirstOrThrow();
    const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
    if (!service.isActive) throw new Error('Selected service is unavailable for new bookings.');

    const resolvedBarber = await resolveRequestedBarber({
      barberId: input.barberId,
      serviceId: input.serviceId,
      date: input.date,
      time: input.time,
      service,
      settings
    });


    const [h, m] = input.time.split(':').map(Number);
    const startAt = toUtcFromLondon(input.date, h * 60 + m);
    const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));
    const manageToken = generateToken();


    const booking = await prisma.$transaction(
      async (tx) => {
        await ensureSlotAvailable(tx, { barberId: resolvedBarber.id, startAt, endAt });

        const client = await upsertClientForBooking(tx, {
          email: input.email,
                    fullName: input.fullName,
          phone: input.phone || null
        });

        return tx.booking.create({
          data: {
            service: { connect: { id: input.serviceId } },
            serviceNameAtBooking: service.name,
            servicePricePenceAtBooking: service.pricePence,
            serviceDurationMinutesAtBooking: service.durationMinutes,
            totalPricePence: service.pricePence,
            barber: { connect: { id: resolvedBarber.id } },
            client: { connect: { id: client.id } },
            fullName: input.fullName,
            email: input.email,
            phone: input.phone || null,
            startAt,
            endAt,
            status: BookingStatus.BOOKED,
            confirmTokenHash: null,
            confirmTokenExpiresAt: null,
            manageTokenHash: hashToken(manageToken),
            manageTokenExpiresAt: null,
            paymentRequired: false,
            paymentStatus: null
          },
          include: { service: true, barber: true }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const baseUrl = resolvePublicSiteUrl();
    await sendInstantBookingConfirmationEmail({
      to: booking.email,
      fullName: booking.fullName,
      cancelUrl: `${baseUrl}/book/cancel?token=${manageToken}`,
      rescheduleUrl: `${baseUrl}/book/reschedule?token=${manageToken}`,
      shopName: settings.name,
      serviceName: booking.serviceNameAtBooking ?? booking.service.name,
      barberName: booking.barber.name,
      startAt: booking.startAt
    });

    return booking;
  } catch (error) {
    rethrowBookingQuotaError(error);
  }

}

export async function confirmBookingByToken(token: string) {
    void token;
  throw new BookingActionError('Email confirmation is no longer required. Your booking is confirmed immediately after submission.', 410);

}

export async function cancelByManageToken(token: string) {
  try {
    const booking = await resolveManageTokenBooking(token);
    const settings = await prisma.shopSettings.findFirstOrThrow();
    if (!canCancelOrReschedule(booking.startAt, settings.cancellationWindowHours)) {
      throw new BookingActionError('Cancellation window has passed.', 409);
    }

    return prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELLED_BY_CLIENT } });
  } catch (error) {
    rethrowBookingQuotaError(error);
  }

}

export async function cancelByShop(input: { bookingId: string; reason?: string }) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { barber: true, service: true }
  });

  if (!booking) {
    throw new BookingActionError('Booking not found.', 404);
  }
  if (isCancelledStatus(booking.status)) {
    throw new BookingActionError('This booking has already been cancelled.', 409);

  }

  if (!canShopAdminCancelByLeadTime(booking.startAt, Date.now())) {
    throw new BookingActionError(
      'This booking can only be cancelled more than 1 hour before it starts.',
      409
    );
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
      serviceName: updatedBooking.serviceNameAtBooking ?? updatedBooking.service.name,
      barberName: updatedBooking.barber.name,
      startAt: updatedBooking.startAt,
      reason: input.reason
    });
  } catch (error) {
    console.warn('Failed to send shop cancellation email.', {
      bookingId: updatedBooking.id,
      error: error instanceof Error ? error.message : error
    });

    if (error instanceof Error && error.stack) {
      console.warn(error.stack);
    }
  }


  return updatedBooking;
}


export async function rescheduleByToken(input: { token: string; serviceId: string; barberId: string; date: string; time: string }) {
  try {
    const existing = await resolveManageTokenBooking(input.token);
    const settings = await prisma.shopSettings.findFirstOrThrow();
    if (!canCancelOrReschedule(existing.startAt, settings.rescheduleWindowHours)) {
      throw new BookingActionError('Reschedule window has passed.', 409);
    }

    const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
    if (!service.isActive) throw new Error('Selected service is unavailable for new bookings.');

    const resolvedBarber = await resolveRequestedBarber({
      barberId: input.barberId,
      serviceId: input.serviceId,
      date: input.date,
      time: input.time,
      service,
      settings,
      ignoreBookingId: existing.id
    });

    const [h, m] = input.time.split(':').map(Number);
    const startAt = toUtcFromLondon(input.date, h * 60 + m);
    const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));
    const updatedBooking = await prisma.$transaction(
      async (tx) => {
        await ensureSlotAvailable(tx, { barberId: resolvedBarber.id, startAt, endAt, ignoreBookingId: existing.id });

        return tx.booking.update({
          where: { id: existing.id },
          data: {
            service: { connect: { id: input.serviceId } },
            serviceNameAtBooking: service.name,
            servicePricePenceAtBooking: service.pricePence,
            serviceDurationMinutesAtBooking: service.durationMinutes,
            totalPricePence: service.pricePence,
            barber: { connect: { id: resolvedBarber.id } },
            startAt,
            endAt,
            rescheduledAt: new Date(),
            originalStartAt: existing.originalStartAt ?? existing.startAt,
            originalEndAt: existing.originalEndAt ?? existing.endAt,
            status: BookingStatus.BOOKED
          },
          include: { service: true, barber: true }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const baseUrl = resolvePublicSiteUrl();
    await sendRescheduledBookingEmail({
      to: updatedBooking.email,
      fullName: updatedBooking.fullName,
      cancelUrl: `${baseUrl}/book/cancel?token=${input.token}`,
      rescheduleUrl: `${baseUrl}/book/reschedule?token=${input.token}`,
      shopName: settings.name,
      serviceName: updatedBooking.serviceNameAtBooking ?? updatedBooking.service.name,
      barberName: updatedBooking.barber.name,
      startAt: updatedBooking.startAt,
      previousStartAt: updatedBooking.originalStartAt,
      previousEndAt: updatedBooking.originalEndAt
    });

    return updatedBooking;
  } catch (error) {
    rethrowBookingQuotaError(error);
  }

}
