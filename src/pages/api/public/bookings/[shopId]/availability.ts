export const prerender = false;

import type { APIRoute } from 'astro';
import { ANY_BARBER_ID } from '@/lib/booking/constants';
import { BookingActionError, getAvailabilitySlots } from '@/lib/booking/service';
import { normalizeToIsoDate } from '@/lib/booking/time';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { prisma } from '@/lib/db/client';

const AVAILABILITY_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=60',
};

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers ?? { 'Content-Type': 'application/json' },
  });
}

/**
 * Tenant-scoped public availability for `/book/[shopId]`.
 * Unauthenticated `/api/availability` resolves to the demo shop — do not use it for live tenants.
 */
export const GET: APIRoute = async ({ request, params }) => {
  const shopId = params.shopId?.trim();
  if (!shopId) return json({ error: 'Missing shop id.' }, 400);
  if (shopId === DEMO_SHOP_ID) {
    return json({ error: 'Demo shop does not expose live availability.' }, 403);
  }

  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: { id: true },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);

  const searchParams = new URL(request.url).searchParams;
  const serviceId =
    searchParams.get('serviceId') ?? searchParams.get('service_id') ?? searchParams.get('service');
  const barberId =
    searchParams.get('barberId') ?? searchParams.get('barber_id') ?? searchParams.get('barber');
  const rawDate = searchParams.get('date');

  if (!barberId || !serviceId || !rawDate) {
    return json(
      { error: 'Missing required params. Expected serviceId, barberId, and date.' },
      400,
    );
  }

  const date = normalizeToIsoDate(rawDate);
  if (!date) {
    return json({ error: 'Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY.' }, 400);
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, shopId },
    select: { id: true },
  });
  if (!service) {
    return json({ error: 'Service not found.' }, 404);
  }

  if (barberId !== ANY_BARBER_ID) {
    const barber = await prisma.barber.findFirst({
      where: { id: barberId, shopId, active: true },
      select: { id: true },
    });
    if (!barber) {
      return json({ error: 'Barber not found.' }, 404);
    }

    const barberService = await prisma.barberService.findUnique({
      where: { barberId_serviceId: { barberId, serviceId } },
      select: { serviceId: true },
    });
    if (!barberService) {
      return json({ error: 'Barber not found.' }, 404);
    }
  }

  try {
    const { slots, paused, pauseReason } = await getAvailabilitySlots({
      serviceId,
      barberId,
      date,
    });

    return json(
      {
        slots,
        paused: Boolean(paused),
        pauseReason: paused ? pauseReason ?? null : null,
      },
      200,
      AVAILABILITY_CACHE_HEADERS,
    );
  } catch (error) {
    if (error instanceof BookingActionError) {
      return json({ error: error.message }, error.statusCode);
    }
    return json(
      { error: error instanceof Error ? error.message : 'Unable to load availability.' },
      400,
    );
  }
};
