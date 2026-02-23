import type { APIRoute } from 'astro';
import { bookingCreateSchema } from '../../../lib/booking/schemas';
import { createPendingBooking } from '../../../lib/booking/service';
import { checkBookingRateLimit } from '../../../lib/rate-limit/bookingRateLimit';
import { prisma } from '../../../lib/db/client';

const getRequestIp = (request: Request): string => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'local';
};

export const POST: APIRoute = async ({ request }) => {
  const ip = getRequestIp(request);
  const limit = checkBookingRateLimit(ip);

  if (!limit.ok) {
    return new Response(JSON.stringify({ error: 'Too many attempts. Try later.', retryAfter: limit.retryAfterSeconds }), { status: 429 });
  }

  await prisma.rateLimitEvent.create({ data: { ip, action: 'booking_create' } });

  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return new Response(JSON.stringify({ error: 'Request body is required and must be valid JSON.' }), { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 });
  }

  const parsed = bookingCreateSchema.safeParse(payload);

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
