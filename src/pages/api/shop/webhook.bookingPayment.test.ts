import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyStripeWebhookSignature = vi.fn();
const recordStripeWebhookReceived = vi.fn();
const markStripeWebhookStatus = vi.fn();
const retrieveCheckoutSession = vi.fn();
const confirmPaidBookingPayment = vi.fn();

vi.mock('../../../lib/shop/stripe', () => ({
  verifyStripeWebhookSignature: (...args: unknown[]) => verifyStripeWebhookSignature(...args),
  retrieveCheckoutSession: (...args: unknown[]) => retrieveCheckoutSession(...args),
  getCheckoutCustomerId: vi.fn(),
  getCheckoutPaymentIntentId: (session: { payment_intent?: string }) => session.payment_intent ?? null,
  getCheckoutSubscriptionId: vi.fn(),
  getSubscriptionCurrentPeriodEnd: vi.fn(),
  retrieveSubscription: vi.fn(),
}));

vi.mock('../../../lib/ops/stripeWebhookLedger', () => ({
  recordStripeWebhookReceived: (...args: unknown[]) => recordStripeWebhookReceived(...args),
  markStripeWebhookStatus: (...args: unknown[]) => markStripeWebhookStatus(...args),
  alertStripeWebhookFailure: vi.fn(),
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
    shopSettings: { updateMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    order: { findFirst: vi.fn(), updateMany: vi.fn() },
    booking: { findFirst: vi.fn(), updateMany: vi.fn() },
    saasSubscription: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
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
  confirmPaidBookingPayment: (...args: unknown[]) => confirmPaidBookingPayment(...args),
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
  periodEndFromUnixSeconds: () => null,
}));

import { POST } from './webhook';

function completedEvent(metadata: Record<string, string>) {
  const body = {
    id: `evt_${metadata.type}`,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    account: 'acct_shop',
    data: { object: { id: 'cs_book_1', object: 'checkout.session', metadata } },
  };
  return {
    request: new Request('https://kersivo.co.uk/api/shop/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=x' },
      body: JSON.stringify(body),
    }),
  };
}

function paidSession(metadata: Record<string, string>) {
  return {
    id: 'cs_book_1',
    payment_status: 'paid',
    amount_total: 500,
    currency: 'gbp',
    payment_intent: 'pi_book_1',
    metadata,
  };
}

const genericMetadata = {
  type: 'booking_payment',
  bookingId: 'book_1',
  shopId: 'shop_1',
  bookingPaymentType: 'DEPOSIT',
};

const legacyMetadata = { type: 'booking_deposit', bookingId: 'book_1', shopId: 'shop_1' };

describe('POST /api/shop/webhook — booking payment sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyStripeWebhookSignature.mockReturnValue({ ok: true });
    recordStripeWebhookReceived.mockResolvedValue({ alreadyFinalized: false, previousStatus: null });
    markStripeWebhookStatus.mockResolvedValue(undefined);
  });

  it.each([
    ['generic booking_payment', genericMetadata],
    ['legacy booking_deposit (AD)', legacyMetadata],
  ])('confirms a paid %s session on the connected account', async (_label, metadata) => {
    const session = paidSession(metadata);
    retrieveCheckoutSession.mockResolvedValue(session);
    confirmPaidBookingPayment.mockResolvedValue({ outcome: 'confirmed', booking: { id: 'book_1' } });

    const res = await POST(completedEvent(metadata) as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, bookingId: 'book_1', outcome: 'confirmed' });
    expect(retrieveCheckoutSession).toHaveBeenCalledWith('cs_book_1', { stripeAccount: 'acct_shop' });
    expect(confirmPaidBookingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'book_1',
        shopId: 'shop_1',
        sessionId: 'cs_book_1',
        paymentIntentId: 'pi_book_1',
        session,
      }),
    );
  });

  it('acknowledges amount_mismatch without confirming (alert raised in domain layer)', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession(genericMetadata));
    confirmPaidBookingPayment.mockResolvedValue({ outcome: 'amount_mismatch', booking: { id: 'book_1' } });

    const res = await POST(completedEvent(genericMetadata) as never);

    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe('amount_mismatch');
  });

  it('returns 400 for a session that does not belong to the booking', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession(genericMetadata));
    confirmPaidBookingPayment.mockResolvedValue({ outcome: 'invalid_session' });

    const res = await POST(completedEvent(genericMetadata) as never);

    expect(res.status).toBe(400);
  });

  it('rejects unpaid booking payment sessions without confirming', async () => {
    retrieveCheckoutSession.mockResolvedValue({ ...paidSession(genericMetadata), payment_status: 'unpaid' });

    const res = await POST(completedEvent(genericMetadata) as never);

    expect(res.status).toBe(400);
    expect(confirmPaidBookingPayment).not.toHaveBeenCalled();
  });
});
