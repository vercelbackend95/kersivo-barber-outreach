export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { requireLinkedBarber } from '@/lib/admin/rbac/scope';
import { requireAdminProductCapability } from '@/lib/admin/productCapability';
import { BookingActionError, getAvailabilitySlots } from '@/lib/booking/service';
import { normalizeToIsoDate } from '@/lib/booking/time';
import { prisma } from '@/lib/db/client';
import { isDemoShopId } from '@/lib/shop/cardPaymentsGate';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['bookings.manage', 'bookings.self']);
  if (denied) return denied;
  const linked = requireLinkedBarber(access);
  if (linked) return linked;
  if (isDemoShopId(access.shopId)) return json({ error: 'Demo shop is read-only.' }, 403);

  const product = await requireAdminProductCapability(access, 'MANUAL_BOOKINGS');
  if (product instanceof Response) return product;

  const serviceId = ctx.url.searchParams.get('serviceId')?.trim() ?? '';
  const barberId = ctx.url.searchParams.get('barberId')?.trim() ?? '';
  const rawDate = ctx.url.searchParams.get('date')?.trim() ?? '';
  const date = normalizeToIsoDate(rawDate);

  if (!serviceId || !barberId || !date) {
    return json({ error: 'serviceId, barberId and date are required.' }, 400);
  }

  if (access.role === 'BARBER' && access.barberId !== barberId) {
    return json({ error: 'You can only create bookings in your own calendar.' }, 403);
  }

  const [service, barber, barberService] = await Promise.all([
    prisma.service.findFirst({
      where: { id: serviceId, shopId: access.shopId, isActive: true },
      select: { id: true },
    }),
    prisma.barber.findFirst({
      where: { id: barberId, shopId: access.shopId, active: true },
      select: { id: true },
    }),
    prisma.barberService.findUnique({
      where: { barberId_serviceId: { barberId, serviceId } },
      select: { serviceId: true },
    }),
  ]);

  if (!service) return json({ error: 'Service not found.' }, 404);
  if (!barber || !barberService) return json({ error: 'Barber is not available for this service.' }, 404);

  try {
    const result = await getAvailabilitySlots({
      serviceId,
      barberId,
      date,
      ignorePublicActivityPause: true,
    });
    return json({ slots: result.slots });
  } catch (error) {
    if (error instanceof BookingActionError) return json({ error: error.message }, error.statusCode);
    return json({ error: error instanceof Error ? error.message : 'Unable to load availability.' }, 400);
  }
};
