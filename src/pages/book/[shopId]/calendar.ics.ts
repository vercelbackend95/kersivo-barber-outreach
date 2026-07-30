export const prerender = false;

import type { APIRoute } from 'astro';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { BOOKING_DEPOSIT_METADATA_TYPE } from '@/lib/booking/depositGate';
import { buildBookingIcs } from '@/lib/booking/calendarIcs';
import { prisma } from '@/lib/db/client';
import { retrieveCheckoutSession } from '@/lib/shop/stripe';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const GET: APIRoute = async (ctx) => {
  const shopId = ctx.params.shopId?.trim() ?? '';
  const sessionId = ctx.url.searchParams.get('session_id')?.trim() ?? '';

  if (!shopId || !sessionId) {
    return new Response('Missing shop or session.', { status: 400 });
  }

  try {
    const shop = await prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: { name: true, stripeConnectAccountId: true },
    });
    const connectAccountId = shop?.stripeConnectAccountId?.trim();
    if (!connectAccountId) {
      return new Response('Shop Connect account missing.', { status: 404 });
    }

    const session = await retrieveCheckoutSession(sessionId, { stripeAccount: connectAccountId });
    const metadata = session.metadata ?? {};
    if (
      metadata.type !== BOOKING_DEPOSIT_METADATA_TYPE ||
      metadata.shopId !== shopId ||
      !metadata.bookingId ||
      (session.payment_status ?? '').toLowerCase() !== 'paid'
    ) {
      return new Response('Invalid or unpaid session.', { status: 404 });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: metadata.bookingId,
        barber: { shopId },
        status: BookingStatus.BOOKED,
        paymentStatus: PaymentStatus.PAID,
      },
      include: {
        barber: true,
        service: true,
      },
    });

    if (!booking) {
      return new Response('Booking not found.', { status: 404 });
    }

    const serviceName = booking.serviceNameAtBooking ?? booking.service.name;
    const shopName = shop?.name?.trim() || 'Barbershop';
    const baseUrl = getPublicSiteUrl();
    const descriptionParts = [
      `${serviceName} with ${booking.barber.name} at ${shopName}.`,
      `Manage: ${baseUrl}/book/reschedule (use the link from your confirmation email to reschedule or cancel).`,
    ];

    const ics = buildBookingIcs({
      uid: `kersivo-booking-${booking.id}@kersivo.co.uk`,
      summary: `${serviceName} — ${shopName}`,
      description: descriptionParts.join('\n'),
      location: shopName,
      startAt: booking.startAt,
      endAt: booking.endAt,
    });

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="kersivo-booking.ics"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[calendar.ics] failed', error);
    return new Response('Could not build calendar event.', { status: 500 });
  }
};
