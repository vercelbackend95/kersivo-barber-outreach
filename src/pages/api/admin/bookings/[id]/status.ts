export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import {
  getAllowedManualBookingActions,
  getEffectiveBookingStatus,
  isManualBookingAction,
} from '../../../../../lib/booking/operationalStatus';

export const PATCH: APIRoute = async (ctx) => {
  const unauthorized = await requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const bookingId = ctx.params.id;
  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'Missing booking id.' }), { status: 400 });
  }

  const payload = (await ctx.request.json().catch(() => null)) as { status?: unknown } | null;
  if (!payload || typeof payload.status !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid payload: status string required.' }), {
      status: 400,
    });
  }

  const requestedAction = payload.status.trim().toUpperCase();
  if (!isManualBookingAction(requestedAction)) {
    return new Response(
      JSON.stringify({
        error: 'Only manual actions are allowed: NO_SHOW, CANCELLED_BY_SHOP, RESCHEDULE.',
      }),
      { status: 422 },
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, startAt: true, endAt: true },
  });

  if (!booking) {
    return new Response(JSON.stringify({ error: 'Booking not found.' }), { status: 404 });
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

  const allowed = getAllowedManualBookingActions({
    startAt: booking.startAt,
    endAt: booking.endAt,
  });
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
    where: { id: bookingId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: requestedAction as any },
    select: { id: true, status: true, updatedAt: true },
  });

  return new Response(JSON.stringify({ booking: updated }));
};
