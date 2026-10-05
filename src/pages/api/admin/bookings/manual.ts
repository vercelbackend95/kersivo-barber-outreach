export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { requireLinkedBarber } from '@/lib/admin/rbac/scope';
import { requireAdminProductCapability } from '@/lib/admin/productCapability';
import { manualBookingCreateSchema } from '@/lib/booking/schemas';
import { BookingActionError, createInstantBooking } from '@/lib/booking/service';
import { isDemoShopId } from '@/lib/shop/cardPaymentsGate';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Staff-side manual booking.
 * Delegates all creation to createInstantBooking so slot/service/barber/concurrency rules stay
 * identical to the canonical booking engine. V1 is Pay at shop only: no Stripe payment is created.
 */
export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['bookings.manage', 'bookings.self']);
  if (denied) return denied;
  const linked = requireLinkedBarber(access);
  if (linked) return linked;
  if (isDemoShopId(access.shopId)) return json({ error: 'Demo shop is read-only.' }, 403);

  const product = await requireAdminProductCapability(access, 'MANUAL_BOOKINGS');
  if (product instanceof Response) return product;

  const body = await ctx.request.json().catch(() => null);
  const parsed = manualBookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Invalid request', issues: parsed.error.flatten() }, 400);
  }

  if (access.role === 'BARBER' && access.barberId !== parsed.data.barberId) {
    return json({ error: 'You can only create bookings in your own calendar.' }, 403);
  }

  const headerIdempotencyKey = ctx.request.headers.get('Idempotency-Key')?.trim() || '';
  const idempotencyKey =
    parsed.data.idempotencyKey?.trim() || headerIdempotencyKey || undefined;

  try {
    const created = await createInstantBooking(
      {
        serviceId: parsed.data.serviceId,
        barberId: parsed.data.barberId,
        date: parsed.data.date,
        time: parsed.data.time,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        idempotencyKey,
      },
      {
        requiredShopId: access.shopId,
        allowDepositCollection: false,
        ignorePublicActivityPause: true,
        notes: parsed.data.note,
      },
    );

    return json({
      booking: {
        id: created.id,
        status: created.status,
        serviceName: created.serviceNameAtBooking ?? created.service.name,
        barberName: created.barber.name,
        startAt: created.startAt,
        paymentType: 'NONE',
        depositRequired: false,
        replayed: created.replayed,
      },
    }, created.replayed ? 200 : 201);
  } catch (error) {
    if (error instanceof BookingActionError) {
      return json(
        error.code ? { error: error.message, code: error.code } : { error: error.message },
        error.statusCode,
      );
    }
    return json({ error: error instanceof Error ? error.message : 'Booking failed.' }, 400);
  }
};
