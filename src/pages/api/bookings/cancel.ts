export const prerender = false;

import type { APIRoute } from 'astro';
import { tokenSchema } from '../../../lib/booking/schemas';
import { BookingActionError, cancelByManageToken } from '../../../lib/booking/service';

export const POST: APIRoute = async ({ request }) => {
  const parsed = tokenSchema.safeParse(await request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid token.' }), { status: 400 });

  try {
    const booking = await cancelByManageToken(parsed.data.token);
    return new Response(JSON.stringify({ booking, message: 'Your booking has been cancelled successfully.' }), { status: 200 });
  } catch (error) {
     if (error instanceof BookingActionError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.statusCode });
    }

    return new Response(JSON.stringify({ error: 'Unable to cancel booking right now. Please try again later.' }), { status: 500 });

  }
};
