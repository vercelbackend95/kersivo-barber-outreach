export const prerender = false;

import { Prisma, SetupPlan, SetupDepositStatus } from '@prisma/client';
import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/db/client';
import { formatGbp } from '../../../lib/shop/money';
import { createShopOrder } from '../../../lib/shop/createShopOrder';
import {
  getCheckoutPaymentIntentId,
  retrieveCheckoutSession,
  type StripeSession,
  verifyStripeWebhookSignature,
} from '../../../lib/shop/stripe';
import {
  EmailDeliveryError,
  getSetupOnboardingFormUrlOrEmpty,
  sendSetupDepositConfirmationEmail,
  sendSetupDepositInternalNotificationEmail,
} from '../../../lib/email/sender';
import { getSetupPlan, isSetupPlanId } from '../../../lib/setup/plans';
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
