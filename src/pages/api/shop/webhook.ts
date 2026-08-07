export const prerender = false;

import PrismaClientPkg, { BookingStatus, PaymentStatus } from '@prisma/client';
import type { APIRoute } from 'astro';
import { setShopAnalyticsLive, setShopAnalyticsLiveForOwnerEmail } from '../../../lib/admin/analyticsMode';
import { prisma } from '../../../lib/db/client';
import { markShopPaid, markShopPaidForOwnerEmail } from '../../../lib/shop/markShopPaid';
import {
  enableShopSmsReminders,
  enableShopSmsRemindersForOwnerEmail,
} from '../../../lib/sms/shopSmsGate';
import { formatGbp } from '../../../lib/shop/money';
import {
  getCheckoutCustomerId,
  getCheckoutPaymentIntentId,
  getCheckoutSubscriptionId,
  getSubscriptionCurrentPeriodEnd,
  retrieveCheckoutSession,
  retrieveSubscription,
  type StripeSession,
  type StripeSubscription,
  verifyStripeWebhookSignature,
} from '../../../lib/shop/stripe';
import { SHOP_ORDER_METADATA_TYPE } from '../../../lib/shop/cardPaymentsGate';
import { finalizeRetailOrderFromCheckout } from '../../../lib/shop/finalizeRetailOrder';
import {
  EmailDeliveryError,
  getSetupOnboardingFormUrlOrEmpty,
  sendSaasSubscriptionConfirmationEmail,
  sendSaasSubscriptionInternalNotificationEmail,
  sendSetupDepositConfirmationEmail,
  sendSetupDepositInternalNotificationEmail,
} from '../../../lib/email/sender';
import { getPublicSiteUrl } from '../../../lib/setup/siteUrl';
import { buildSetupSuccessRecoveryUrl } from '../../../lib/setup/saasSetupSuccessRecovery';
import {
  applyInvoicePaid,
  applyInvoicePaymentFailed,
  applyStripeSubscriptionToSaasRecord,
} from '../../../lib/setup/saasSubscriptionLifecycle';
import { periodEndFromUnixSeconds } from '../../../lib/setup/saasEntitlement';
import { getSetupPlan, isSetupPlanId } from '../../../lib/setup/plans';
import { SAAS_SUBSCRIPTION_METADATA_TYPE } from '../../../lib/setup/saasSubscription';
import { SAAS_MONTHLY_PENCE } from '../../../lib/seo/defaults';
import { BOOKING_DEPOSIT_METADATA_TYPE } from '../../../lib/booking/depositGate';
import { confirmPaidDeposit } from '../../../lib/booking/confirmPaidDeposit';
import { confirmDepositRefundFromWebhook } from '../../../lib/booking/depositMoney';
import { DEMO_SHOP_ID } from '../../../lib/db/shopScope';
import { captureOpsException } from '../../../lib/ops/sentry';
import {
  alertLifecycleNotFound,
  alertStripeWebhookFailure,
  markStripeWebhookStatus,
  notifyOpsDurable,
  recordStripeWebhookReceived,
} from '../../../lib/ops/stripeWebhookLedger';
import { opsLog, opsLogError } from '../../../lib/ops/opsLog';

const { Prisma, SetupPlan, SetupDepositStatus } = PrismaClientPkg;

type StripeEvent = {
  id?: string;
  type: string;
  created: number;
  livemode?: boolean;
  /** Set on Connect webhooks listening to connected accounts. */
  account?: string | null;
  data: {
    object: {
      id: string;
      object?: string;
      metadata?: Record<string, string>;
      customer_email?: string | null;
      customer?: string | { id?: string } | null;
      amount_total?: number | null;
      currency?: string | null;
      payment_status?: string | null;
      status?: string;
      cancel_at_period_end?: boolean;
      current_period_end?: number | null;
      items?: { data?: Array<{ current_period_end?: number | null }> } | null;
      canceled_at?: number | null;
      subscription?: string | { id?: string } | null;
      /** Basil and later nest the invoice's subscription here instead of `subscription`. */
      parent?: {
        subscription_details?: { subscription?: string | { id?: string } | null } | null;
      } | null;
      lines?: { data?: Array<{ period?: { end?: number | null } | null }> };
      charges_enabled?: boolean;
      details_submitted?: boolean;
      /** Refund / charge.refunded payload fields. */
      payment_intent?: string | { id?: string } | null;
      amount_refunded?: number | null;
      amount?: number | null;
      refunds?: {
        data?: Array<{ id?: string; status?: string; amount?: number | null }>;
      } | null;
    };
  };
};

async function finalizeWebhookResponse(
  eventId: string | undefined,
  response: Response,
  options: { ignored?: boolean; eventType?: string } = {},
): Promise<Response> {
  if (!eventId) return response;
  try {
    if (response.status >= 500) {
      const bodyText = await response.clone().text().catch(() => '');
      const error = bodyText.slice(0, 500) || 'HTTP 5xx';
      await markStripeWebhookStatus(eventId, 'FAILED', {
        httpStatus: response.status,
        error,
      });
      await alertStripeWebhookFailure({
        eventId,
        type: options.eventType ?? 'unknown',
        error,
        httpStatus: response.status,
      });
    } else if (response.status >= 400) {
      const bodyText = await response.clone().text().catch(() => '');
      await markStripeWebhookStatus(eventId, 'FAILED', {
        httpStatus: response.status,
        error: bodyText.slice(0, 500) || 'HTTP 4xx',
      });
    } else if (options.ignored) {
      await markStripeWebhookStatus(eventId, 'IGNORED', { httpStatus: response.status });
    } else {
      await markStripeWebhookStatus(eventId, 'PROCESSED', { httpStatus: response.status });
    }
  } catch (error) {
    console.error('[webhook] ledger update failed', error);
  }
  return response;
}

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
  const stripeCustomerId = getCheckoutCustomerId(session);
  const metadataShopId = metadata.shopId?.trim() || null;
  const checkoutAttemptId = metadata.checkoutAttemptId?.trim() || null;
  const currency = (session.currency ?? 'gbp').toLowerCase();

  let currentPeriodEnd: Date | null = null;
  let cancelAtPeriodEnd = false;
  if (stripeSubscriptionId) {
    try {
      const stripeSub = await retrieveSubscription(stripeSubscriptionId);
      currentPeriodEnd = periodEndFromUnixSeconds(getSubscriptionCurrentPeriodEnd(stripeSub));
      cancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end);
    } catch (error) {
      console.warn('[webhook] SaaS subscription period lookup failed', {
        sessionId,
        stripeSubscriptionId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  logSaasSubscriptionStage('subscription_validated', {
    sessionId,
    monthlyPence,
    hasSubscriptionId: Boolean(stripeSubscriptionId),
    hasCustomerId: Boolean(stripeCustomerId),
    hasShopId: Boolean(metadataShopId),
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
          stripeCustomerId,
          shopId: metadataShopId,
          checkoutAttemptId,
          status: 'ACTIVE',
          cancelAtPeriodEnd,
          currentPeriodEnd,
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
        record =
          (await prisma.saasSubscription.findUnique({
            where: { stripeSessionId: sessionId },
          })) ??
          (stripeSubscriptionId
            ? await prisma.saasSubscription.findUnique({
                where: { stripeSubscriptionId },
              })
            : null) ??
          (checkoutAttemptId
            ? await prisma.saasSubscription.findUnique({
                where: { checkoutAttemptId },
              })
            : null);
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
    record.checkoutAttemptId &&
    checkoutAttemptId &&
    record.checkoutAttemptId !== checkoutAttemptId
  ) {
    console.warn('[webhook] saas_subscription checkoutAttemptId mismatch; keeping existing', {
      sessionId,
      existing: record.checkoutAttemptId,
      metadata: checkoutAttemptId,
    });
  }

  if (
    record.status !== 'ACTIVE' ||
    !record.activatedAt ||
    (stripeSubscriptionId && !record.stripeSubscriptionId) ||
    (stripeCustomerId && !record.stripeCustomerId) ||
    (metadataShopId && !record.shopId) ||
    (checkoutAttemptId && !record.checkoutAttemptId) ||
    (currentPeriodEnd && !record.currentPeriodEnd)
  ) {
    record = await prisma.saasSubscription.update({
      where: { id: record.id },
      data: {
        status: 'ACTIVE',
        activatedAt: record.activatedAt ?? activatedAt,
        stripeSubscriptionId: stripeSubscriptionId || record.stripeSubscriptionId,
        stripeCustomerId: stripeCustomerId || record.stripeCustomerId,
        shopId: record.shopId || metadataShopId,
        checkoutAttemptId: record.checkoutAttemptId || checkoutAttemptId,
        cancelAtPeriodEnd,
        currentPeriodEnd: currentPeriodEnd ?? record.currentPeriodEnd,
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
  const setupSuccessUrl = buildSetupSuccessRecoveryUrl(getPublicSiteUrl(), sessionId);
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
        setupSuccessUrl,
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

function paymentIntentIdFromObject(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && typeof value.id === 'string' && value.id.trim()) {
    return value.id.trim();
  }
  return null;
}

async function handleDepositRefundEvent(event: StripeEvent): Promise<Response> {
  const obj = event.data.object;
  const objectType = (obj.object ?? '').trim();

  let stripeRefundId: string | null = null;
  let paymentIntentId: string | null = paymentIntentIdFromObject(obj.payment_intent);
  let status: 'succeeded' | 'failed' | 'pending' | 'canceled' = 'pending';
  let amountPence: number | null =
    typeof obj.amount === 'number' && Number.isFinite(obj.amount)
      ? Math.trunc(obj.amount)
      : typeof obj.amount_refunded === 'number' && Number.isFinite(obj.amount_refunded)
        ? Math.trunc(obj.amount_refunded)
        : null;

  if (event.type === 'refund.failed') {
    status = 'failed';
    stripeRefundId = obj.id?.startsWith('re_') ? obj.id : null;
  } else if (event.type === 'refund.updated' || objectType === 'refund') {
    stripeRefundId = obj.id?.startsWith('re_') ? obj.id : null;
    const raw = (obj.status ?? '').toLowerCase();
    if (raw === 'succeeded') status = 'succeeded';
    else if (raw === 'failed') status = 'failed';
    else if (raw === 'canceled' || raw === 'cancelled') status = 'canceled';
    else status = 'pending';
  } else if (event.type === 'charge.refunded') {
    // Charge object: prefer the latest refund entry.
    const latest = obj.refunds?.data?.[0];
    stripeRefundId = typeof latest?.id === 'string' ? latest.id : null;
    const raw = (latest?.status ?? 'succeeded').toLowerCase();
    if (raw === 'failed') status = 'failed';
    else if (raw === 'canceled' || raw === 'cancelled') status = 'canceled';
    else if (raw === 'pending') status = 'pending';
    else status = 'succeeded';
    if (typeof latest?.amount === 'number' && Number.isFinite(latest.amount)) {
      amountPence = Math.trunc(latest.amount);
    }
    // Charge.payment_intent is the PI id for Connect deposits.
    paymentIntentId = paymentIntentId ?? paymentIntentIdFromObject(obj.payment_intent);
  }

  const result = await confirmDepositRefundFromWebhook({
    stripeRefundId,
    paymentIntentId,
    status,
    amountPence,
  });

  opsLog('stripe.webhook', 'deposit_refund_event', {
    eventType: event.type,
    matched: result.matched,
    refundLedgerId: result.refund?.id ?? null,
    bookingId: result.refund?.bookingId ?? null,
    ledgerStatus: result.refund?.status ?? null,
    stripeRefundId,
    paymentIntentId,
  });

  // Unmatched is OK (retail / SaaS / manual Stripe refunds) — acknowledge so Stripe stops retrying.
  return new Response(
    JSON.stringify({
      ok: true,
      matched: result.matched,
      status: result.refund?.status ?? null,
    }),
    { status: 200 },
  );
}

async function handleConnectAccountUpdated(event: StripeEvent): Promise<Response> {
  const accountId = (event.account?.trim() || event.data.object.id?.trim() || '').trim();
  if (!accountId || !accountId.startsWith('acct_')) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
  }

  const chargesEnabled = Boolean(event.data.object.charges_enabled);
  const detailsSubmitted = Boolean(event.data.object.details_submitted);
  const eventAt =
    Number.isFinite(event.created) && event.created > 0
      ? new Date(event.created * 1000)
      : new Date();

  const result = await prisma.shopSettings.updateMany({
    where: {
      stripeConnectAccountId: accountId,
      OR: [{ connectStatusEventAt: null }, { connectStatusEventAt: { lte: eventAt } }],
    },
    data: {
      stripeConnectChargesEnabled: chargesEnabled,
      stripeConnectDetailsSubmitted: detailsSubmitted,
      connectStatusEventAt: eventAt,
    },
  });

  if (result.count === 0) {
    const known = await prisma.shopSettings.count({
      where: { stripeConnectAccountId: accountId },
    });
    console.info('[webhook] account.updated', {
      accountId,
      chargesEnabled,
      detailsSubmitted,
      shopsUpdated: 0,
      reason: known > 0 ? 'stale_ignored' : 'unknown_account',
    });
    return new Response(
      JSON.stringify({
        ok: true,
        accountId,
        shopsUpdated: 0,
        ignored: known > 0 ? 'stale_event' : 'unknown_account',
      }),
      { status: 200 },
    );
  }

  console.info('[webhook] account.updated', {
    accountId,
    chargesEnabled,
    detailsSubmitted,
    shopsUpdated: result.count,
  });

  return new Response(
    JSON.stringify({ ok: true, accountId, shopsUpdated: result.count }),
    { status: 200 },
  );
}

async function resolveBookingDepositStripeAccount(
  event: StripeEvent,
  metadata: Record<string, string>,
): Promise<string | null> {
  const fromEvent = event.account?.trim() || null;
  if (fromEvent) return fromEvent;

  const shopId = metadata.shopId?.trim();
  if (!shopId) return null;
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: { stripeConnectAccountId: true },
  });
  return shop?.stripeConnectAccountId?.trim() || null;
}

async function handleRetailOrderCheckout(
  sessionId: string,
  session: StripeSession,
  metadata: Record<string, string>,
  eventCreated: number,
): Promise<Response> {
  if ((session.payment_status ?? '').toLowerCase() !== 'paid') {
    return new Response(JSON.stringify({ error: 'Order not paid' }), { status: 400 });
  }

  const orderId = metadata.orderId?.trim() ?? '';
  const shopId = metadata.shopId?.trim() ?? '';
  const customerEmail = (
    session.customer_details?.email ??
    session.customer_email ??
    ''
  ).trim();
  const paidAt = Number.isFinite(eventCreated) ? new Date(eventCreated * 1000) : new Date();
  const amountTotal =
    typeof session.amount_total === 'number' && Number.isFinite(session.amount_total)
      ? session.amount_total
      : null;

  const result = await finalizeRetailOrderFromCheckout({
    orderId,
    shopId,
    sessionId,
    paymentIntentId: getCheckoutPaymentIntentId(session),
    amountTotal,
    customerEmail,
    paidAt,
  });

  if (result.outcome === 'confirmed') {
    return new Response(JSON.stringify({ ok: true, orderId: result.orderId }), { status: 200 });
  }
  if (result.outcome === 'duplicate') {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
  }
  if (result.outcome === 'not_found') {
    return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
  }
  if (result.outcome === 'amount_mismatch') {
    return new Response(JSON.stringify({ error: 'Amount mismatch' }), { status: 400 });
  }
  if (result.outcome === 'missing_email') {
    return new Response(JSON.stringify({ error: 'Missing customer email' }), { status: 400 });
  }
  return new Response(JSON.stringify({ error: 'Invalid shop order metadata' }), { status: 400 });
}

async function handleBookingDepositCheckout(
  sessionId: string,
  session: StripeSession,
  metadata: Record<string, string>,
  eventCreated: number,
): Promise<Response> {
  if ((session.payment_status ?? '').toLowerCase() !== 'paid') {
    return new Response(JSON.stringify({ error: 'Deposit not paid' }), { status: 400 });
  }
  const bookingId = metadata.bookingId?.trim();
  const shopId = metadata.shopId?.trim();
  if (!bookingId || !shopId || shopId === DEMO_SHOP_ID) {
    return new Response(JSON.stringify({ error: 'Invalid booking deposit metadata' }), { status: 400 });
  }

  const paidAt = Number.isFinite(eventCreated) ? new Date(eventCreated * 1000) : new Date();
  const result = await confirmPaidDeposit({
    bookingId,
    shopId,
    sessionId,
    paymentIntentId: getCheckoutPaymentIntentId(session),
    paidAt,
  });

  if (result.outcome === 'not_found') {
    return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
  }
  if (result.outcome === 'duplicate') {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
  }
  // confirmed / reinstated / late_refunded / conflicting_payment all ack Stripe
  // (alerts already fired for conflict and late-paid paths).
  return new Response(JSON.stringify({ ok: true, bookingId, outcome: result.outcome }), {
    status: 200,
  });
}

/**
 * Safety net: when Stripe expires the Checkout Session, release the local hold
 * if it is still PENDING_PAYMENT and past paymentExpiresAt.
 */
async function handleBookingDepositSessionExpired(event: StripeEvent): Promise<Response> {
  const sessionId =
    typeof event.data.object.id === 'string' ? event.data.object.id.trim() : '';
  const metadata = event.data.object.metadata ?? {};
  if ((metadata.type ?? '').trim() !== BOOKING_DEPOSIT_METADATA_TYPE) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
  }
  const bookingId = metadata.bookingId?.trim();
  const shopId = metadata.shopId?.trim();
  if (!bookingId || !shopId || shopId === DEMO_SHOP_ID) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
  }

  const now = new Date();
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      barber: { shopId },
      status: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,
    },
    select: { id: true, paymentExpiresAt: true, stripeCheckoutSessionId: true },
  });

  if (!booking) {
    return new Response(JSON.stringify({ ok: true, alreadyReleased: true }), { status: 200 });
  }

  const storedSessionId = booking.stripeCheckoutSessionId?.trim() || '';
  if (storedSessionId && sessionId && storedSessionId !== sessionId) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
  }

  if (booking.paymentExpiresAt && booking.paymentExpiresAt.getTime() > now.getTime()) {
    // Hold still within window — leave PENDING_PAYMENT; cron will expire the session first.
    return new Response(JSON.stringify({ ok: true, holdStillActive: true }), { status: 200 });
  }

  const released = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      status: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,
    },
    data: { status: BookingStatus.EXPIRED },
  });

  return new Response(
    JSON.stringify({ ok: true, released: released.count > 0, bookingId }),
    { status: 200 },
  );
}

function toRefId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && typeof value.id === 'string' && value.id.trim()) {
    return value.id.trim();
  }
  return null;
}

function getEventCustomerId(object: StripeEvent['data']['object']): string | null {
  return toRefId(object.customer);
}

function getEventSubscriptionId(object: StripeEvent['data']['object']): string | null {
  if ((object.object === 'subscription' || object.id.startsWith('sub_')) && object.id) {
    return object.id;
  }
  return toRefId(object.subscription) ?? toRefId(object.parent?.subscription_details?.subscription);
}

function toStripeSubscriptionFromEvent(object: StripeEvent['data']['object']): StripeSubscription {
  return {
    id: object.id,
    status: object.status ?? 'canceled',
    cancel_at_period_end: object.cancel_at_period_end,
    current_period_end: object.current_period_end,
    items: object.items,
    canceled_at: object.canceled_at,
    customer: object.customer,
    metadata: object.metadata,
  };
}

async function handleSaasSubscriptionLifecycleEvent(event: StripeEvent): Promise<Response> {
  const eventCreatedAt = periodEndFromUnixSeconds(event.created);
  const eventId = typeof event.id === 'string' ? event.id : null;

  if (
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const result = await applyStripeSubscriptionToSaasRecord(toStripeSubscriptionFromEvent(event.data.object), {
      forceCanceled: event.type === 'customer.subscription.deleted',
      eventCreatedAt,
      eventId,
    });
    logSaasSubscriptionStage('lifecycle_subscription_synced', {
      eventType: event.type,
      found: Boolean(result.record),
      shopId: result.shopId,
      grantedAccess: result.grantedAccess,
      status: result.record?.status,
      skipped: result.skipped ?? null,
    });
    if (!result.record) {
      await alertLifecycleNotFound({ eventType: event.type, eventId: event.id });
    }
    return new Response(
      JSON.stringify({
        ok: true,
        found: Boolean(result.record),
        skipped: result.skipped ?? null,
      }),
      { status: 200 },
    );
  }

  if (event.type === 'invoice.payment_failed') {
    const result = await applyInvoicePaymentFailed({
      stripeSubscriptionId: getEventSubscriptionId(event.data.object),
      stripeCustomerId: getEventCustomerId(event.data.object),
      eventCreatedAt,
      eventId,
    });
    logSaasSubscriptionStage('lifecycle_invoice_payment_failed', {
      found: Boolean(result.record),
      shopId: result.shopId,
      grantedAccess: result.grantedAccess,
      skipped: result.skipped ?? null,
    });
    if (!result.record) {
      await alertLifecycleNotFound({ eventType: event.type, eventId: event.id });
    }
    return new Response(
      JSON.stringify({
        ok: true,
        found: Boolean(result.record),
        skipped: result.skipped ?? null,
      }),
      { status: 200 },
    );
  }

  if (event.type === 'invoice.paid') {
    const periodEnd =
      periodEndFromUnixSeconds(event.data.object.lines?.data?.[0]?.period?.end ?? null) ??
      periodEndFromUnixSeconds(event.data.object.current_period_end ?? null);
    const result = await applyInvoicePaid({
      stripeSubscriptionId: getEventSubscriptionId(event.data.object),
      stripeCustomerId: getEventCustomerId(event.data.object),
      currentPeriodEnd: periodEnd,
      eventCreatedAt,
      eventId,
    });
    logSaasSubscriptionStage('lifecycle_invoice_paid', {
      found: Boolean(result.record),
      shopId: result.shopId,
      grantedAccess: result.grantedAccess,
      skipped: result.skipped ?? null,
    });
    if (!result.record) {
      await alertLifecycleNotFound({ eventType: event.type, eventId: event.id });
    }
    return new Response(
      JSON.stringify({
        ok: true,
        found: Boolean(result.record),
        skipped: result.skipped ?? null,
      }),
      { status: 200 },
    );
  }

  return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
}

export const POST: APIRoute = async ({ request }) => {
  let eventId: string | undefined;
  let eventType = 'unknown';
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');
    const verifyResult = signature
      ? verifyStripeWebhookSignature(rawBody, signature)
      : ({ ok: false, reason: 'malformed_header' } as const);
    if (!verifyResult.ok) {
      opsLogError('stripe.webhook', 'signature_rejected', verifyResult.reason, {
        reason: verifyResult.reason,
      });
      if (verifyResult.reason === 'timestamp_out_of_tolerance') {
        await notifyOpsDurable({
          severity: 'warning',
          title: 'Stripe webhook replay rejected',
          body: 'Webhook signature timestamp outside ±300s tolerance.',
          dedupeKey: 'webhook:replay-rejected',
          cooldownMs: 15 * 60 * 1000,
          fields: { reason: verifyResult.reason },
        });
      }
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
    }
    logSetupDepositStage('signature_verified');

    const event = JSON.parse(rawBody) as StripeEvent;
    eventId = typeof event.id === 'string' ? event.id : undefined;
    eventType = event.type;
    const eventCreatedAt = periodEndFromUnixSeconds(event.created);

    if (eventId) {
      const ingest = await recordStripeWebhookReceived({
        id: eventId,
        type: event.type,
        livemode: Boolean(event.livemode),
        eventCreatedAt,
      });
      opsLog('stripe.webhook', 'received', {
        eventId,
        type: event.type,
        previousStatus: ingest.previousStatus,
      });
      if (ingest.alreadyFinalized) {
        opsLog('stripe.webhook', 'duplicate_skipped', {
          eventId,
          type: event.type,
          previousStatus: ingest.previousStatus,
        });
        return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
      }
    }

    const finalize = (response: Response, opts?: { ignored?: boolean }) =>
      finalizeWebhookResponse(eventId, response, { ...opts, eventType: event.type });

    if (event.type === 'account.updated') {
      return await finalize(await handleConnectAccountUpdated(event));
    }

    if (event.type === 'checkout.session.expired') {
      return await finalize(await handleBookingDepositSessionExpired(event));
    }

    if (
      event.type === 'charge.refunded' ||
      event.type === 'refund.updated' ||
      event.type === 'refund.failed'
    ) {
      return await finalize(await handleDepositRefundEvent(event));
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted' ||
      event.type === 'invoice.paid' ||
      event.type === 'invoice.payment_failed'
    ) {
      return await finalize(await handleSaasSubscriptionLifecycleEvent(event));
    }

    if (!SETUP_FULFILMENT_EVENTS.has(event.type) && event.type !== 'checkout.session.completed') {
      return await finalize(new Response(JSON.stringify({ ok: true }), { status: 200 }), {
        ignored: !SETUP_FULFILMENT_EVENTS.has(event.type),
      });
    }

    const sessionId = event.data.object.id;
    const eventMetadata = event.data.object.metadata ?? {};
    let stripeAccount: string | undefined;

    if ((eventMetadata.type ?? '').trim() === BOOKING_DEPOSIT_METADATA_TYPE) {
      const resolved = await resolveBookingDepositStripeAccount(event, eventMetadata);
      if (!resolved) {
        return await finalize(
          new Response(
            JSON.stringify({ error: 'Missing connected account for booking deposit session' }),
            { status: 400 },
          ),
        );
      }
      stripeAccount = resolved;
    } else if (event.account?.trim()) {
      stripeAccount = event.account.trim();
    }

    const session = await retrieveCheckoutSession(
      sessionId,
      stripeAccount ? { stripeAccount } : undefined,
    );
    const metadata = session.metadata ?? eventMetadata;

    if (SETUP_FULFILMENT_EVENTS.has(event.type) && metadata.type === 'setup_deposit') {
      return await finalize(await handleSetupDepositCheckout(sessionId, session, metadata, event.created));
    }

    if (SETUP_FULFILMENT_EVENTS.has(event.type) && metadata.type === SAAS_SUBSCRIPTION_METADATA_TYPE) {
      return await finalize(await handleSaasSubscriptionCheckout(sessionId, session, metadata, event.created));
    }

    if (SETUP_FULFILMENT_EVENTS.has(event.type) && metadata.type === BOOKING_DEPOSIT_METADATA_TYPE) {
      return await finalize(
        await handleBookingDepositCheckout(sessionId, session, metadata, event.created),
      );
    }

    if (SETUP_FULFILMENT_EVENTS.has(event.type) && metadata.type === SHOP_ORDER_METADATA_TYPE) {
      return await finalize(
        await handleRetailOrderCheckout(sessionId, session, metadata, event.created),
      );
    }

    // Untyped checkout sessions are no longer auto-materialised into Orders.
    return await finalize(
      new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 }),
      { ignored: true },
    );
  } catch (error) {
    console.error('Stripe webhook failed', error);
    captureOpsException(error, { route: '/api/shop/webhook', tags: { eventType } });
    if (eventId) {
      const message = error instanceof Error ? error.message : 'Webhook handling failed';
      await markStripeWebhookStatus(eventId, 'FAILED', {
        httpStatus: 500,
        error: message.slice(0, 500),
      });
      await alertStripeWebhookFailure({
        eventId,
        type: eventType,
        error: message,
        httpStatus: 500,
      });
    }
    return new Response(JSON.stringify({ error: 'Webhook handling failed' }), { status: 500 });
  }
};
