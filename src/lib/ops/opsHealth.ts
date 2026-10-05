import { DepositRefundStatus, EmailOutboundStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { captureOpsMessage } from '@/lib/ops/sentry';
import { opsLog } from '@/lib/ops/opsLog';

export type MessagingFailRate = {
  channel: 'email' | 'sms';
  sent: number;
  failed: number;
  attempts: number;
  failRate: number;
  consecutiveFailed: number;
  shouldAlert: boolean;
};

const WINDOW_MS = 60 * 60 * 1000;
const MIN_ATTEMPTS = 5;
const FAIL_RATE_THRESHOLD = 0.2;
const CONSECUTIVE_FAILED_THRESHOLD = 3;
const STRIPE_VOLUME_RUN_RATE_WINDOW_DAYS = 30;
const STRIPE_REVENUE_SHARE_PUBLISHED_THRESHOLD_USD = 1_000_000;

export type StripeConnectVolumeMetrics = {
  windowDays: number;
  bookingOnlineCardPence30d: number;
  retailOnlineCardPence30d: number;
  totalOnlineCardPence30d: number;
  annualisedOnlineCardPenceGbp: number;
  totalOnlineCardPence365d: number;
  activeStandardAccounts: number;
  activeLegacyExpressAccounts: number;
  disconnectedAccounts: number;
  publishedThresholdUsd: number;
};

function sumPence(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/**
 * Gross successful online-card volume known to KERSIVO. Refunded payments remain part of gross
 * processed volume because paidAt is preserved; Pay-at-shop bookings are excluded.
 *
 * We intentionally report the run-rate in GBP pence. Stripe publishes the eligibility threshold
 * in USD, but KERSIVO must not make payment operations depend on a volatile external FX feed.
 * Convert this reporting metric to USD in the reporting/finance layer when checking the threshold.
 */
export async function collectStripeConnectVolumeMetrics(
  now = new Date(),
): Promise<StripeConnectVolumeMetrics> {
  const since30d = new Date(now.getTime() - STRIPE_VOLUME_RUN_RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const since365d = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [booking30d, retail30d, booking365d, retail365d, activeStandardAccounts, activeLegacyExpressAccounts, disconnectedAccounts] =
    await Promise.all([
      prisma.booking.aggregate({
        where: {
          paidAt: { gte: since30d },
          paymentAmountPence: { not: null },
          stripeConnectAccountIdAtPayment: { not: null },
        },
        _sum: { paymentAmountPence: true },
      }),
      prisma.order.aggregate({
        where: {
          paidAt: { gte: since30d },
          stripeConnectAccountId: { not: null },
        },
        _sum: { totalPence: true },
      }),
      prisma.booking.aggregate({
        where: {
          paidAt: { gte: since365d },
          paymentAmountPence: { not: null },
          stripeConnectAccountIdAtPayment: { not: null },
        },
        _sum: { paymentAmountPence: true },
      }),
      prisma.order.aggregate({
        where: {
          paidAt: { gte: since365d },
          stripeConnectAccountId: { not: null },
        },
        _sum: { totalPence: true },
      }),
      prisma.shopSettings.count({
        where: {
          stripeConnectAccountType: 'STANDARD',
          stripeConnectAccountId: { not: null },
          stripeConnectDisconnectedAt: null,
          stripeConnectChargesEnabled: true,
        },
      }),
      prisma.shopSettings.count({
        where: {
          stripeConnectAccountType: 'EXPRESS',
          stripeConnectAccountId: { not: null },
          stripeConnectDisconnectedAt: null,
          stripeConnectChargesEnabled: true,
        },
      }),
      prisma.shopSettings.count({
        where: {
          stripeConnectAccountId: { not: null },
          stripeConnectDisconnectedAt: { not: null },
        },
      }),
    ]);

  const bookingOnlineCardPence30d = sumPence(booking30d._sum.paymentAmountPence);
  const retailOnlineCardPence30d = sumPence(retail30d._sum.totalPence);
  const totalOnlineCardPence30d = bookingOnlineCardPence30d + retailOnlineCardPence30d;
  const totalOnlineCardPence365d =
    sumPence(booking365d._sum.paymentAmountPence) + sumPence(retail365d._sum.totalPence);

  return {
    windowDays: STRIPE_VOLUME_RUN_RATE_WINDOW_DAYS,
    bookingOnlineCardPence30d,
    retailOnlineCardPence30d,
    totalOnlineCardPence30d,
    annualisedOnlineCardPenceGbp: Math.round(
      (totalOnlineCardPence30d * 365) / STRIPE_VOLUME_RUN_RATE_WINDOW_DAYS,
    ),
    totalOnlineCardPence365d,
    activeStandardAccounts,
    activeLegacyExpressAccounts,
    disconnectedAccounts,
    publishedThresholdUsd: STRIPE_REVENUE_SHARE_PUBLISHED_THRESHOLD_USD,
  };
}

export function evaluateMessagingFailRate(input: {
  channel: 'email' | 'sms';
  sent: number;
  failed: number;
  consecutiveFailed: number;
}): MessagingFailRate {
  const attempts = input.sent + input.failed;
  const failRate = attempts > 0 ? input.failed / attempts : 0;
  const shouldAlert =
    (attempts >= MIN_ATTEMPTS && failRate >= FAIL_RATE_THRESHOLD) ||
    input.consecutiveFailed >= CONSECUTIVE_FAILED_THRESHOLD;
  return {
    channel: input.channel,
    sent: input.sent,
    failed: input.failed,
    attempts,
    failRate,
    consecutiveFailed: input.consecutiveFailed,
    shouldAlert,
  };
}

async function consecutiveSmsFailedCount(): Promise<number> {
  const recent = await prisma.smsOutbound.findMany({
    orderBy: { createdAt: 'desc' },
    take: CONSECUTIVE_FAILED_THRESHOLD,
    select: { status: true },
  });
  let count = 0;
  for (const row of recent) {
    if (row.status !== 'FAILED') break;
    count += 1;
  }
  return count;
}

export async function collectMessagingFailRates(now = new Date()): Promise<{
  email: MessagingFailRate;
  sms: MessagingFailRate;
}> {
  const since = new Date(now.getTime() - WINDOW_MS);

  // EmailOutbound is not on main yet (appointment email reminders). Keep zero metrics until that ships.
  const email = evaluateMessagingFailRate({
    channel: 'email',
    sent: 0,
    failed: 0,
    consecutiveFailed: 0,
  });

  const [smsSent, smsFailed, smsConsec] = await Promise.all([
    prisma.smsOutbound.count({ where: { createdAt: { gte: since }, status: 'SENT' } }),
    prisma.smsOutbound.count({ where: { createdAt: { gte: since }, status: 'FAILED' } }),
    consecutiveSmsFailedCount(),
  ]);

  return {
    email,
    sms: evaluateMessagingFailRate({
      channel: 'sms',
      sent: smsSent,
      failed: smsFailed,
      consecutiveFailed: smsConsec,
    }),
  };
}

export async function collectStuckWebhookFailures(now = new Date()): Promise<
  Array<{ id: string; type: string; createdAt: Date; error: string | null }>
> {
  const olderThan = new Date(now.getTime() - 10 * 60 * 1000);
  return prisma.stripeWebhookEvent.findMany({
    where: {
      status: 'FAILED',
      createdAt: { lte: olderThan },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true, type: true, createdAt: true, error: true },
  });
}

export async function collectStuckRefunds(now = new Date()): Promise<
  Array<{
    id: string;
    bookingId: string;
    shopId: string;
    status: DepositRefundStatus;
    attempts: number;
    createdAt: Date;
    lastError: string | null;
  }>
> {
  const olderThan = new Date(now.getTime() - 15 * 60 * 1000);
  return prisma.bookingDepositRefund.findMany({
    where: {
      OR: [
        {
          status: DepositRefundStatus.REFUND_FAILED,
          updatedAt: { lte: olderThan },
        },
        {
          status: DepositRefundStatus.REFUND_PENDING,
          createdAt: { lte: olderThan },
          attempts: { gte: 2 },
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: {
      id: true,
      bookingId: true,
      shopId: true,
      status: true,
      attempts: true,
      createdAt: true,
      lastError: true,
    },
  });
}

export async function collectStuckEmails(now = new Date()): Promise<
  Array<{
    id: string;
    shopId: string;
    bookingId: string | null;
    purpose: string;
    status: EmailOutboundStatus;
    attempts: number;
    createdAt: Date;
    error: string | null;
  }>
> {
  const olderThan = new Date(now.getTime() - 30 * 60 * 1000);
  return prisma.emailOutbound.findMany({
    where: {
      OR: [
        {
          status: EmailOutboundStatus.FAILED,
          updatedAt: { lte: olderThan },
        },
        {
          status: EmailOutboundStatus.QUEUED,
          createdAt: { lte: olderThan },
          // Only durable outbox rows (reminders without nextAttemptAt are excluded).
          nextAttemptAt: { not: null },
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: {
      id: true,
      shopId: true,
      bookingId: true,
      purpose: true,
      status: true,
      attempts: true,
      createdAt: true,
      error: true,
    },
  });
}

export async function runOpsHealthChecks(now = new Date()): Promise<{
  emailFailRate: number;
  smsFailRate: number;
  webhookFailedCount: number;
  stuckRefundCount: number;
  stuckEmailCount: number;
  stripeVolume: StripeConnectVolumeMetrics;
  alertsFired: string[];
}> {
  const alertsFired: string[] = [];
  const messaging = await collectMessagingFailRates(now);
  const stuck = await collectStuckWebhookFailures(now);
  const stuckRefunds = await collectStuckRefunds(now);
  const stuckEmails = await collectStuckEmails(now);
  const stripeVolume = await collectStripeConnectVolumeMetrics(now);

  if (messaging.email.shouldAlert) {
    const key = 'messaging:email-fail-rate';
    // alertsFired = condition raised via Sentry capture path (not delivery confirmation).
    alertsFired.push(key);
    captureOpsMessage('Email outbound failure rate high', {
      level: 'warning',
      route: 'opsHealth.messaging.email',
      tags: {
        sent: String(messaging.email.sent),
        failed: String(messaging.email.failed),
        consecutiveFailed: String(messaging.email.consecutiveFailed),
      },
    });
  }

  if (messaging.sms.shouldAlert) {
    const key = 'messaging:sms-fail-rate';
    alertsFired.push(key);
    captureOpsMessage('SMS outbound failure rate high', {
      level: 'warning',
      route: 'opsHealth.messaging.sms',
      tags: {
        sent: String(messaging.sms.sent),
        failed: String(messaging.sms.failed),
        consecutiveFailed: String(messaging.sms.consecutiveFailed),
      },
    });
  }

  for (const row of stuck) {
    const key = `webhook:stuck:${row.id}`;
    alertsFired.push(key);
    captureOpsMessage('Stripe webhook stuck FAILED', {
      level: 'error',
      route: 'opsHealth.webhook.stuck',
      tags: {
        eventId: row.id,
        eventType: row.type,
      },
    });
  }

  for (const row of stuckRefunds) {
    const key = `refund:stuck:${row.bookingId}`;
    alertsFired.push(key);
    captureOpsMessage('Deposit refund stuck', {
      level: 'error',
      route: 'opsHealth.refund.stuck',
      shopId: row.shopId,
      tags: {
        bookingId: row.bookingId,
        refundLedgerId: row.id,
        status: row.status,
        attempts: String(row.attempts),
      },
    });
  }

  for (const row of stuckEmails) {
    const key = `email:stuck:${row.id}`;
    alertsFired.push(key);
    captureOpsMessage('Transactional email stuck', {
      level: 'error',
      route: 'opsHealth.email.stuck',
      shopId: row.shopId,
      tags: {
        emailOutboundId: row.id,
        purpose: row.purpose,
        status: row.status,
        attempts: String(row.attempts),
        ...(row.bookingId ? { bookingId: row.bookingId } : {}),
      },
    });
  }

  opsLog('ops.health', 'check_complete', {
    emailFailRate: Number(messaging.email.failRate.toFixed(4)),
    smsFailRate: Number(messaging.sms.failRate.toFixed(4)),
    webhookFailedCount: stuck.length,
    stuckRefundCount: stuckRefunds.length,
    stuckEmailCount: stuckEmails.length,
    stripeOnlineCardPence30d: stripeVolume.totalOnlineCardPence30d,
    stripeAnnualisedOnlineCardPenceGbp: stripeVolume.annualisedOnlineCardPenceGbp,
    stripeActiveStandardAccounts: stripeVolume.activeStandardAccounts,
    stripeActiveLegacyExpressAccounts: stripeVolume.activeLegacyExpressAccounts,
    alertsFired: alertsFired.length,
  });

  return {
    emailFailRate: messaging.email.failRate,
    smsFailRate: messaging.sms.failRate,
    webhookFailedCount: stuck.length,
    stuckRefundCount: stuckRefunds.length,
    stuckEmailCount: stuckEmails.length,
    stripeVolume,
    alertsFired,
  };
}
