export const prerender = false;

import type { APIRoute } from 'astro';
import { BookingStatus } from '@prisma/client';
import { bookingCreateSchema } from '@/lib/booking/schemas';
import { BookingActionError, createInstantBooking } from '@/lib/booking/service';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { prisma } from '@/lib/db/client';
import { checkBookingRateLimit } from '@/lib/rate-limit/bookingRateLimit';
import {
  createBookingPaymentCheckoutSession,
  retrieveBookingDepositSession,
} from '@/lib/shop/stripeConnect';
import { BOOKING_PAYMENT_NOT_READY } from '@/lib/booking/bookingPaymentPolicy';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { shopAcceptsPublicBookings } from '@/lib/setup/shopPublicBookingGate';

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

/**
 * Checkout params from the Booking snapshot. Rows created before the snapshot columns were
 * populated fall back to the legacy deposit amount with a 0% KERSIVO fee.
 */
function resolveStoredCheckoutSnapshot(booking: {
  bookingPaymentType?: string | null;
  paymentAmountPence?: number | null;
  kersivoPlatformFeePence?: number | null;
  depositAmountPence?: number | null;
}): { bookingPaymentType: 'DEPOSIT' | 'FULL'; paymentAmountPence: number; applicationFeePence: number } | null {
  const type = booking.bookingPaymentType ?? 'DEPOSIT';
  if (type !== 'DEPOSIT' && type !== 'FULL') return null;
  const amount = booking.paymentAmountPence ?? booking.depositAmountPence;
  if (typeof amount !== 'number' || amount <= 0) return null;
  const fee = booking.kersivoPlatformFeePence ?? 0;
  if (fee < 0 || fee >= amount) return null;
  return { bookingPaymentType: type, paymentAmountPence: amount, applicationFeePence: fee };
}

async function resolveOpenDepositCheckoutUrl(input: {
  bookingId: string;
  shopId: string;
  connectAccountId: string;
  existingSessionId: string | null | undefined;
}): Promise<string | null> {
  const sessionId = input.existingSessionId?.trim();
  if (!sessionId) return null;
  try {
    const session = await retrieveBookingDepositSession(sessionId, input.connectAccountId);
    if ((session.status ?? '').toLowerCase() === 'open' && session.url) {
      return session.url;
    }
  } catch (error) {
    console.warn('[public booking] existing deposit session unusable', {
      bookingId: input.bookingId,
      shopId: input.shopId,
      sessionId,
      error: error instanceof Error ? error.message : error,
    });
  }
  return null;
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

  if (!(await shopAcceptsPublicBookings(shopId))) {
    return json({ error: 'Online booking is not available for this shop.' }, 403);
  }

  const ip = getRequestIp(request);
  if (!import.meta.env.DEV) {
    const limit = await checkBookingRateLimit(ip, 'public_booking_create');
    if (!limit.ok) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (limit.retryAfterSeconds) headers['Retry-After'] = String(limit.retryAfterSeconds);
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Try later.', retryAfter: limit.retryAfterSeconds }),
        { status: 429, headers },
      );
    }
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

  const headerIdempotencyKey = request.headers.get('Idempotency-Key')?.trim() || '';
  const idempotencyKey = parsed.data.idempotencyKey?.trim() || headerIdempotencyKey || undefined;

  try {
    const created = await createInstantBooking(
      { ...parsed.data, idempotencyKey },
      {
        requiredShopId: shopId,
        allowDepositCollection: true,
      },
    );

    if (created.depositRequired) {
      if (!shop.stripeConnectAccountId) {
        return json(
          { error: 'Booking payment checkout is not configured for this shop.', code: BOOKING_PAYMENT_NOT_READY },
          503,
        );
      }
      // The stored Booking snapshot is authoritative — never recompute from the shop's current plan.
      const checkoutSnapshot = resolveStoredCheckoutSnapshot(created);
      if (!checkoutSnapshot) {
        return json({ error: 'Invalid payment amount for this booking.' }, 500);
      }

      if (created.status === BookingStatus.PENDING_PAYMENT) {
        const reusedUrl = await resolveOpenDepositCheckoutUrl({
          bookingId: created.id,
          shopId,
          connectAccountId: shop.stripeConnectAccountId,
          existingSessionId: created.stripeCheckoutSessionId,
        });
        if (reusedUrl) {
          return json({
            booking: {
              id: created.id,
              status: created.status,
              depositRequired: true,
              checkoutUrl: reusedUrl,
              replayed: created.replayed,
            },
          });
        }
      }

      // Never open a new payable session after the local hold has already expired.
      const holdExpiresAt =
        created.paymentExpiresAt instanceof Date ? created.paymentExpiresAt : null;
      if (holdExpiresAt && holdExpiresAt.getTime() <= Date.now()) {
        return json(
          {
            error:
              'This booking deposit hold has expired. Please choose a new time and try again.',
          },
          409,
        );
      }

      const baseUrl = getPublicSiteUrl();
      const session = await createBookingPaymentCheckoutSession({
        shopConnectAccountId: shop.stripeConnectAccountId,
        bookingId: created.id,
        shopId,
        customerEmail: created.email,
        shopName: created.shopName || shop.name,
        bookingPaymentType: checkoutSnapshot.bookingPaymentType,
        paymentAmountPence: checkoutSnapshot.paymentAmountPence,
        applicationFeePence: checkoutSnapshot.applicationFeePence,
        bookingCreatedAt:
          created.createdAt instanceof Date ? created.createdAt : new Date(),
        holdExpiresAt,
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
          replayed: created.replayed,
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
        replayed: created.replayed,
      },
    });
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
