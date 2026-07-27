export const prerender = false;

import PrismaClientPkg from '@prisma/client';
import type { APIRoute } from 'astro';
import { setShopAnalyticsLive, setShopAnalyticsLiveForOwnerEmail } from '../../../lib/admin/analyticsMode';
import { prisma } from '../../../lib/db/client';
import { markShopPaid, markShopPaidForOwnerEmail } from '../../../lib/shop/markShopPaid';
import {
  enableShopSmsReminders,
  enableShopSmsRemindersForOwnerEmail,
} from '../../../lib/sms/shopSmsGate';
import { formatGbp } from '../../../lib/shop/money';
import { createShopOrder } from '../../../lib/shop/createShopOrder';
import {
  getCheckoutPaymentIntentId,
  getCheckoutSubscriptionId,
  retrieveCheckoutSession,
  type StripeSession,
  verifyStripeWebhookSignature,
} from '../../../lib/shop/stripe';
import {
  EmailDeliveryError,
  getSetupOnboardingFormUrlOrEmpty,
  sendInstantBookingConfirmationEmail,
  sendSaasSubscriptionConfirmationEmail,
  sendSaasSubscriptionInternalNotificationEmail,
  sendSetupDepositConfirmationEmail,
  sendSetupDepositInternalNotificationEmail,
} from '../../../lib/email/sender';
import { getSetupPlan, isSetupPlanId } from '../../../lib/setup/plans';
import { SAAS_SUBSCRIPTION_METADATA_TYPE } from '../../../lib/setup/saasSubscription';
import { SAAS_MONTHLY_PENCE } from '../../../lib/seo/defaults';
import { BOOKING_DEPOSIT_METADATA_TYPE } from '../../../lib/booking/depositGate';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { getPublicSiteUrl } from '../../../lib/setup/siteUrl';
import { generateToken, hashToken } from '../../../lib/booking/tokens';
import { DEMO_SHOP_ID } from '../../../lib/db/shopScope';

const { Prisma, SetupPlan, SetupDepositStatus } = PrismaClientPkg;
type CartSnapshotItem = {
  productId: string;
  name: string;
  unitPricePence: number;
  quantity: number;
  lineTotalPence: number;
};

type StripeEvent = {
  type: string;
  created: number;
  data: {
    object: {
      id: string;
      metadata?: Record<string, string>;
      customer_email?: string | null;
      amount_total?: number | null;
      currency?: string | null;
      payment_status?: string | null;
    };
  };
};

const ATTRIBUTION_META_KEYS = [
  'gclid',
  'gbraid',
  'wbraid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'ga_client_id',
] as const;

const SETUP_FULFILMENT_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

function attributionSummary(metadata: Record<string, string>): string {
  const parts: string[] = [];
  for (const key of ATTRIBUTION_META_KEYS) {
    const value = metadata[key]?.trim();
    if (value) parts.push(`${key}=${value}`);
  }
  return parts.join('; ');
}

function logSetupDepositStage(
  stage: string,
  details: Record<string, string | number | boolean | null | undefined> = {},
): void {
  console.info('[webhook] setup_deposit', { stage, ...details });
}

async function handleSetupDepositCheckout(
  sessionId: string,
  session: StripeSession,
  metadata: Record<string, string>,
  eventCreated: number,
): Promise<Response> {
  if ((session.payment_status ?? '').toLowerCase() !== 'paid') {
    console.error('[webhook] Setup deposit session not paid', {
      sessionId,
      paymentStatus: session.payment_status,
    });
    return new Response(JSON.stringify({ error: 'Setup deposit not paid' }), { status: 400 });
  }

  if ((metadata.type ?? '').trim() !== 'setup_deposit') {
    return new Response(JSON.stringify({ error: 'Invalid setup deposit type' }), { status: 400 });
  }

  const planRaw = (metadata.plan ?? '').trim();
  if (!isSetupPlanId(planRaw)) {
    console.error('[webhook] Setup deposit missing or invalid plan metadata', {
      sessionId,
      plan: metadata.plan,
    });
    return new Response(JSON.stringify({ error: 'Missing setup deposit metadata' }), { status: 400 });
  }

  const customerName = (metadata.customerName ?? '').trim();
  const customerEmail = (metadata.email ?? session.customer_email ?? '').trim().toLowerCase();
  const shopName = (metadata.shopName ?? '').trim();
  const shopSize = (metadata.shopSize ?? '').trim();
  const currentStack = (metadata.currentStack ?? '').trim();

  if (!customerName || !customerEmail || !shopName || !shopSize || !currentStack) {
    console.error('[webhook] Setup deposit missing required metadata', {
      sessionId,
      customerName: Boolean(customerName),
      customerEmail: Boolean(customerEmail),
      shopName: Boolean(shopName),
      shopSize: Boolean(shopSize),
      currentStack: Boolean(currentStack),
    });
    return new Response(JSON.stringify({ error: 'Missing setup deposit metadata' }), { status: 400 });
  }

  const depositPence = session.amount_total;
  if (typeof depositPence !== 'number') {
    console.error('[webhook] Setup deposit missing amount_total', { sessionId });
    return new Response(JSON.stringify({ error: 'Missing setup deposit amount' }), { status: 400 });
  }

  const planId = planRaw;
  const planConfig = getSetupPlan(planId);
  const paidAt = Number.isFinite(eventCreated) ? new Date(eventCreated * 1000) : new Date();
  const paymentIntentId = getCheckoutPaymentIntentId(session);
  const currency = (session.currency ?? 'gbp').toLowerCase();
  const hasPaymentIntent = Boolean(paymentIntentId);

  logSetupDepositStage('deposit_validated', {
    sessionId,
    plan: planId,
    depositPence,
    hasPaymentIntent,
  });

  logSetupDepositStage('database_lookup_started', { sessionId });
  let deposit = await prisma.setupDeposit.findUnique({
    where: { stripeSessionId: sessionId },
  });
  logSetupDepositStage('database_lookup_completed', {
    sessionId,
    found: Boolean(deposit),
  });

  if (!deposit) {
    try {
      deposit = await prisma.setupDeposit.create({
        data: {
          stripeSessionId: sessionId,
          paymentIntentId,
          plan: planId === 'priority' ? SetupPlan.PRIORITY : SetupPlan.LAUNCH,
          status: SetupDepositStatus.PAID,
          customerName,
          customerEmail,
          shopName,
          shopSize,
          currentStack,
          depositPence,
          currency,
          paidAt,
        },
      });
      logSetupDepositStage('deposit_record_created', {
        sessionId,
        depositId: deposit.id,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        deposit = await prisma.setupDeposit.findUnique({
          where: { stripeSessionId: sessionId },
        });
        logSetupDepositStage('database_lookup_completed', {
          sessionId,
          found: Boolean(deposit),
          afterUniqueConflict: true,
        });
      } else {
        throw error;
      }
    }
  }

  if (!deposit) {
    console.error('[webhook] Setup deposit row missing after create', { sessionId });
    return new Response(JSON.stringify({ error: 'Setup deposit persist failed' }), { status: 500 });
  }

  if (deposit.status !== SetupDepositStatus.PAID || !deposit.paidAt || (paymentIntentId && !deposit.paymentIntentId)) {
    deposit = await prisma.setupDeposit.update({
      where: { id: deposit.id },
      data: {
        status: SetupDepositStatus.PAID,
        paidAt: deposit.paidAt ?? paidAt,
        paymentIntentId: paymentIntentId || deposit.paymentIntentId,
        depositPence,
        currency,
        customerName,
        customerEmail,
        shopName,
        shopSize,
        currentStack,
      },
    });
    logSetupDepositStage('deposit_marked_paid', {
      sessionId,
      depositId: deposit.id,
    });
  }

  try {
    const metadataShopId = metadata.shopId?.trim();
    const updated = metadataShopId
      ? await setShopAnalyticsLive(metadataShopId).then(() => true)
      : await setShopAnalyticsLiveForOwnerEmail(customerEmail);
    logSetupDepositStage('analytics_live_mode_updated', {
      sessionId,
      updated,
      viaShopId: Boolean(metadataShopId),
    });
  } catch (error) {
    console.error('[webhook] Failed to mark shop analytics as live', {
      sessionId,
      error,
    });
  }

  const depositFormatted = formatGbp(depositPence);
  const remainingFormatted = formatGbp(planConfig.remainingPence);
  const totalSetupFormatted = formatGbp(planConfig.setupTotalPence);
  const onboardingFormUrl = getSetupOnboardingFormUrlOrEmpty();
  let customerEmailOk = Boolean(deposit.customerEmailSentAt);
  let internalEmailOk = Boolean(deposit.internalEmailSentAt);
  let emailFailure = false;

  if (!customerEmailOk) {
    try {
      logSetupDepositStage('customer_email_started', {
        sessionId,
        hasOnboardingFormUrl: Boolean(onboardingFormUrl),
      });
      await sendSetupDepositConfirmationEmail({
        to: customerEmail,
        customerName,
        shopName,
        planName: planConfig.name,
        depositFormatted,
        remainingFormatted,
        onboardingFormUrl,
      });
      deposit = await prisma.setupDeposit.update({
        where: { id: deposit.id },
        data: { customerEmailSentAt: new Date() },
      });
      customerEmailOk = true;
      logSetupDepositStage('customer_email_sent', { sessionId });
    } catch (error) {
      emailFailure = true;
      console.error('[webhook] Setup deposit confirmation email failed', {
        sessionId,
        error: error instanceof EmailDeliveryError ? error.message : error,
      });
    }
  }

  if (!internalEmailOk) {
    try {
      logSetupDepositStage('internal_email_started', { sessionId });
      await sendSetupDepositInternalNotificationEmail({
        customerName,
        customerEmail,
        shopName,
        shopSize,
        currentStack,
        planName: planConfig.name,
        depositFormatted,
        totalSetupFormatted,
        remainingFormatted,
        currency,
        stripeSessionId: sessionId,
        paymentIntentId,
        paymentStatus: session.payment_status ?? 'paid',
        attributionSummary: attributionSummary(metadata),
        onboardingEmailStatus: customerEmailOk ? 'sent' : 'failed_or_pending',
        paidAtIso: paidAt.toISOString(),
      });
      deposit = await prisma.setupDeposit.update({
        where: { id: deposit.id },
        data: { internalEmailSentAt: new Date() },
      });
      internalEmailOk = true;
      logSetupDepositStage('internal_email_sent', { sessionId });
    } catch (error) {
      emailFailure = true;
      console.error('[webhook] Setup deposit internal notification email failed', {
        sessionId,
        error: error instanceof EmailDeliveryError ? error.message : error,
      });
    }
  }

  if (emailFailure || !customerEmailOk || !internalEmailOk) {
    // Non-2xx so Stripe retries; idempotent flags prevent duplicate sends.
    return new Response(JSON.stringify({ error: 'Setup deposit email fulfilment incomplete' }), {
      status: 500,
    });
  }

  logSetupDepositStage('fulfilment_completed', {
    sessionId,
    depositId: deposit.id,
    customerEmailOk,
    internalEmailOk,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      duplicate: Boolean(deposit.customerEmailSentAt && deposit.internalEmailSentAt),
    }),
    { status: 200 },
  );
}

function logSaasSubscriptionStage(
  stage: string,
  details: Record<string, string | number | boolean | null | undefined> = {},
): void {
  console.info('[webhook] saas_subscription', { stage, ...details });
}

async function handleSaasSubscriptionCheckout(
  sessionId: string,
  session: StripeSession,
  metadata: Record<string, string>,
  eventCreated: number,
): Promise<Response> {
  if ((session.payment_status ?? '').toLowerCase() !== 'paid') {
    console.error('[webhook] SaaS subscription session not paid', {
      sessionId,
      paymentStatus: session.payment_status,
    });
    return new Response(JSON.stringify({ error: 'Subscription not paid' }), { status: 400 });
  }

  if ((metadata.type ?? '').trim() !== SAAS_SUBSCRIPTION_METADATA_TYPE) {
    return new Response(JSON.stringify({ error: 'Invalid subscription type' }), { status: 400 });
  }

  const customerName = (metadata.customerName ?? '').trim();
  const customerEmail = (metadata.email ?? session.customer_email ?? '').trim().toLowerCase();
  const shopName = (metadata.shopName ?? '').trim();
  const shopSize = (metadata.shopSize ?? '').trim();
  const currentStack = (metadata.currentStack ?? '').trim();

  if (!customerName || !customerEmail || !shopName || !shopSize || !currentStack) {
    console.error('[webhook] SaaS subscription missing required metadata', {
      sessionId,
      customerName: Boolean(customerName),
      customerEmail: Boolean(customerEmail),
      shopName: Boolean(shopName),
      shopSize: Boolean(shopSize),
      currentStack: Boolean(currentStack),
    });
    return new Response(JSON.stringify({ error: 'Missing subscription metadata' }), { status: 400 });
  }

  const monthlyPence =
    typeof session.amount_total === 'number' ? session.amount_total : SAAS_MONTHLY_PENCE;
  const activatedAt = Number.isFinite(eventCreated) ? new Date(eventCreated * 1000) : new Date();
  const stripeSubscriptionId = getCheckoutSubscriptionId(session);
  const currency = (session.currency ?? 'gbp').toLowerCase();

  logSaasSubscriptionStage('subscription_validated', {
    sessionId,
    monthlyPence,
    hasSubscriptionId: Boolean(stripeSubscriptionId),
  });

  let record = await prisma.saasSubscription.findUnique({
    where: { stripeSessionId: sessionId },
  });

  if (!record) {
    try {
      record = await prisma.saasSubscription.create({
        data: {
          stripeSessionId: sessionId,
          stripeSubscriptionId,
          status: 'ACTIVE',
          customerName,
          customerEmail,
          shopName,
          shopSize,
          currentStack,
          monthlyPence,
          currency,
          activatedAt,
        },
      });
      logSaasSubscriptionStage('record_created', { sessionId, id: record.id });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        record = await prisma.saasSubscription.findUnique({
          where: { stripeSessionId: sessionId },
        });
      } else {
        throw error;
      }
    }
  }

  if (!record) {
    console.error('[webhook] SaaS subscription row missing after create', { sessionId });
    return new Response(JSON.stringify({ error: 'Subscription persist failed' }), { status: 500 });
  }

  if (
    record.status !== 'ACTIVE' ||
    !record.activatedAt ||
    (stripeSubscriptionId && !record.stripeSubscriptionId)
  ) {
    record = await prisma.saasSubscription.update({
      where: { id: record.id },
      data: {
        status: 'ACTIVE',
        activatedAt: record.activatedAt ?? activatedAt,
        stripeSubscriptionId: stripeSubscriptionId || record.stripeSubscriptionId,
        monthlyPence,
        currency,
        customerName,
        customerEmail,
        shopName,
        shopSize,
        currentStack,
      },
    });
    logSaasSubscriptionStage('marked_active', { sessionId, id: record.id });
  }

  try {
    const metadataShopId = metadata.shopId?.trim();
    const updated = metadataShopId
      ? await setShopAnalyticsLive(metadataShopId).then(() => true)
      : await setShopAnalyticsLiveForOwnerEmail(customerEmail);
    logSaasSubscriptionStage('analytics_live_mode_updated', {
      sessionId,
      updated,
      viaShopId: Boolean(metadataShopId),
    });
  } catch (error) {
    console.error('[webhook] Failed to mark shop analytics as live', {
      sessionId,
      error,
    });
  }

  try {
    const metadataShopId = metadata.shopId?.trim();
    const updated = metadataShopId
      ? await markShopPaid(metadataShopId).then(() => true)
      : await markShopPaidForOwnerEmail(customerEmail);
    logSaasSubscriptionStage('shop_marked_paid', {
      sessionId,
      updated,
      viaShopId: Boolean(metadataShopId),
    });
  } catch (error) {
    console.error('[webhook] Failed to mark shop paid', {
      sessionId,
      error,
    });
  }

  try {
    const metadataShopId = metadata.shopId?.trim();
    const updated = metadataShopId
      ? await enableShopSmsReminders(metadataShopId).then(() => true)
      : await enableShopSmsRemindersForOwnerEmail(customerEmail);
    logSaasSubscriptionStage('sms_reminders_enabled', {
      sessionId,
      updated,
      viaShopId: Boolean(metadataShopId),
    });
  } catch (error) {
    console.error('[webhook] Failed to enable shop SMS reminders', {
      sessionId,
      error,
    });
  }

  const monthlyFormatted = formatGbp(monthlyPence);
  const onboardingFormUrl = getSetupOnboardingFormUrlOrEmpty();
  let customerEmailOk = Boolean(record.customerEmailSentAt);
  let internalEmailOk = Boolean(record.internalEmailSentAt);
  let emailFailure = false;

  if (!customerEmailOk) {
    try {
      await sendSaasSubscriptionConfirmationEmail({
        to: customerEmail,
        customerName,
        shopName,
        monthlyFormatted,
        onboardingFormUrl,
      });
      record = await prisma.saasSubscription.update({
        where: { id: record.id },
        data: { customerEmailSentAt: new Date() },
      });
      customerEmailOk = true;
      logSaasSubscriptionStage('customer_email_sent', { sessionId });
    } catch (error) {
      emailFailure = true;
      console.error('[webhook] SaaS subscription confirmation email failed', {
        sessionId,
        error: error instanceof EmailDeliveryError ? error.message : error,
      });
    }
  }

  if (!internalEmailOk) {
    try {
      await sendSaasSubscriptionInternalNotificationEmail({
        customerName,
        customerEmail,
        shopName,
        shopSize,
        currentStack,
        monthlyFormatted,
        currency,
        stripeSessionId: sessionId,
        stripeSubscriptionId,
        paymentStatus: session.payment_status ?? 'paid',
        attributionSummary: attributionSummary(metadata),
        onboardingEmailStatus: customerEmailOk ? 'sent' : 'failed_or_pending',
        activatedAtIso: activatedAt.toISOString(),
      });
      record = await prisma.saasSubscription.update({
        where: { id: record.id },
        data: { internalEmailSentAt: new Date() },
      });
      internalEmailOk = true;
      logSaasSubscriptionStage('internal_email_sent', { sessionId });
    } catch (error) {
      emailFailure = true;
      console.error('[webhook] SaaS subscription internal notification email failed', {
        sessionId,
        error: error instanceof EmailDeliveryError ? error.message : error,
      });
    }
  }

  if (emailFailure || !customerEmailOk || !internalEmailOk) {
    return new Response(JSON.stringify({ error: 'Subscription email fulfilment incomplete' }), {
      status: 500,
    });
  }

  logSaasSubscriptionStage('fulfilment_completed', {
    sessionId,
    id: record.id,
    customerEmailOk,
    internalEmailOk,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      duplicate: Boolean(record.customerEmailSentAt && record.internalEmailSentAt),
    }),
    { status: 200 },
  );
}

async function handleBookingDepositCheckout(
  sessionId: string,
  session: StripeSession,
  metadata: Record<string, string>,
): Promise<Response> {
  if ((session.payment_status ?? '').toLowerCase() !== 'paid') {
    return new Response(JSON.stringify({ error: 'Deposit not paid' }), { status: 400 });
  }
  const bookingId = metadata.bookingId?.trim();
  const shopId = metadata.shopId?.trim();
  if (!bookingId || !shopId || shopId === DEMO_SHOP_ID) {
    return new Response(JSON.stringify({ error: 'Invalid booking deposit metadata' }), { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, barber: { shopId } },
    include: { barber: true, service: true },
  });
  if (!booking) {
    return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
  }

  if (booking.status === BookingStatus.BOOKED && booking.paymentStatus === PaymentStatus.PAID) {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
  }

  const pi = getCheckoutPaymentIntentId(session);
  const manageToken = generateToken();
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.BOOKED,
      paymentStatus: PaymentStatus.PAID,
      paidAt: new Date(),
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: pi,
      manageTokenHash: hashToken(manageToken),
      paymentExpiresAt: null,
    },
    include: { barber: true, service: true },
  });

  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: { name: true },
  });
  const baseUrl = getPublicSiteUrl();
  try {
    await sendInstantBookingConfirmationEmail({
      to: updated.email,
      fullName: updated.fullName,
      cancelUrl: `${baseUrl}/book/cancel?token=${manageToken}`,
      rescheduleUrl: `${baseUrl}/book/reschedule?token=${manageToken}`,
      shopName: shop?.name ?? 'Barbershop',
      serviceName: updated.serviceNameAtBooking ?? updated.service.name,
      barberName: updated.barber.name,
      startAt: updated.startAt,
    });
  } catch (error) {
    console.warn('[webhook] booking deposit confirmation email failed', {
      bookingId,
      error: error instanceof Error ? error.message : error,
    });
  }

  return new Response(JSON.stringify({ ok: true, bookingId }), { status: 200 });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');
    if (!signature || !verifyStripeWebhookSignature(rawBody, signature)) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
    }
    logSetupDepositStage('signature_verified');

    const event = JSON.parse(rawBody) as StripeEvent;
    const sessionId = event.data.object.id;
    const session = await retrieveCheckoutSession(sessionId);
    const metadata = session.metadata ?? event.data.object.metadata ?? {};

    if (SETUP_FULFILMENT_EVENTS.has(event.type) && metadata.type === 'setup_deposit') {
      // await so try/catch captures async Prisma/email failures (bare return does not)
      return await handleSetupDepositCheckout(sessionId, session, metadata, event.created);
    }

    if (SETUP_FULFILMENT_EVENTS.has(event.type) && metadata.type === SAAS_SUBSCRIPTION_METADATA_TYPE) {
      return await handleSaasSubscriptionCheckout(sessionId, session, metadata, event.created);
    }

    if (SETUP_FULFILMENT_EVENTS.has(event.type) && metadata.type === BOOKING_DEPOSIT_METADATA_TYPE) {
      return await handleBookingDepositCheckout(sessionId, session, metadata);
    }

    if (event.type !== 'checkout.session.completed') {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const existing = await prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
      select: { id: true },
    });
    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
    }

    const customerEmail = (
      session.customer_details?.email ??
      session.customer_email ??
      event.data.object.customer_email ??
      metadata.email ??
      ''
    )
      .trim()
      .toLowerCase();
    const shopId = metadata.shopId;

    if (!shopId || !customerEmail) {
      return new Response(JSON.stringify({ error: 'Missing shop or customer email' }), { status: 400 });
    }

    const cart = JSON.parse(metadata.cart ?? '[]') as CartSnapshotItem[];
    if (!Array.isArray(cart) || cart.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing cart metadata' }), { status: 400 });
    }

    const totalPence =
      typeof session.amount_total === 'number'
        ? session.amount_total
        : cart.reduce((sum, item) => sum + item.lineTotalPence, 0);
    const paidAt = Number.isFinite(event.created) ? new Date(event.created * 1000) : new Date();

    await createShopOrder({
      shopId,
      customerEmail,
      cart,
      totalPence,
      stripeSessionId: sessionId,
      isTestOrder: false,
      sendEmail: true,
      paidAt,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error('Stripe webhook failed', error);
    return new Response(JSON.stringify({ error: 'Webhook handling failed' }), { status: 500 });
  }
};
