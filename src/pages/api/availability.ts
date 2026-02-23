import type { APIRoute } from 'astro';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../../lib/db/client';
import { generateSlots } from '../../lib/booking/slots';
import { expirePendingBookings } from '../../lib/booking/service';

export const GET: APIRoute = async ({ url }) => {
  const barberId = url.searchParams.get('barberId');
  const serviceId = url.searchParams.get('serviceId');
  const date = url.searchParams.get('date');

  if (!barberId || !serviceId || !date) {
    return new Response(JSON.stringify({ error: 'Missing required params.' }), { status: 400 });
  }

  await expirePendingBookings();
  const [settings, service, rules, bookings, timeOff] = await Promise.all([
    prisma.shopSettings.findFirstOrThrow(),
    prisma.service.findUniqueOrThrow({ where: { id: serviceId } }),
    prisma.availabilityRule.findMany({ where: { barberId, active: true } }),
    prisma.booking.findMany({ where: { barberId, status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_CONFIRMATION] } }, select: { startAt: true, endAt: true } }),
    prisma.barberTimeOff.findMany({ where: { barberId }, select: { startsAt: true, endsAt: true } })
  ]);

  const slots = generateSlots({ date, service, rules, confirmedBookings: bookings, timeOff, settings });
  return new Response(JSON.stringify({ slots }));
};
