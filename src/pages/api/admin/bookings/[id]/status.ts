export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../../../lib/admin/auth';
import { accessCan, requireAnyPermission } from '@/lib/admin/rbac/can';
import { assertBookingAccessible } from '@/lib/admin/rbac/scope';
import { bookingWhereForShop } from '../../../../../lib/admin/shopScoped';
import { prisma } from '../../../../../lib/db/client';
import {
  canCorrectHistoryBooking,
  getAllowedManualBookingActions,
  getEffectiveBookingStatus,
  isDayOfBookingAction,
  isHistoryBookingCorrection,
  isManualBookingAction,
  isShopBookingAction,
  type BookingActionRoleScope,
} from '../../../../../lib/booking/operationalStatus';

function roleScopeForAccess(access: { role: string }): BookingActionRoleScope {
  return access.role === 'BARBER' ? 'barber' : 'shop';
}

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['bookings.manage', 'bookings.self']);
  if (denied) return denied;

  const bookingId = ctx.params.id;
  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'Missing booking id.' }), { status: 400 });
  }

  const scoped = await assertBookingAccessible(access, bookingId);
  if (scoped instanceof Response) return scoped;

  const payload = (await ctx.request.json().catch(() => null)) as { status?: unknown } | null;
  if (!payload || typeof payload.status !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid payload: status string required.' }), {
      status: 400,
    });
  }

  const requestedAction = payload.status.trim().toUpperCase();
  const scope = roleScopeForAccess(access);

  if (access.role === 'BARBER' && (isShopBookingAction(requestedAction) || requestedAction === 'CANCELLED_BY_CLIENT')) {
    return new Response(
      JSON.stringify({
        error: 'Barbers can only set Arrived, In progress, Completed, or No-show.',
      }),
      { status: 403 },
    );
  }

  if (!isManualBookingAction(requestedAction) && !isHistoryBookingCorrection(requestedAction)) {
    return new Response(
      JSON.stringify({
        error:
          'Only manual actions or history corrections are allowed: ARRIVED, IN_PROGRESS, COMPLETED, NO_SHOW, CANCELLED_BY_CLIENT, CANCELLED_BY_SHOP, RESCHEDULE.',
      }),
      { status: 422 },
    );
  }

  const booking = await prisma.booking.findFirst({
    where: bookingWhereForShop(bookingId, access.shopId),
    select: { id: true, status: true, startAt: true, endAt: true },
  });

  if (!booking) {
    return new Response(JSON.stringify({ error: 'Booking not found.' }), { status: 404 });
  }

  // Owner/Manager history sheet: cancel corrections after end (not day-of path).
  const isShopHistoryCorrection =
    accessCan(access, 'bookings.manage') &&
    isHistoryBookingCorrection(requestedAction) &&
    !isDayOfBookingAction(requestedAction) &&
    canCorrectHistoryBooking({
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
    });

  if (isShopHistoryCorrection) {
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: requestedAction as any },
      select: { id: true, status: true, updatedAt: true },
    });

    return new Response(
      JSON.stringify({
        booking: {
          ...updated,
          effectiveStatus: requestedAction,
        },
      }),
    );
  }

  // Owner/Manager history: COMPLETED / NO_SHOW after end (legacy sheet values).
  if (
    accessCan(access, 'bookings.manage') &&
    (requestedAction === 'COMPLETED' || requestedAction === 'NO_SHOW') &&
    canCorrectHistoryBooking({
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
    }) &&
    !getAllowedManualBookingActions(
      { startAt: booking.startAt, endAt: booking.endAt },
      scope,
    ).includes(requestedAction)
  ) {
    const storedStatus = requestedAction === 'COMPLETED' ? 'COMPLETED' : requestedAction;
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: storedStatus as any },
      select: { id: true, status: true, updatedAt: true },
    });

    return new Response(
      JSON.stringify({
        booking: {
          ...updated,
          effectiveStatus: requestedAction,
        },
      }),
    );
  }

  if (!isManualBookingAction(requestedAction)) {
    return new Response(
      JSON.stringify({ error: 'History status corrections are available only after the appointment has ended.' }),
      { status: 422 },
    );
  }

  const effectiveStatus = getEffectiveBookingStatus({
    status: booking.status,
    startAt: booking.startAt,
    endAt: booking.endAt,
  });

  if (
    effectiveStatus === 'CANCELLED_BY_CLIENT' ||
    effectiveStatus === 'CANCELLED_BY_ADMIN' ||
    effectiveStatus === 'CANCELLED_BY_SHOP' ||
    effectiveStatus === 'NO_SHOW'
  ) {
    return new Response(
      JSON.stringify({
        error: `Action is not allowed for booking in status ${effectiveStatus}.`,
      }),
      { status: 422 },
    );
  }

  const allowed = getAllowedManualBookingActions(
    {
      startAt: booking.startAt,
      endAt: booking.endAt,
    },
    scope,
  );
  if (!allowed.includes(requestedAction)) {
    return new Response(
      JSON.stringify({
        error: `Action ${requestedAction} is not allowed at this time.`,
      }),
      { status: 422 },
    );
  }

  if (requestedAction === 'RESCHEDULE') {
    return new Response(
      JSON.stringify({
        error: 'Use the reschedule action flow to move this booking to a new time.',
      }),
      { status: 422 },
    );
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: requestedAction as any },
    select: { id: true, status: true, updatedAt: true },
  });

  if (requestedAction === 'NO_SHOW') {
    const { forfeitBookingDeposit } = await import('../../../../../lib/booking/depositMoney');
    await forfeitBookingDeposit(booking.id);
  }

  return new Response(JSON.stringify({ booking: updated }));
};
