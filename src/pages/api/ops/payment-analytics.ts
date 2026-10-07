import type { APIContext } from 'astro';

import { summarizeBookingPaymentAnalytics } from '@/lib/analytics/starterPaymentMetrics';
import { prisma } from '@/lib/db/client';
import { BLACKLINE_SHOP_ID } from '@/lib/demo/products';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';

export const prerender = false;

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 3650;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

/**
 * Internal booking online-payment volume (operator session + KERSIVO_OPS_EMAILS allowlist).
 * Gross card volume processed on merchants' Stripe accounts — not KERSIVO revenue (0% commission).
 * Aggregates only: no client, booking or shop identifiers leave this endpoint.
 */
export async function GET(context: APIContext): Promise<Response> {
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const rawDays = context.url.searchParams.get('days');
  const days = rawDays === null ? DEFAULT_WINDOW_DAYS : Number(rawDays);
  if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
    return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);
  }
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.booking.findMany({
    where: {
      paidAt: { gte: since },
      paymentAmountPence: { not: null },
      stripeConnectAccountIdAtPayment: { not: null },
      barber: { shopId: { notIn: [DEMO_SHOP_ID, BLACKLINE_SHOP_ID] } },
    },
    select: {
      kersivoProductStateAtBooking: true,
      bookingPaymentType: true,
      paymentAmountPence: true,
      paidAt: true,
    },
  });

  const summary = summarizeBookingPaymentAnalytics(rows);
  return json({
    ok: true,
    data: {
      windowDays: days,
      since: since.toISOString(),
      currency: 'GBP',
      metric: 'gross_online_card_payment_volume',
      globalOnlineCardVolumePence: summary.onlineCardPaymentVolumePence,
      starterOnlineCardVolumePence: summary.starterOnlineCardVolumePence,
      fullOnlineCardVolumePence: summary.fullOnlineCardVolumePence,
      starterMinimumPaymentFloorVolumePence: summary.starterMinimumPaymentFloorVolumePence,
      starterDepositBookingCount: summary.starterDepositBookingCount,
      starterDepositVolumePence: summary.starterDepositVolumePence,
      starterFullPaymentBookingCount: summary.starterFullPaymentBookingCount,
      starterFullPaymentVolumePence: summary.starterFullPaymentVolumePence,
      starterPaidBookingCount: summary.starterPaidBookingCount,
      starterFullPaymentTakeRate: summary.starterFullPaymentTakeRate,
    },
  });
}
