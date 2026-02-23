export const prerender = false;

import type { APIRoute } from 'astro';
import { rescheduleSchema } from '../../../lib/booking/schemas';
import { BookingActionError, rescheduleByToken } from '../../../lib/booking/service';

export const POST: APIRoute = async ({ request }) => {
  const parsed = rescheduleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request', issues: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const booking = await rescheduleByToken(parsed.data);
    return new Response(JSON.stringify({ booking }));
  } catch (error) {
    const status = error instanceof BookingActionError ? error.statusCode : 400;
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to reschedule.' }), { status });
  }
};
