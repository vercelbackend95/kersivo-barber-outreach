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
  alertStripeWebhookFailure: (...args: unknown[]) => alertStripeWebhookFailure(...args),
  alertLifecycleNotFound: vi.fn(),
}));

vi.mock('../../../lib/ops/opsLog', () => ({
  opsLog: vi.fn(),
  opsLogError: vi.fn(),
}));

vi.mock('../../../lib/ops/sentry', () => ({
  captureOpsException: vi.fn(),
  captureOpsMessage: vi.fn(),
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
  confirmPaidBookingPayment: vi.fn(),
}));

vi.mock('../../../lib/booking/depositMoney', () => ({
  confirmBookingPaymentRefundFromWebhook: vi.fn(),
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

const markPreviewRequestConverted = vi.fn();
vi.mock('../../../lib/freePreview/conversion', () => ({
  markPreviewRequestConverted: (...args: unknown[]) => markPreviewRequestConverted(...args),
}));

import { POST } from './webhook';
import { markShopPaid } from '../../../lib/shop/markShopPaid';

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

const minimisedMeta = {
  type: 'saas_subscription',
  checkoutAttemptId: ATTEMPT,
};

const pendingRow = {
  id: 'saas_1',
  status: 'PENDING' as const,
  checkoutAttemptId: ATTEMPT,
  stripeSessionId: 'cs_saas_1',
  stripeSubscriptionId: null as string | null,
  stripeCustomerId: null as string | null,
  shopId: null as string | null,
  activatedAt: null as Date | null,
  currentPeriodEnd: null as Date | null,
  customerEmailSentAt: null as Date | null,
  internalEmailSentAt: null as Date | null,
  customerName: 'Alex Owner',
  customerEmail: 'alex@example.com',
  shopName: 'Fade Studio',
  shopSize: '1-2',
  currentStack: 'landing',
};

const PREVIEW_META = {
  type: 'saas_subscription',
  checkoutAttemptId: ATTEMPT,
  shopId: 'draft_shop_1',
  previewRequestId: 'req_1',
};

describe('POST /api/shop/webhook — free preview launch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markStripeWebhookStatus.mockResolvedValue(undefined);
    recordStripeWebhookReceived.mockResolvedValue({ alreadyFinalized: false, previousStatus: null });
    getCheckoutSubscriptionId.mockReturnValue('sub_1');
    getCheckoutCustomerId.mockReturnValue('cus_1');
    getSubscriptionCurrentPeriodEnd.mockReturnValue(Math.floor(Date.now() / 1000) + 86400);
    retrieveSubscription.mockResolvedValue({ id: 'sub_1', status: 'active', cancel_at_period_end: false });
    findUniqueSaas.mockResolvedValue({ ...pendingRow, shopId: 'draft_shop_1' });
    updateSaas.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...pendingRow,
      shopId: 'draft_shop_1',
      customerEmailSentAt: new Date(),
      internalEmailSentAt: new Date(),
      ...data,
    }));
    markPreviewRequestConverted.mockResolvedValue('converted');
  });

  function sessionWith(metadata: Record<string, string>) {
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_saas_1',
      payment_status: 'paid',
      amount_total: 3900,
      currency: 'gbp',
      customer_email: 'alex@example.com',
      metadata,
    });
  }

  it('marks the preview request converted with the Stripe ids and the draft shop from metadata', async () => {
    sessionWith(PREVIEW_META);
    const res = await POST(signedRequest(saasCheckoutEvent(PREVIEW_META)) as never);
    expect(res.status).toBe(200);
    expect(markPreviewRequestConverted).toHaveBeenCalledWith({
      previewRequestId: 'req_1',
      draftShopId: 'draft_shop_1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeSessionId: 'cs_saas_1',
    });
    // The draft shop is marked paid exactly like any guest checkout with a shopId; it is not rebuilt.
    expect(markShopPaid).toHaveBeenCalledWith('draft_shop_1');
  });

  it('is safe to redeliver: an already converted request still returns 200', async () => {
    sessionWith(PREVIEW_META);
    markPreviewRequestConverted.mockResolvedValue('already_converted');
    const res = await POST(signedRequest(saasCheckoutEvent(PREVIEW_META)) as never);
    expect(res.status).toBe(200);
  });

  it('never touches preview requests for an ordinary /admin/launch checkout', async () => {
    findUniqueSaas.mockResolvedValue({ ...pendingRow });
    sessionWith(minimisedMeta);
    const res = await POST(signedRequest(saasCheckoutEvent(minimisedMeta)) as never);
    expect(res.status).toBe(200);
    expect(markPreviewRequestConverted).not.toHaveBeenCalled();
    expect(updateSaas).toHaveBeenCalledWith({
      where: { id: 'saas_1' },
      data: expect.objectContaining({ status: 'ACTIVE' }),
    });
  });
});
