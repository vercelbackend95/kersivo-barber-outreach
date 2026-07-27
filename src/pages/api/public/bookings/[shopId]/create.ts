export const prerender = false;

import type { APIRoute } from 'astro';
import { bookingCreateSchema } from '@/lib/booking/schemas';
import { BookingActionError, createInstantBooking } from '@/lib/booking/service';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { prisma } from '@/lib/db/client';
import { checkBookingRateLimit } from '@/lib/rate-limit/bookingRateLimit';
import { createBookingDepositCheckoutSession } from '@/lib/shop/stripeConnect';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

const getRequestIp = (request: Request): string => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  return request.headers.get('x-real-ip')?.trim() || 'local';
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, params }) => {
  const shopId = params.shopId?.trim();
  if (!shopId) return json({ error: 'Missing shop id.' }, 400);
  if (shopId === DEMO_SHOP_ID) {
    return json({ error: 'Demo shop does not accept live online bookings.' }, 403);
  }

  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      name: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      depositsEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
      publicActivityPaused: true,
    },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);

  const ip = getRequestIp(request);
  if (!import.meta.env.DEV) {
    const limit = checkBookingRateLimit(ip);
    if (!limit.ok) {
      return json({ error: 'Too many attempts. Try later.', retryAfter: limit.retryAfterSeconds }, 429);
    }
    await prisma.rateLimitEvent.create({ data: { ip, action: 'public_booking_create' } });
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const parsed = bookingCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'Invalid request', issues: parsed.error.flatten() }, 400);
  }

  try {
    const created = await createInstantBooking(parsed.data, {
      requiredShopId: shopId,
      allowDepositCollection: true,
    });

    if (created.depositRequired) {
      if (!shop.stripeConnectAccountId) {
        return json({ error: 'Deposit checkout is not configured for this shop.' }, 503);
      }
      const baseUrl = getPublicSiteUrl();
      const session = await createBookingDepositCheckoutSession({
        shopConnectAccountId: shop.stripeConnectAccountId,
        bookingId: created.id,
        shopId,
        customerEmail: created.email,
        shopName: created.shopName || shop.name,
        successUrl: `${baseUrl}/book/${shopId}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/book/${shopId}?deposit=cancelled`,
      });

      await prisma.booking.update({
        where: { id: created.id },
        data: { stripeCheckoutSessionId: session.id },
      });

      return json({
        booking: {
          id: created.id,
          status: created.status,
          depositRequired: true,
          checkoutUrl: session.url,
        },
      });
    }

    return json({
      booking: {
        id: created.id,
        status: created.status,
        serviceName: created.serviceNameAtBooking ?? created.service.name,
        barberName: created.barber.name,
        startAt: created.startAt,
        depositRequired: false,
      },
    });
  } catch (error) {
    if (error instanceof BookingActionError) {
      return json({ error: error.message }, error.statusCode);
    }
    return json({ error: error instanceof Error ? error.message : 'Booking failed.' }, 400);
  }
};
