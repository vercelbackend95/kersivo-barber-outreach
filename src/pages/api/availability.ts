// src/pages/api/availability.ts
import type { APIRoute } from 'astro';
import { normalizeToIsoDate } from '../../lib/booking/time';
import { getAvailabilitySlots } from '../../lib/booking/service';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const searchParams = new URL(request.url).searchParams;
  const query = Object.fromEntries(searchParams.entries());
  const serviceId = searchParams.get('serviceId') ?? searchParams.get('service_id') ?? searchParams.get('service');
  const barberId = searchParams.get('barberId') ?? searchParams.get('barber_id') ?? searchParams.get('barber');
  const rawDate = searchParams.get('date');


  if (import.meta.env.DEV) {
    console.info('[availability][dev] raw request url', request.url);
    console.info('[availability][dev] search params snapshot', query);
  }

  if (!barberId || !serviceId || !rawDate) {
    return new Response(JSON.stringify({ error: 'Missing required params. Expected serviceId, barberId, and date.' }), { status: 400 });
  }

  const date = normalizeToIsoDate(rawDate);
  if (!date) {
    return new Response(JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY.' }), { status: 400 });
  }


  if (import.meta.env.DEV) {
    console.info('[availability][dev] incoming params', {
      query,
      serviceId,
      barberId,
      rawDate
    });
  }
  try {
    const { slots } = await getAvailabilitySlots({
      serviceId,
      barberId,
      date

    });
      if (import.meta.env.DEV) {
      console.info('[availability][dev] resolved', {
        normalizedDate: date,
        requestedBarberId: barberId,
        slotsReturned: slots.length
      });
    }

    return new Response(JSON.stringify({ slots }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to load availability.' }), { status: 400 });
  }

};
