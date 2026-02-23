import type { APIRoute } from 'astro';
import { bookingCreateSchema } from '../../../lib/booking/schemas';
import { createPendingBooking } from '../../../lib/booking/service';
import { checkBookingRateLimit } from '../../../lib/rate-limit/bookingRateLimit';
import { prisma } from '../../../lib/db/client';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const limit = checkBookingRateLimit(ip.toString());

  if (!limit.ok) {
    return new Response(JSON.stringify({ error: 'Too many attempts. Try later.', retryAfter: limit.retryAfterSeconds }), { status: 429 });
  }

  await prisma.rateLimitEvent.create({ data: { ip: ip.toString(), action: 'booking_create' } });

  const parsed = bookingCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request', issues: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const booking = await createPendingBooking(parsed.data);
    return new Response(JSON.stringify({ bookingId: booking.id, status: booking.status }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Booking failed.' }), { status: 400 });
  }
};
