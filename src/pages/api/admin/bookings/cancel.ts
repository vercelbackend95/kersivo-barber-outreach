export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../../lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { assertBookingAccessible } from '@/lib/admin/rbac/scope';
import { adminCancelBookingSchema } from '../../../../lib/booking/schemas';
import { BookingActionError, cancelByShop } from '../../../../lib/booking/service';

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['bookings.manage', 'bookings.self']);
  if (denied) return denied;

  const parsed = adminCancelBookingSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request payload.' }), { status: 400 });
  }

  const scoped = await assertBookingAccessible(access, parsed.data.bookingId);
  if (scoped instanceof Response) return scoped;

  try {
    const booking = await cancelByShop({
      bookingId: parsed.data.bookingId,
      shopId: access.shopId,
      reason: parsed.data.reason || undefined,
    });

    return new Response(JSON.stringify({ booking, message: 'Booking cancelled successfully.' }), {
      status: 200,
    });
  } catch (error) {
    if (error instanceof BookingActionError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          code: 'BOOKING_ACTION_ERROR',
          status: error.statusCode,
        }),
        { status: error.statusCode },
      );
    }

    console.error('Unhandled error while cancelling booking from admin endpoint.', error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }

    return new Response(
      JSON.stringify({ error: 'Unable to cancel booking right now. Please try again.' }),
      { status: 500 },
    );
  }
};
