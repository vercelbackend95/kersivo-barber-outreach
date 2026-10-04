import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyStripeWebhookSignature = vi.fn();
const recordStripeWebhookReceived = vi.fn();
const markStripeWebhookStatus = vi.fn();
const retrieveCheckoutSession = vi.fn();
const confirmPaidBookingPayment = vi.fn();
const findFirstBooking = vi.fn();
const findUniqueShop = vi.fn();
const confirmBookingPaymentRefundFromWebhook = vi.fn();

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
    shopSettings: {
      updateMany: vi.fn(),
      count: vi.fn(),
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
    },
    order: { findFirst: vi.fn(), updateMany: vi.fn() },
    booking: { findFirst: (...args: unknown[]) => findFirstBooking(...args), updateMany: vi.fn() },
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
  confirmBookingPaymentRefundFromWebhook: (...args: unknown[]) => confirmBookingPaymentRefundFromWebhook(...args),
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

function completedEvent(metadata: Record<string, string>, account: string | null = 'acct_shop') {
  const body = {
    id: `evt_${metadata.type}`,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    ...(account ? { account } : {}),
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
        stripeAccountId: 'acct_shop',
      }),
    );
  });

  it('O: event.account is passed through as the processing account for verification', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession(genericMetadata));
    confirmPaidBookingPayment.mockResolvedValue({ outcome: 'confirmed', booking: { id: 'book_1' } });

    const res = await POST(completedEvent(genericMetadata, 'acct_original') as never);

    expect(res.status).toBe(200);
    expect(retrieveCheckoutSession).toHaveBeenCalledWith('cs_book_1', { stripeAccount: 'acct_original' });
    expect(confirmPaidBookingPayment).toHaveBeenCalledWith(
      expect.objectContaining({ stripeAccountId: 'acct_original' }),
    );
    expect(findFirstBooking).not.toHaveBeenCalled();
  });

  it('P: account mismatch is acknowledged without confirming (ops alert raised in domain)', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession(genericMetadata));
    confirmPaidBookingPayment.mockResolvedValue({ outcome: 'account_mismatch', booking: { id: 'book_1' } });

    const res = await POST(completedEvent(genericMetadata, 'acct_other') as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, bookingId: 'book_1', outcome: 'account_mismatch' });
  });

  it('without event.account the Booking snapshot wins over the current shop account', async () => {
    findFirstBooking.mockResolvedValue({
      stripeConnectAccountIdAtPayment: 'acct_original',
      kersivoPlatformFeePence: 5,
    });
    findUniqueShop.mockResolvedValue({ stripeConnectAccountId: 'acct_new' });
    retrieveCheckoutSession.mockResolvedValue(paidSession(genericMetadata));
    confirmPaidBookingPayment.mockResolvedValue({ outcome: 'confirmed', booking: { id: 'book_1' } });

    await POST(completedEvent(genericMetadata, null) as never);

    expect(findFirstBooking).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'book_1', barber: { shopId: 'shop_1' } } }),
    );
    expect(retrieveCheckoutSession).toHaveBeenCalledWith('cs_book_1', { stripeAccount: 'acct_original' });
    expect(confirmPaidBookingPayment).toHaveBeenCalledWith(
      expect.objectContaining({ stripeAccountId: 'acct_original' }),
    );
  });

  it('Q: without event.account a legacy null-snapshot booking falls back to the shop account', async () => {
    findFirstBooking.mockResolvedValue({ stripeConnectAccountIdAtPayment: null, kersivoPlatformFeePence: 0 });
    findUniqueShop.mockResolvedValue({ stripeConnectAccountId: 'acct_current' });
    retrieveCheckoutSession.mockResolvedValue(paidSession(legacyMetadata));
    confirmPaidBookingPayment.mockResolvedValue({ outcome: 'confirmed', booking: { id: 'book_1' } });

    await POST(completedEvent(legacyMetadata, null) as never);

    expect(retrieveCheckoutSession).toHaveBeenCalledWith('cs_book_1', { stripeAccount: 'acct_current' });
  });

  it('without event.account a fee-bearing booking lacking a snapshot is rejected, not guessed', async () => {
    findFirstBooking.mockResolvedValue({ stripeConnectAccountIdAtPayment: null, kersivoPlatformFeePence: 5 });
    findUniqueShop.mockResolvedValue({ stripeConnectAccountId: 'acct_current' });

    const res = await POST(completedEvent(genericMetadata, null) as never);

    expect(res.status).toBe(400);
    expect(retrieveCheckoutSession).not.toHaveBeenCalled();
    expect(confirmPaidBookingPayment).not.toHaveBeenCalled();
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

function refundEvent(type: string, object: Record<string, unknown>, account: string | null = 'acct_A') {
  const body = {
    id: `evt_${type}_${String(object.id)}`,
    type,
    created: Math.floor(Date.now() / 1000),
    ...(account ? { account } : {}),
    data: { object },
  };
  return {
    request: new Request('https://kersivo.co.uk/api/shop/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=x' },
      body: JSON.stringify(body),
    }),
  };
}

describe('POST /api/shop/webhook � booking refund correlation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyStripeWebhookSignature.mockReturnValue({ ok: true });
    recordStripeWebhookReceived.mockResolvedValue({ alreadyFinalized: false, previousStatus: null });
    markStripeWebhookStatus.mockResolvedValue(undefined);
  });

  it.each(['refund.updated', 'refund.failed'])('%s passes event.account, refund id and amount (never metadata)', async (type) => {
    confirmBookingPaymentRefundFromWebhook.mockResolvedValue({ matched: false, refund: null });

    const res = await POST(
      refundEvent(type, {
        id: 're_A',
        object: 'refund',
        status: type === 'refund.failed' ? 'failed' : 'succeeded',
        amount: 2500,
        payment_intent: 'pi_1',
        metadata: { stripeAccountId: 'acct_spoofed' },
      }) as never,
    );

    expect(res.status).toBe(200);
    expect(confirmBookingPaymentRefundFromWebhook).toHaveBeenCalledWith({
      stripeRefundId: 're_A',
      paymentIntentId: 'pi_1',
      status: type === 'refund.failed' ? 'failed' : 'succeeded',
      amountPence: 2500,
      stripeAccountId: 'acct_A',
    });
  });

  it('a missing event.account is passed as null', async () => {
    confirmBookingPaymentRefundFromWebhook.mockResolvedValue({ matched: false, refund: null });
    await POST(
      refundEvent('refund.updated', { id: 're_A', object: 'refund', status: 'succeeded', amount: 500 }, null) as never,
    );
    expect(confirmBookingPaymentRefundFromWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ stripeAccountId: null }),
    );
  });

  it('integrity mismatch is acknowledged with 200 and no sensitive ids', async () => {
    confirmBookingPaymentRefundFromWebhook.mockResolvedValue({
      matched: true,
      confirmed: false,
      reason: 'refund_integrity_mismatch',
      refund: { id: 'ledger_1', bookingId: 'book_1', status: 'REFUND_PENDING', connectAccountId: 'acct_A' },
    });

    const res = await POST(
      refundEvent('refund.updated', { id: 're_B', object: 'refund', status: 'succeeded', amount: 500 }, 'acct_B') as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      matched: true,
      confirmed: false,
      reason: 'refund_integrity_mismatch',
      status: 'REFUND_PENDING',
    });
    expect(JSON.stringify(body)).not.toMatch(/acct_|re_|book_1|ledger_1/);
  });

  it('charge.refunded only correlates individual refund ids via stored ledger ids, never amount_refunded', async () => {
    confirmBookingPaymentRefundFromWebhook
      .mockResolvedValueOnce({ matched: false, refund: null })
      .mockResolvedValueOnce({ matched: true, confirmed: true, refund: { id: 'ledger_1', status: 'REFUNDED' } });

    const res = await POST(
      refundEvent('charge.refunded', {
        id: 'ch_1',
        object: 'charge',
        payment_intent: 'pi_1',
        amount_refunded: 3000,
        refunds: {
          data: [
            { id: 're_manual', status: 'succeeded', amount: 500 },
            { id: 're_ours', status: 'succeeded', amount: 2500 },
          ],
        },
      }) as never,
    );

    expect(res.status).toBe(200);
    expect(confirmBookingPaymentRefundFromWebhook).toHaveBeenCalledTimes(2);
    expect(confirmBookingPaymentRefundFromWebhook).toHaveBeenNthCalledWith(1, {
      stripeRefundId: 're_manual',
      paymentIntentId: 'pi_1',
      status: 'succeeded',
      amountPence: 500,
      stripeAccountId: 'acct_A',
      requireStoredRefundId: true,
    });
    expect(confirmBookingPaymentRefundFromWebhook).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ stripeRefundId: 're_ours', amountPence: 2500, requireStoredRefundId: true }),
    );
    for (const [input] of confirmBookingPaymentRefundFromWebhook.mock.calls) {
      expect((input as { amountPence: number }).amountPence).not.toBe(3000);
    }
    expect((await res.json()).confirmed).toBe(true);
  });

  it('charge.refunded without identifiable refunds leaves the ledger untouched', async () => {
    const res = await POST(
      refundEvent('charge.refunded', { id: 'ch_1', object: 'charge', payment_intent: 'pi_1', amount_refunded: 2500 }) as never,
    );
    expect(res.status).toBe(200);
    expect(confirmBookingPaymentRefundFromWebhook).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ matched: false, confirmed: false });
  });
});
