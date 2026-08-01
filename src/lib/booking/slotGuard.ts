import { BookingStatus, type Prisma } from '@prisma/client';

/**
 * Thrown when a requested interval collides with another hold/booking
 * or a barber time-off block. Messages match the historical public-path
 * Error strings so callers that catch bare Error keep the same UX.
 */
export class SlotUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlotUnavailableError';
  }
}

/**
 * Transactional occupancy check used by create, client reschedule,
 * admin service-change, and force-reschedule.
 *
 * Checks overlapping BOOKED / PENDING_PAYMENT bookings and barberTimeOff.
 * Does not enforce opening hours, lead time, or TimeBlock — those belong
 * to the slot-grid path (ensureRequestedSlotSelectable / generateSlots).
 */
export async function ensureSlotAvailable(
  tx: Prisma.TransactionClient,
  input: {
    barberId: string;
    startAt: Date;
    endAt: Date;
    ignoreBookingId?: string;
  },
) {
  const overlapping = await tx.booking.findFirst({
    where: {
      barberId: input.barberId,
      id: input.ignoreBookingId ? { not: input.ignoreBookingId } : undefined,
      status: { in: [BookingStatus.BOOKED, BookingStatus.PENDING_PAYMENT] },
      NOT: [{ endAt: { lte: input.startAt } }, { startAt: { gte: input.endAt } }],
    },
  });

  if (overlapping) throw new SlotUnavailableError('This slot is no longer available.');

  const block = await tx.barberTimeOff.findFirst({
    where: {
      barberId: input.barberId,
      NOT: [{ endsAt: { lte: input.startAt } }, { startsAt: { gte: input.endAt } }],
    },
  });

  if (block) throw new SlotUnavailableError('Selected time is blocked.');
}
