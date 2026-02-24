// src/pages/api/availability.ts
import type { APIRoute } from 'astro';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../../lib/db/client';
import { getTimeBlockDelegate } from '../../lib/db/timeBlocks';
import { generateSlots } from '../../lib/booking/slots';
import { expirePendingBookings } from '../../lib/booking/service';
import { addMinutes, londonDayOfWeekFromIsoDate, normalizeToIsoDate, toUtcFromLondon } from '../../lib/booking/time';

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

  const dayOfWeek = londonDayOfWeekFromIsoDate(date);
  if (dayOfWeek == null) {
    return new Response(JSON.stringify({ error: 'Invalid date value.' }), { status: 400 });
  }

  if (import.meta.env.DEV) {
    console.info('[availability][dev] incoming params', {
      query,
      serviceId,
      barberId,
      rawDate
    });
  }
  const dayStartUtc = toUtcFromLondon(date, 0);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);


  await expirePendingBookings();
  const settings = await prisma.shopSettings.findFirstOrThrow();
    const timeBlockDelegate = getTimeBlockDelegate();



  const [service, rules, bookings, timeOff, timeBlocks] = await Promise.all([

    prisma.service.findUniqueOrThrow({ where: { id: serviceId } }),
    prisma.availabilityRule.findMany({ where: { barberId, active: true, dayOfWeek } }),
    prisma.booking.findMany({ where: { barberId, status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_CONFIRMATION] } }, select: { startAt: true, endAt: true } }),
    prisma.barberTimeOff.findMany({ where: { barberId }, select: { startsAt: true, endsAt: true } }),
    timeBlockDelegate
      ? timeBlockDelegate.findMany({
          where: {
            shopId: settings.id,
            OR: [{ barberId }, { barberId: null }],
            startAt: { lt: dayEndUtc },
            endAt: { gt: dayStartUtc }
          },
          select: { startAt: true, endAt: true }
        })
      : Promise.resolve([])


  ]);

  const slots = generateSlots({ date, service, rules, confirmedBookings: bookings, timeOff, timeBlocks, settings });

  if (import.meta.env.DEV) {
    console.info('[availability][dev] resolved', {
      normalizedDate: date,
      dayOfWeek,
      rulesFound: rules.length,
      slotsReturned: slots.length
    });
  }

  return new Response(JSON.stringify({ slots }));
};
