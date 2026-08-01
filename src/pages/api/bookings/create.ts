export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '../../../lib/admin/auth';
import { bookingCreateSchema } from '../../../lib/booking/schemas';
import { OWNER_TEST_BOOKING_NOTES_PREFIX } from '../../../lib/booking/sandboxBookings';
import { BookingActionError, createInstantBooking } from '../../../lib/booking/service';
import { checkBookingRateLimit } from '../../../lib/rate-limit/bookingRateLimit';

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

export const POST: APIRoute = async (ctx) => {
  const { request } = ctx;
  const ip = getRequestIp(request);
  const access = await resolveAdminAccess(ctx);
  const isOwnerSession = access?.via === 'session';

  if (!isOwnerSession) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Rate-limit in production for owners (DEV owner sessions skip).
  if (!import.meta.env.DEV) {
    const limit = await checkBookingRateLimit(ip);

    if (!limit.ok) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (limit.retryAfterSeconds) headers['Retry-After'] = String(limit.retryAfterSeconds);
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Try later.', retryAfter: limit.retryAfterSeconds }),
        { status: 429, headers },
      );
    }
  }

  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return new Response(
      JSON.stringify({ error: 'Request body is required and must be valid JSON.' }),
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 });
  }

  const parsed = bookingCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request', issues: parsed.error.flatten() }),
      { status: 400 },
    );
  }

  const headerIdempotencyKey = request.headers.get('Idempotency-Key')?.trim() || '';
  const idempotencyKey = parsed.data.idempotencyKey?.trim() || headerIdempotencyKey || undefined;

  const requiredShopId = access!.shopId;
  const notesPrefix = OWNER_TEST_BOOKING_NOTES_PREFIX;

  try {
    const booking = await createInstantBooking(
      { ...parsed.data, idempotencyKey },
      {
        requiredShopId,
        notesPrefix,
        skipConfirmationEmail: false,
      },
    );
    return new Response(
      JSON.stringify({
        booking: {
          id: booking.id,
          status: booking.status,
          serviceName: booking.serviceNameAtBooking ?? booking.service.name,
          barberName: booking.barber.name,
          startAt: booking.startAt,
          sandbox: true,
        },
      }),
    );
  } catch (error) {
    if (error instanceof BookingActionError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.statusCode });
    }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Booking failed.' }),
      { status: 400 },
    );
  }
};
