import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';

const verifyStripeWebhookSignature = vi.fn();
const recordStripeWebhookReceived = vi.fn();
const notifyOpsDurable = vi.fn();
const markStripeWebhookStatus = vi.fn();
const alertStripeWebhookFailure = vi.fn();
const updateMany = vi.fn();
const countShops = vi.fn();
const applyInvoicePaymentFailed = vi.fn();
const applyInvoicePaid = vi.fn();
const applyStripeSubscriptionToSaasRecord = vi.fn();

vi.mock('../../../lib/shop/stripe', () => ({
  verifyStripeWebhookSignature: (...args: unknown[]) => verifyStripeWebhookSignature(...args),
  retrieveCheckoutSession: vi.fn(),
  getCheckoutCustomerId: vi.fn(),
  getCheckoutPaymentIntentId: vi.fn(),
  getCheckoutSubscriptionId: vi.fn(),
  getSubscriptionCurrentPeriodEnd: vi.fn(),
  retrieveSubscription: vi.fn(),
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
      updateMany: (...args: unknown[]) => updateMany(...args),
      count: (...args: unknown[]) => countShops(...args),
      findUnique: vi.fn(),
    },
    order: { findFirst: vi.fn(), updateMany: vi.fn() },
    booking: { findFirst: vi.fn(), updateMany: vi.fn() },
    saasSubscription: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    setupDeposit: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
}));

vi.mock('../../../lib/setup/saasSubscriptionLifecycle', () => ({
  applyInvoicePaid: (...args: unknown[]) => applyInvoicePaid(...args),
  applyInvoicePaymentFailed: (...args: unknown[]) => applyInvoicePaymentFailed(...args),
  applyStripeSubscriptionToSaasRecord: (...args: unknown[]) =>
    applyStripeSubscriptionToSaasRecord(...args),
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
  setShopAnalyticsLive: vi.fn(),
  setShopAnalyticsLiveForOwnerEmail: vi.fn(),
}));

vi.mock('../../../lib/shop/markShopPaid', () => ({
  markShopPaid: vi.fn(),
  markShopPaidForOwnerEmail: vi.fn(),
}));

vi.mock('../../../lib/sms/shopSmsGate', () => ({
  enableShopSmsReminders: vi.fn(),
  enableShopSmsRemindersForOwnerEmail: vi.fn(),
}));

vi.mock('../../../lib/email/sender', () => ({
  EmailDeliveryError: class EmailDeliveryError extends Error {},
  getSetupOnboardingFormUrlOrEmpty: () => '',
  sendSaasSubscriptionConfirmationEmail: vi.fn(),
  sendSaasSubscriptionInternalNotificationEmail: vi.fn(),
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

function signedRequest(body: object, opts?: { signatureOk?: boolean; reason?: string }) {
  const raw = JSON.stringify(body);
  if (opts?.signatureOk === false) {
    verifyStripeWebhookSignature.mockReturnValue({
      ok: false,
      reason: opts.reason ?? 'timestamp_out_of_tolerance',
    });
  } else {
    verifyStripeWebhookSignature.mockReturnValue({ ok: true });
  }
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

describe('POST /api/shop/webhook replay hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: true });
    markStripeWebhookStatus.mockResolvedValue(undefined);
    recordStripeWebhookReceived.mockResolvedValue({
      alreadyFinalized: false,
      previousStatus: null,
    });
    updateMany.mockResolvedValue({ count: 1 });
    countShops.mockResolvedValue(1);
  });

  it('returns 400 with generic body when signature is out of tolerance', async () => {
    const res = await POST(
      signedRequest(
        { id: 'evt_stale', type: 'ping', created: 1, data: { object: { id: 'obj' } } },
        { signatureOk: false, reason: 'timestamp_out_of_tolerance' },
      ) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid signature');
    expect(body).not.toHaveProperty('reason');
    expect(notifyOpsDurable).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: 'webhook:replay-rejected' }),
    );
    expect(recordStripeWebhookReceived).not.toHaveBeenCalled();
  });

  it('skips handlers for already PROCESSED events', async () => {
    recordStripeWebhookReceived.mockResolvedValue({
      alreadyFinalized: true,
      previousStatus: 'PROCESSED',
    });

    const res = await POST(
      signedRequest({
        id: 'evt_done',
        type: 'invoice.payment_failed',
        created: Math.floor(Date.now() / 1000),
        data: { object: { id: 'in_1', object: 'invoice', subscription: 'sub_1' } },
      }) as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, duplicate: true });
    expect(applyInvoicePaymentFailed).not.toHaveBeenCalled();
    expect(markStripeWebhookStatus).not.toHaveBeenCalled();
  });

  it('ignores stale account.updated without writing Connect flags', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    countShops.mockResolvedValue(1);

    const created = Math.floor(Date.UTC(2026, 0, 1) / 1000);
    const res = await POST(
      signedRequest({
        id: 'evt_acct_old',
        type: 'account.updated',
        created,
        account: 'acct_shop',
        data: {
          object: {
            id: 'acct_shop',
            charges_enabled: false,
            details_submitted: false,
          },
        },
      }) as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBe('stale_event');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stripeConnectAccountId: 'acct_shop',
          OR: expect.any(Array),
        }),
      }),
    );
  });
});
