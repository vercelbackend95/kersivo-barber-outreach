import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';

const verifyStripeWebhookSignature = vi.fn();
const retrieveCheckoutSession = vi.fn();
const getCheckoutSubscriptionId = vi.fn();
const getCheckoutCustomerId = vi.fn();
const retrieveSubscription = vi.fn();
const getSubscriptionCurrentPeriodEnd = vi.fn();
const recordStripeWebhookReceived = vi.fn();
const markStripeWebhookStatus = vi.fn();
const notifyOpsDurable = vi.fn();
const alertStripeWebhookFailure = vi.fn();

const findUniqueSaas = vi.fn();
const createSaas = vi.fn();
const updateSaas = vi.fn();

const ATTEMPT = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_ATTEMPT = '660e8400-e29b-41d4-a716-446655440099';

vi.mock('../../../lib/shop/stripe', () => ({
  verifyStripeWebhookSignature: (...args: unknown[]) => verifyStripeWebhookSignature(...args),
  retrieveCheckoutSession: (...args: unknown[]) => retrieveCheckoutSession(...args),
  getCheckoutCustomerId: (...args: unknown[]) => getCheckoutCustomerId(...args),
  getCheckoutPaymentIntentId: vi.fn(),
  getCheckoutSubscriptionId: (...args: unknown[]) => getCheckoutSubscriptionId(...args),
  getSubscriptionCurrentPeriodEnd: (...args: unknown[]) => getSubscriptionCurrentPeriodEnd(...args),
  retrieveSubscription: (...args: unknown[]) => retrieveSubscription(...args),
}));

vi.mock('../../../lib/ops/stripeWebhookLedger', () => ({
  recordStripeWebhookReceived: (...args: unknown[]) => recordStripeWebhookReceived(...args),
  markStripeWebhookStatus: (...args: unknown[]) => markStripeWebhookStatus(...args),
  notifyOpsDurable: (...args: unknown[]) => notifyOpsDurable(...args),
  alertStripeWebhookFailure: (...args: unknown[]) => alertStripeWebhookFailure(...args),
  alertLifecycleNotFound: vi.fn(),
}));

vi.mock('../../../lib/ops/opsLog', () => ({
  opsLog: vi.fn(),
  opsLogError: vi.fn(),
}));

vi.mock('../../../lib/ops/sentry', () => ({
  captureOpsException: vi.fn(),
}));

vi.mock('../../../lib/db/client', () => ({
  prisma: {
    shopSettings: {
      updateMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    order: { findFirst: vi.fn(), updateMany: vi.fn() },
    booking: { findFirst: vi.fn(), updateMany: vi.fn() },
    saasSubscription: {
      findUnique: (...args: unknown[]) => findUniqueSaas(...args),
      create: (...args: unknown[]) => createSaas(...args),
      update: (...args: unknown[]) => updateSaas(...args),
    },
    setupDeposit: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
}));

vi.mock('../../../lib/setup/saasSubscriptionLifecycle', () => ({
  applyInvoicePaid: vi.fn(),
  applyInvoicePaymentFailed: vi.fn(),
  applyStripeSubscriptionToSaasRecord: vi.fn(),
}));

vi.mock('../../../lib/shop/cardPaymentsGate', () => ({
  SHOP_ORDER_METADATA_TYPE: 'shop_order',
}));

vi.mock('../../../lib/shop/finalizeRetailOrder', () => ({
  finalizeRetailOrderFromCheckout: vi.fn(),
}));

vi.mock('../../../lib/booking/confirmPaidDeposit', () => ({
  confirmPaidDeposit: vi.fn(),
}));

vi.mock('../../../lib/booking/depositMoney', () => ({
  confirmDepositRefundFromWebhook: vi.fn(),
}));

vi.mock('../../../lib/booking/depositGate', () => ({
  BOOKING_DEPOSIT_METADATA_TYPE: 'booking_deposit',
}));

vi.mock('../../../lib/admin/analyticsMode', () => ({
  setShopAnalyticsLive: vi.fn(async () => undefined),
  setShopAnalyticsLiveForOwnerEmail: vi.fn(async () => true),
}));

vi.mock('../../../lib/shop/markShopPaid', () => ({
  markShopPaid: vi.fn(async () => undefined),
  markShopPaidForOwnerEmail: vi.fn(async () => true),
}));

vi.mock('../../../lib/sms/shopSmsGate', () => ({
  enableShopSmsReminders: vi.fn(async () => undefined),
  enableShopSmsRemindersForOwnerEmail: vi.fn(async () => true),
}));

vi.mock('../../../lib/email/sender', () => ({
  EmailDeliveryError: class EmailDeliveryError extends Error {},
  getSetupOnboardingFormUrlOrEmpty: () => '',
  sendSaasSubscriptionConfirmationEmail: vi.fn(async () => undefined),
  sendSaasSubscriptionInternalNotificationEmail: vi.fn(async () => undefined),
  sendSetupDepositConfirmationEmail: vi.fn(),
  sendSetupDepositInternalNotificationEmail: vi.fn(),
}));

vi.mock('../../../lib/setup/plans', () => ({
  getSetupPlan: vi.fn(),
  isSetupPlanId: vi.fn(() => false),
}));

vi.mock('../../../lib/setup/saasSubscription', () => ({
  SAAS_SUBSCRIPTION_METADATA_TYPE: 'saas_subscription',
}));

vi.mock('../../../lib/seo/defaults', () => ({
  SAAS_MONTHLY_PENCE: 3900,
}));

vi.mock('../../../lib/db/shopScope', () => ({
  DEMO_SHOP_ID: 'demo',
}));

vi.mock('../../../lib/shop/money', () => ({
  formatGbp: (n: number) => `£${(n / 100).toFixed(2)}`,
}));

vi.mock('../../../lib/setup/saasEntitlement', () => ({
  periodEndFromUnixSeconds: (s: number | null | undefined) =>
    typeof s === 'number' && Number.isFinite(s) && s > 0 ? new Date(s * 1000) : null,
}));

import { POST } from './webhook';

function signedRequest(body: object) {
  const raw = JSON.stringify(body);
  verifyStripeWebhookSignature.mockReturnValue({ ok: true });
  return {
    request: new Request('https://kersivo.co.uk/api/shop/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${Math.floor(Date.now() / 1000)},v1=${crypto
          .createHash('sha256')
          .update(raw)
          .digest('hex')}`,
      },
      body: raw,
    }),
  };
}

function saasCheckoutEvent(metadata: Record<string, string>, sessionId = 'cs_saas_1') {
  return {
    id: `evt_${sessionId}`,
    type: 'checkout.session.completed',
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: sessionId,
        metadata,
      },
    },
  };
}

const baseMeta = {
  type: 'saas_subscription',
  customerName: 'Alex Owner',
  email: 'alex@example.com',
  shopName: 'Fade Studio',
  shopSize: '1-2',
  currentStack: 'landing',
  checkoutAttemptId: ATTEMPT,
};

describe('POST /api/shop/webhook SaaS checkoutAttemptId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: true });
    markStripeWebhookStatus.mockResolvedValue(undefined);
    recordStripeWebhookReceived.mockResolvedValue({
      alreadyFinalized: false,
      previousStatus: null,
    });
    getCheckoutSubscriptionId.mockReturnValue('sub_1');
    getCheckoutCustomerId.mockReturnValue('cus_1');
    getSubscriptionCurrentPeriodEnd.mockReturnValue(Math.floor(Date.now() / 1000) + 86400);
    retrieveSubscription.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
    });
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_saas_1',
      payment_status: 'paid',
      amount_total: 3900,
      currency: 'gbp',
      customer_email: 'alex@example.com',
      metadata: baseMeta,
    });
    findUniqueSaas.mockResolvedValue(null);
    createSaas.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'saas_1',
      ...data,
      customerEmailSentAt: null,
      internalEmailSentAt: null,
      activatedAt: data.activatedAt ?? null,
    }));
    updateSaas.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'saas_1',
      status: 'ACTIVE',
      checkoutAttemptId: ATTEMPT,
      customerEmailSentAt: new Date(),
      internalEmailSentAt: new Date(),
      ...data,
    }));
  });

  it('creates a new record with checkoutAttemptId from metadata', async () => {
    const res = await POST(signedRequest(saasCheckoutEvent(baseMeta)) as never);
    expect(res.status).toBe(200);
    expect(createSaas).toHaveBeenCalledWith({
      data: expect.objectContaining({
        checkoutAttemptId: ATTEMPT,
        stripeSessionId: 'cs_saas_1',
        status: 'ACTIVE',
      }),
    });
  });

  it('preserves existing checkoutAttemptId when activating PENDING', async () => {
    findUniqueSaas.mockResolvedValue({
      id: 'saas_1',
      status: 'PENDING',
      checkoutAttemptId: ATTEMPT,
      stripeSessionId: 'cs_saas_1',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      shopId: null,
      activatedAt: null,
      currentPeriodEnd: null,
      customerEmailSentAt: null,
      internalEmailSentAt: null,
    });
    updateSaas.mockResolvedValue({
      id: 'saas_1',
      status: 'ACTIVE',
      checkoutAttemptId: ATTEMPT,
      customerEmailSentAt: new Date(),
      internalEmailSentAt: new Date(),
    });

    const res = await POST(signedRequest(saasCheckoutEvent(baseMeta)) as never);
    expect(res.status).toBe(200);
    expect(createSaas).not.toHaveBeenCalled();
    expect(updateSaas).toHaveBeenCalledWith({
      where: { id: 'saas_1' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        checkoutAttemptId: ATTEMPT,
      }),
    });
  });

  it('fills missing checkoutAttemptId from metadata', async () => {
    findUniqueSaas.mockResolvedValue({
      id: 'saas_1',
      status: 'PENDING',
      checkoutAttemptId: null,
      stripeSessionId: 'cs_saas_1',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      shopId: null,
      activatedAt: null,
      currentPeriodEnd: null,
      customerEmailSentAt: null,
      internalEmailSentAt: null,
    });
    updateSaas.mockResolvedValue({
      id: 'saas_1',
      status: 'ACTIVE',
      checkoutAttemptId: ATTEMPT,
      customerEmailSentAt: new Date(),
      internalEmailSentAt: new Date(),
    });

    await POST(signedRequest(saasCheckoutEvent(baseMeta)) as never);
    expect(updateSaas).toHaveBeenCalledWith({
      where: { id: 'saas_1' },
      data: expect.objectContaining({
        checkoutAttemptId: ATTEMPT,
      }),
    });
  });

  it('does not overwrite mismatched existing checkoutAttemptId', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_saas_1',
      payment_status: 'paid',
      amount_total: 3900,
      currency: 'gbp',
      customer_email: 'alex@example.com',
      metadata: {
        ...baseMeta,
        checkoutAttemptId: OTHER_ATTEMPT,
      },
    });
    findUniqueSaas.mockResolvedValue({
      id: 'saas_1',
      status: 'PENDING',
      checkoutAttemptId: ATTEMPT,
      stripeSessionId: 'cs_saas_1',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      shopId: null,
      activatedAt: null,
      currentPeriodEnd: null,
      customerEmailSentAt: null,
      internalEmailSentAt: null,
    });
    updateSaas.mockResolvedValue({
      id: 'saas_1',
      status: 'ACTIVE',
      checkoutAttemptId: ATTEMPT,
      customerEmailSentAt: new Date(),
      internalEmailSentAt: new Date(),
    });

    await POST(
      signedRequest(
        saasCheckoutEvent({
          ...baseMeta,
          checkoutAttemptId: OTHER_ATTEMPT,
        }),
      ) as never,
    );

    expect(warn).toHaveBeenCalled();
    expect(updateSaas).toHaveBeenCalledWith({
      where: { id: 'saas_1' },
      data: expect.objectContaining({
        checkoutAttemptId: ATTEMPT,
      }),
    });
    warn.mockRestore();
  });

  it('recovers on P2002 via session/subscription/attempt lookup without a second create', async () => {
    createSaas.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    findUniqueSaas
      .mockResolvedValueOnce(null) // initial by session
      .mockResolvedValueOnce({
        id: 'saas_winner',
        status: 'PENDING',
        checkoutAttemptId: ATTEMPT,
        stripeSessionId: 'cs_saas_1',
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        shopId: null,
        activatedAt: null,
        currentPeriodEnd: null,
        customerEmailSentAt: null,
        internalEmailSentAt: null,
      });
    updateSaas.mockResolvedValue({
      id: 'saas_winner',
      status: 'ACTIVE',
      checkoutAttemptId: ATTEMPT,
      customerEmailSentAt: new Date(),
      internalEmailSentAt: new Date(),
    });

    const res = await POST(signedRequest(saasCheckoutEvent(baseMeta)) as never);
    expect(res.status).toBe(200);
    expect(createSaas).toHaveBeenCalledTimes(1);
    expect(updateSaas).toHaveBeenCalled();
  });

  it('preserves existing shopId when metadata has no shopId', async () => {
    findUniqueSaas.mockResolvedValue({
      id: 'saas_1',
      status: 'PENDING',
      checkoutAttemptId: ATTEMPT,
      stripeSessionId: 'cs_saas_1',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      shopId: 'shop-linked',
      activatedAt: null,
      currentPeriodEnd: null,
      customerEmailSentAt: null,
      internalEmailSentAt: null,
    });
    updateSaas.mockResolvedValue({
      id: 'saas_1',
      status: 'ACTIVE',
      checkoutAttemptId: ATTEMPT,
      shopId: 'shop-linked',
      customerEmailSentAt: new Date(),
      internalEmailSentAt: new Date(),
    });

    // baseMeta has no shopId — guest Stripe metadata style
    await POST(signedRequest(saasCheckoutEvent(baseMeta)) as never);

    expect(updateSaas).toHaveBeenCalledWith({
      where: { id: 'saas_1' },
      data: expect.objectContaining({
        shopId: 'shop-linked',
        status: 'ACTIVE',
      }),
    });
  });
});
