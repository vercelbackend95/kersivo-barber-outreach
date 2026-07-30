// src/pages/api/availability.ts
// Session/admin + demo-reschedule slot lookup. Live tenant public booking uses
// /api/public/bookings/[shopId]/availability (no admin session, no DEMO fallback).
import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '../../lib/admin/auth';
import { BookingActionError } from '../../lib/booking/service';
import { normalizeToIsoDate } from '../../lib/booking/time';
import { getAvailabilitySlots } from '../../lib/booking/service';
import { DEMO_SHOP_ID } from '../../lib/db/shopScope';
import { prisma } from '../../lib/db/client';

export const prerender = false;

const AVAILABILITY_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  // Session-scoped responses must not be shared via CDN/shared caches.
  'Cache-Control': 'private, max-age=30',
};

export const GET: APIRoute = async (ctx) => {
  const { request } = ctx;
  const searchParams = new URL(request.url).searchParams;
  const query = Object.fromEntries(searchParams.entries());
  const serviceId =
    searchParams.get('serviceId') ?? searchParams.get('service_id') ?? searchParams.get('service');
  const barberId =
    searchParams.get('barberId') ?? searchParams.get('barber_id') ?? searchParams.get('barber');
  const rawDate = searchParams.get('date');

  if (!barberId || !serviceId || !rawDate) {
    return new Response(
      JSON.stringify({
        error: 'Missing required params. Expected serviceId, barberId, and date.',
      }),
      { status: 400 },
    );
  }

  const date = normalizeToIsoDate(rawDate);
  if (!date) {
    return new Response(
      JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY.' }),
      { status: 400 },
    );
  }

  const access = await resolveAdminAccess(ctx);
  const allowedShopId = access?.via === 'session' ? access.shopId : DEMO_SHOP_ID;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, shopId: allowedShopId },
    select: { id: true },
  });
  if (!service) {
    return new Response(JSON.stringify({ error: 'Service not found.' }), { status: 404 });
  }

  if (import.meta.env.DEV) {
    console.info('[availability][dev] incoming params', { query, serviceId, barberId, rawDate, allowedShopId });
  }

  try {
    const { slots, paused, pauseReason } = await getAvailabilitySlots({
      serviceId,
      barberId,
      date,
    });

    return new Response(
      JSON.stringify({
        slots,
        paused: Boolean(paused),
        pauseReason: paused ? pauseReason ?? null : null,
      }),
      {
        status: 200,
        headers: AVAILABILITY_CACHE_HEADERS,
      },
    );
  } catch (error) {
    if (error instanceof BookingActionError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.statusCode });
    }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to load availability.' }),
      { status: 400 },
    );
  }
};
