// src/pages/api/availability.ts
import type { APIRoute } from 'astro';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../../lib/db/client';
import { generateSlots } from '../../lib/booking/slots';
import { expirePendingBookings } from '../../lib/booking/service';
import { londonDayOfWeekFromIsoDate, normalizeToIsoDate } from '../../lib/booking/time';

export const GET: APIRoute = async ({ url }) => {
  const barberId = url.searchParams.get('barberId') ?? url.searchParams.get('barber_id');
  const serviceId = url.searchParams.get('serviceId') ?? url.searchParams.get('service_id');
  const rawDate = url.searchParams.get('date');

  if (!barberId || !serviceId || !rawDate) {
    return new Response(JSON.stringify({ error: 'Missing required params.' }), { status: 400 });
  }

  const date = normalizeToIsoDate(rawDate);
  if (!date) {
    return new Response(JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY.' }), { status: 400 });
  }

  const dayOfWeek = londonDayOfWeekFromIsoDate(date);
  if (dayOfWeek == null) {
    return new Response(JSON.stringify({ error: 'Invalid date value.' }), { status: 400 });
  }

  await expirePendingBookings();
  const [settings, service, rules, bookings, timeOff] = await Promise.all([
    prisma.shopSettings.findFirstOrThrow(),
    prisma.service.findUniqueOrThrow({ where: { id: serviceId } }),
    prisma.availabilityRule.findMany({ where: { barberId, active: true, dayOfWeek } }),
    prisma.booking.findMany({ where: { barberId, status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_CONFIRMATION] } }, select: { startAt: true, endAt: true } }),
    prisma.barberTimeOff.findMany({ where: { barberId }, select: { startsAt: true, endsAt: true } })
  ]);

  const slots = generateSlots({ date, service, rules, confirmedBookings: bookings, timeOff, settings });

  console.info('[availability] resolved', {
    rawDate,
    parsedDate: date,
    dayOfWeek,
    rulesFound: rules.length,
    slotsReturned: slots.length
  });

  return new Response(JSON.stringify({ slots }));
};
