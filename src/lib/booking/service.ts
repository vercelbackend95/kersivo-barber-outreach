import {
  BookingStatus,
  EmailOutboundPurpose,
  PaymentStatus,
  Prisma,
  type Service,
  type ShopSettings,
} from '@prisma/client';
import { prisma } from '../db/client';
import { PUBLIC_BOOKING_UNAVAILABLE_MESSAGE, isPrismaQuotaExceededError } from '../db/resilience';
import { getTimeBlockDelegate } from '../db/timeBlocks';
import {
  buildInstantBookingConfirmationEmail,
  buildRescheduledBookingEmail,
  sendShopCancelledBookingEmail,
} from '../email/sender';
import { enqueueEmail, tryDeliverOutboxEmail } from '../email/outbox';
import { smsReminderClearData } from '../sms/reminders';
import { emailReminderClearData } from '../email/reminders';

import { ANY_BARBER_ID } from './constants';
import { canCancelOrReschedule, canShopAdminCancelByLeadTime } from './policies';
import { generateSlots } from './slots';
import { ensureSlotAvailable } from './slotGuard';
import { addMinutes, londonDayOfWeekFromIsoDate, toUtcFromLondon } from './time';
import { generateToken, hashToken } from './tokens';
import { intersectMinutesWithShopDay } from '@/lib/admin/shopOpeningHours';
import {
  getShopPublicActivityPauseOnDate,
} from '@/lib/admin/shopPublicActivity';
import { OWNER_TEST_BOOKING_NOTES_PREFIX } from './sandboxBookings';
import { canCollectBookingDeposit, resolveBookingDepositPence } from './depositGate';
import {
  depositRefundClientMessage,
  forfeitBookingDeposit,
  requestDepositRefund,
  attemptDepositRefund,
  type DepositRefundOutcome,
} from './depositMoney';
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
    const booking = await prisma.booking.findFirst({
      where: { manageTokenHash: hashed },
      include: { barber: true, service: true },
    });
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

async function loadShopSettingsForService(serviceId: string) {
  const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
  const settings = await prisma.shopSettings.findUniqueOrThrow({ where: { id: service.shopId } });
  return { service, settings };
}

async function upsertClientForBooking(
  tx: Prisma.TransactionClient,
  input: { shopId: string; email: string; fullName?: string | null; phone?: string | null }
) {
  const { shopId } = input;
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

async function listEligibleBarbersForService(serviceId: string, shopId: string) {
  return prisma.barber.findMany({
    where: {
      active: true,
      shopId,
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

  const [rules, bookings, timeOff, timeBlocks, shopHourRows] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { barberId: input.barberId, active: true, dayOfWeek } }),
    prisma.booking.findMany({
      where: {
        barberId: input.barberId,
        id: input.ignoreBookingId ? { not: input.ignoreBookingId } : undefined,
        status: { in: [BookingStatus.BOOKED, BookingStatus.PENDING_PAYMENT] },
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
      : Promise.resolve([]),
    prisma.shopOpeningHours.findMany({
      where: { shopId: input.settings.id },
      select: { dayOfWeek: true, active: true, startMinutes: true, endMinutes: true },
    }),
  ]);

  let effectiveRules = rules;
  if (shopHourRows.length > 0) {
    const shopDay = shopHourRows.find((row) => row.dayOfWeek === dayOfWeek && row.active);
    if (!shopDay) {
      return [];
    }
    effectiveRules = [];
    for (const rule of rules) {
      const intersected = intersectMinutesWithShopDay(shopDay, rule.startMinutes, rule.endMinutes);
      if (!intersected) continue;
      effectiveRules.push({
        ...rule,
        startMinutes: intersected.startMinutes,
        endMinutes: intersected.endMinutes,
      });
    }
    if (effectiveRules.length === 0) return [];
  }

  return generateSlots({
    date: input.date,
    service: input.service,
    rules: effectiveRules,
    confirmedBookings: bookings,
    timeOff,
    timeBlocks,
    settings: input.settings
  });
}

export async function getAvailabilitySlots(input: {
  serviceId: string;
  barberId: string;
  date: string;
  ignoreBookingId?: string;
  /** Owner/preview test booking — still show slots while public activity is paused. */
  ignorePublicActivityPause?: boolean;
}) {
  try {
    const { service, settings } = await loadShopSettingsForService(input.serviceId);
    if (!input.ignorePublicActivityPause) {
      const pauseOnDate = await getShopPublicActivityPauseOnDate(settings.id, input.date);
      if (pauseOnDate.paused) {
        return {
          slots: [] as string[],
          service,
          settings,
          paused: true as const,
          pauseReason: pauseOnDate.reason,
        };
      }
    }
    if (!service.isActive) {
      return { slots: [], service, settings };
    }
    if (input.barberId === ANY_BARBER_ID) {
      const eligibleBarbers = await listEligibleBarbersForService(input.serviceId, service.shopId);
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
        select: { id: true, active: true, name: true, shopId: true }
      }),
      prisma.barberService.findUnique({
        where: { barberId_serviceId: { barberId: input.barberId, serviceId: input.serviceId } },
        select: { serviceId: true }
      })
    ]);

    if (!barber || !barber.active) throw new Error('Selected barber is unavailable for new bookings.');
    if (barber.shopId !== input.service.shopId) throw new Error('Selected barber is unavailable for new bookings.');
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

  const eligibleBarbers = await listEligibleBarbersForService(input.serviceId, input.service.shopId);

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

function scopeBookingIdempotencyKey(shopId: string, clientKey: string): string {
  return `${shopId}:${clientKey.trim()}`;
}

async function loadBookingForCreateResponse(bookingId: string) {
  return prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { service: true, barber: true },
  });
}

export async function createInstantBooking(
  input: {
    serviceId: string;
    barberId: string;
    date: string;
    time: string;
    fullName: string;
    email: string;
    phone?: string;
    idempotencyKey?: string;
  },
  options: {
    /** When set, service must belong to this shop. */
    requiredShopId?: string;
    /** Prefixed into booking notes (e.g. public demo / owner test). */
    notesPrefix?: string;
    /** Skip confirmation email (public demo noise). */
    skipConfirmationEmail?: boolean;
    /**
     * When true, evaluate deposit gate for the shop and create PENDING_PAYMENT
     * hold if deposits are required. Sandbox / [TEST] never collects.
     */
    allowDepositCollection?: boolean;
  } = {},
) {
  try {
    const { service, settings } = await loadShopSettingsForService(input.serviceId);
    if (options.requiredShopId && service.shopId !== options.requiredShopId) {
      throw new BookingActionError('Selected service is not available for booking.', 403);
    }
    const isAdminSandbox =
      options.notesPrefix === OWNER_TEST_BOOKING_NOTES_PREFIX ||
      Boolean(options.notesPrefix?.startsWith(`${OWNER_TEST_BOOKING_NOTES_PREFIX} `));
    if (!isAdminSandbox) {
      const pauseOnDate = await getShopPublicActivityPauseOnDate(settings.id, input.date);
      if (pauseOnDate.paused) {
        throw new BookingActionError(
          pauseOnDate.reason ||
            'This barbershop is temporarily closed. Bookings and retail are unavailable.',
          422,
        );
      }
    }
    if (!service.isActive) throw new Error('Selected service is unavailable for new bookings.');

    const clientIdempotencyKey = input.idempotencyKey?.trim() || '';
    const scopedIdempotencyKey = clientIdempotencyKey
      ? scopeBookingIdempotencyKey(service.shopId, clientIdempotencyKey)
      : null;

    if (scopedIdempotencyKey) {
      const existing = await prisma.booking.findUnique({
        where: { idempotencyKey: scopedIdempotencyKey },
        include: { service: true, barber: true },
      });
      if (existing) {
        const shopName =
          (
            await prisma.shopSettings.findUnique({
              where: { id: service.shopId },
              select: { name: true },
            })
          )?.name ?? settings.name;
        return {
          ...existing,
          manageToken: null as string | null,
          depositRequired: existing.paymentRequired && existing.status === BookingStatus.PENDING_PAYMENT,
          shopName,
          replayed: true as const,
        };
      }
    }

    const resolvedBarber = await resolveRequestedBarber({
      barberId: input.barberId,
      serviceId: input.serviceId,
      date: input.date,
      time: input.time,
      service,
      settings
    });

    if (options.requiredShopId && 'shopId' in resolvedBarber && resolvedBarber.shopId !== options.requiredShopId) {
      throw new BookingActionError('Selected barber is not available for booking.', 403);
    }

    const [h, m] = input.time.split(':').map(Number);
    const startAt = toUtcFromLondon(input.date, h * 60 + m);
    const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));
    const manageToken = generateToken();
    const notes =
      options.notesPrefix != null
        ? `${options.notesPrefix} Sandbox booking — not counted in live reports.`
        : null;

    const shopForDeposit = await prisma.shopSettings.findUniqueOrThrow({
      where: { id: service.shopId },
      select: {
        id: true,
        shopPaidAt: true,
        smsRemindersEnabled: true,
        depositsEnabled: true,
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        pendingConfirmationMins: true,
        name: true,
      },
    });

    const depositPence = resolveBookingDepositPence(service.pricePence);
    const collectDeposit =
      Boolean(options.allowDepositCollection) &&
      !isAdminSandbox &&
      canCollectBookingDeposit(shopForDeposit) &&
      depositPence > 0;

    // Hold window: floor 5m, default 15m, cap 120m so a DB-only value cannot outlive
    // Stripe's 24h session max in a way that leaves a payable session after release.
    const holdMins = Math.min(120, Math.max(5, shopForDeposit.pendingConfirmationMins || 15));
    const paymentExpiresAt = collectDeposit
      ? new Date(Date.now() + holdMins * 60 * 1000)
      : null;

    const baseUrl = resolvePublicSiteUrl();
    let outboxId: string | null = null;

    let booking;
    try {
      booking = await prisma.$transaction(
        async (tx) => {
          await ensureSlotAvailable(tx, { barberId: resolvedBarber.id, startAt, endAt });

          const client = await upsertClientForBooking(tx, {
            shopId: service.shopId,
            email: input.email,
            fullName: input.fullName,
            phone: input.phone || null
          });

          const created = await tx.booking.create({
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
              notes,
              startAt,
              endAt,
              status: collectDeposit ? BookingStatus.PENDING_PAYMENT : BookingStatus.BOOKED,
              confirmTokenHash: null,
              confirmTokenExpiresAt: null,
              manageTokenHash: hashToken(manageToken),
              manageTokenExpiresAt: null,
              paymentRequired: collectDeposit,
              depositAmountPence: collectDeposit ? depositPence : null,
              paymentStatus: collectDeposit ? PaymentStatus.UNPAID : null,
              paymentExpiresAt,
              idempotencyKey: scopedIdempotencyKey,
            },
            include: { service: true, barber: true }
          });

          if (!collectDeposit && !options.skipConfirmationEmail) {
            const rendered = buildInstantBookingConfirmationEmail({
              to: created.email,
              fullName: created.fullName,
              cancelUrl: `${baseUrl}/book/cancel?token=${manageToken}`,
              rescheduleUrl: `${baseUrl}/book/reschedule?token=${manageToken}`,
              shopName: settings.name,
              serviceName: created.serviceNameAtBooking ?? created.service.name,
              barberName: created.barber.name,
              startAt: created.startAt,
            });
            const outbound = await enqueueEmail(tx, {
              shopId: service.shopId,
              bookingId: created.id,
              purpose: EmailOutboundPurpose.BOOKING_CONFIRMATION,
              to: created.email,
              subject: rendered.subject,
              html: rendered.html,
            });
            outboxId = outbound.id;
          }

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        scopedIdempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await loadBookingForCreateResponse(
          (
            await prisma.booking.findUniqueOrThrow({
              where: { idempotencyKey: scopedIdempotencyKey },
              select: { id: true },
            })
          ).id,
        );
        return {
          ...existing,
          manageToken: null as string | null,
          depositRequired: existing.paymentRequired && existing.status === BookingStatus.PENDING_PAYMENT,
          shopName: shopForDeposit.name,
          replayed: true as const,
        };
      }
      throw error;
    }

    await tryDeliverOutboxEmail(outboxId);

    return {
      ...booking,
      manageToken,
      depositRequired: collectDeposit,
      shopName: shopForDeposit.name,
      replayed: false as const,
    };
  } catch (error) {
    rethrowBookingQuotaError(error);
  }
}

export async function confirmBookingByToken(token: string) {
    void token;
  throw new BookingActionError('Email confirmation is no longer required. Your booking is confirmed immediately after submission.', 410);

}

export async function cancelByManageToken(token: string): Promise<{
  booking: Awaited<ReturnType<typeof prisma.booking.update>>;
  refundOutcome: DepositRefundOutcome | null;
  message: string;
}> {
  try {
    const booking = await resolveManageTokenBooking(token);
    const settings = await prisma.shopSettings.findUniqueOrThrow({
      where: { id: booking.barber.shopId },
    });

    // Unpaid holds: allow cancel anytime and expire the hold.
    if (booking.status === BookingStatus.PENDING_PAYMENT) {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED_BY_CLIENT },
      });
      return {
        booking: updated,
        refundOutcome: null,
        message: depositRefundClientMessage(null),
      };
    }

    const inWindow = canCancelOrReschedule(booking.startAt, settings.cancellationWindowHours);
    if (!inWindow) {
      // Outside window with paid deposit → forfeit, still allow cancel record.
      if (booking.paymentRequired && booking.paymentStatus === PaymentStatus.PAID) {
        await forfeitBookingDeposit(booking.id);
        const updated = await prisma.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.CANCELLED_BY_CLIENT },
        });
        return {
          booking: updated,
          refundOutcome: 'skipped_forfeited',
          message: depositRefundClientMessage('skipped_forfeited'),
        };
      }
      throw new BookingActionError('Cancellation window has passed.', 409);
    }

    let refundOutcome: DepositRefundOutcome | null = null;
    if (booking.paymentRequired && booking.paymentStatus === PaymentStatus.PAID) {
      // Write-ahead ledger before status change so a crash mid-cancel still retries.
      const requested = await requestDepositRefund({
        bookingId: booking.id,
        reason: 'client_cancel_in_window',
      });
      if (requested.refund) {
        const attempted = await attemptDepositRefund(requested.refund.id);
        refundOutcome = attempted.outcome;
      } else {
        refundOutcome = requested.outcome;
      }
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED_BY_CLIENT },
    });
    return {
      booking: updated,
      refundOutcome,
      message: depositRefundClientMessage(refundOutcome),
    };
  } catch (error) {
    rethrowBookingQuotaError(error);
  }

}

export async function cancelByShop(input: { bookingId: string; shopId: string; reason?: string }) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, barber: { shopId: input.shopId } },
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

  let refundOutcome: DepositRefundOutcome | null = null;
  if (booking.paymentRequired && booking.paymentStatus === PaymentStatus.PAID) {
    // Write-ahead ledger BEFORE status change so money path is durable even if cancel crashes.
    const requested = await requestDepositRefund({
      bookingId: booking.id,
      reason: 'shop_cancel',
    });
    if (requested.refund) {
      // Status update between request and attempt is intentional: cancel is the business outcome.
      // Attempt after cancel so a Stripe hang never blocks the appointment release.
    } else {
      refundOutcome = requested.outcome;
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED_BY_SHOP
      },
      include: { barber: true, service: true }
    });

    if (requested.refund) {
      const attempted = await attemptDepositRefund(requested.refund.id);
      refundOutcome = attempted.outcome;
    }

    try {
      const settings = await prisma.shopSettings.findUniqueOrThrow({
        where: { id: input.shopId },
        select: { name: true },
      });
      await sendShopCancelledBookingEmail({
        to: updatedBooking.email,
        fullName: updatedBooking.fullName,
        shopName: settings.name,
        serviceName: updatedBooking.serviceNameAtBooking ?? updatedBooking.service.name,
        barberName: updatedBooking.barber.name,
        startAt: updatedBooking.startAt,
        reason: input.reason,
        depositRefundStatus: refundOutcome,
      });
    } catch (error) {
      // Intentional soft-fail: shop cancellation is the business outcome.
      // Do not roll back the cancel if the customer notification email fails.
      console.warn('Failed to send shop cancellation email.', {
        bookingId: updatedBooking.id,
        error: error instanceof Error ? error.message : error
      });

      if (error instanceof Error && error.stack) {
        console.warn(error.stack);
      }
    }

    return {
      booking: updatedBooking,
      refundOutcome,
      message:
        refundOutcome === 'refunded'
          ? 'Booking cancelled. Deposit refund confirmed.'
          : refundOutcome === 'pending'
            ? 'Booking cancelled. Deposit refund is being processed.'
            : refundOutcome === 'failed'
              ? 'Booking cancelled. Deposit refund failed — use Retry refund.'
              : 'Booking cancelled successfully.',
    };
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.CANCELLED_BY_SHOP
    },
    include: { barber: true, service: true }
  });

  try {
    const settings = await prisma.shopSettings.findUniqueOrThrow({
      where: { id: input.shopId },
      select: { name: true },
    });
    await sendShopCancelledBookingEmail({
      to: updatedBooking.email,
      fullName: updatedBooking.fullName,
      shopName: settings.name,
      serviceName: updatedBooking.serviceNameAtBooking ?? updatedBooking.service.name,
      barberName: updatedBooking.barber.name,
      startAt: updatedBooking.startAt,
      reason: input.reason,
      depositRefundStatus: null,
    });
  } catch (error) {
    // Intentional soft-fail: shop cancellation is the business outcome.
    // Do not roll back the cancel if the customer notification email fails.
    console.warn('Failed to send shop cancellation email.', {
      bookingId: updatedBooking.id,
      error: error instanceof Error ? error.message : error
    });

    if (error instanceof Error && error.stack) {
      console.warn(error.stack);
    }
  }


  return {
    booking: updatedBooking,
    refundOutcome: null,
    message: 'Booking cancelled successfully.',
  };
}


export async function rescheduleByToken(input: { token: string; serviceId: string; barberId: string; date: string; time: string }) {
  try {
    const existing = await resolveManageTokenBooking(input.token);
    if (existing.status === BookingStatus.PENDING_PAYMENT) {
      throw new BookingActionError('Finish deposit payment before rescheduling.', 409);
    }
    const { service, settings } = await loadShopSettingsForService(input.serviceId);
    if (service.shopId !== existing.barber.shopId) {
      throw new BookingActionError('Selected service is not available for this booking.', 403);
    }
    if (!canCancelOrReschedule(existing.startAt, settings.rescheduleWindowHours)) {
      throw new BookingActionError('Reschedule window has passed.', 409);
    }

    const maxReschedules = settings.maxClientReschedules ?? 2;
    if (existing.clientRescheduleCount >= maxReschedules) {
      throw new BookingActionError(`You can reschedule this booking at most ${maxReschedules} times.`, 409);
    }

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
    const baseUrl = resolvePublicSiteUrl();
    let outboxId: string | null = null;

    const updatedBooking = await prisma.$transaction(
      async (tx) => {
        await ensureSlotAvailable(tx, { barberId: resolvedBarber.id, startAt, endAt, ignoreBookingId: existing.id });

        const updated = await tx.booking.update({
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
            status: BookingStatus.BOOKED,
            clientRescheduleCount: existing.clientRescheduleCount + 1,
            ...smsReminderClearData,
            ...emailReminderClearData,
          },
          include: { service: true, barber: true }
        });

        const rendered = buildRescheduledBookingEmail({
          to: updated.email,
          fullName: updated.fullName,
          cancelUrl: `${baseUrl}/book/cancel?token=${input.token}`,
          rescheduleUrl: `${baseUrl}/book/reschedule?token=${input.token}`,
          shopName: settings.name,
          serviceName: updated.serviceNameAtBooking ?? updated.service.name,
          barberName: updated.barber.name,
          startAt: updated.startAt,
          previousStartAt: updated.originalStartAt,
          previousEndAt: updated.originalEndAt,
        });
        const outbound = await enqueueEmail(tx, {
          shopId: service.shopId,
          bookingId: updated.id,
          purpose: EmailOutboundPurpose.BOOKING_RESCHEDULED,
          to: updated.email,
          subject: rendered.subject,
          html: rendered.html,
        });
        outboxId = outbound.id;

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await tryDeliverOutboxEmail(outboxId);

    return updatedBooking;
  } catch (error) {
    rethrowBookingQuotaError(error);
  }

}
