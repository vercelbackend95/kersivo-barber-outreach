export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin/auth';
import { adminCancelBookingSchema } from '../../../../lib/booking/schemas';
import { BookingActionError, cancelByShop } from '../../../../lib/booking/service';

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const parsed = adminCancelBookingSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request payload.' }), { status: 400 });
  }

  try {
    const booking = await cancelByShop({
      bookingId: parsed.data.bookingId,
      reason: parsed.data.reason || undefined
    });

    return new Response(JSON.stringify({ booking, message: 'Booking cancelled successfully.' }), { status: 200 });
  } catch (error) {
    if (error instanceof BookingActionError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          code: 'BOOKING_ACTION_ERROR',
          status: error.statusCode
        }),
        { status: error.statusCode }
      );
    }

    console.error('Unhandled error while cancelling booking from admin endpoint.', error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);

    }

    return new Response(JSON.stringify({ error: 'Unable to cancel booking right now. Please try again.' }), { status: 500 });
  }
};
