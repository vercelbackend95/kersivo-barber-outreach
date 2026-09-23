import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
const updateMany = vi.fn();
const transaction = vi.fn();
const captureOpsMessage = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();
const lockShopCustomerIdentity = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    order: { findFirst: (...args: unknown[]) => findFirst(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/db/customerIdentityLock', () => ({
  lockShopCustomerIdentity: (...args: unknown[]) => lockShopCustomerIdentity(...args),
}));

vi.mock('@/lib/ops/sentry', () => ({
  captureOpsMessage: (...args: unknown[]) => captureOpsMessage(...args),
}));

vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
}));

vi.mock('@/lib/email/sender', () => ({
  buildShopOrderConfirmationEmail: () => ({
    subject: 'Order confirmed',
    html: '<p>ok</p>',
  }),
}));

vi.mock('@/lib/db/shopScope', () => ({
  DEMO_SHOP_ID: 'demo',
}));

import { finalizeRetailOrderFromCheckout } from './finalizeRetailOrder';

describe('finalizeRetailOrderFromCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockShopCustomerIdentity.mockResolvedValue(undefined);
    findFirst.mockResolvedValue({
      id: 'ord_1',
      status: 'PENDING_PAYMENT',
      totalPence: 1200,
      customerEmail: 'pending@checkout.kersivo.local',
      reference: 'KRV-ABC123',
      shop: { name: 'Fade Room' },
      items: [{ nameSnapshot: 'Clay', quantity: 1, lineTotalPence: 1200 }],
    });
    updateMany.mockResolvedValue({ count: 1 });
    enqueueEmail.mockResolvedValue({ id: 'out_1' });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        order: {
          findFirst: vi.fn().mockResolvedValue({
            customerEmail: 'pending@checkout.kersivo.local',
            status: 'PENDING_PAYMENT',
          }),
          updateMany: (...args: unknown[]) => updateMany(...args),
        },
      }),
    );
  });

  it('CAS PENDING_PAYMENT → PAID and delivers confirmation email', async () => {
    const result = await finalizeRetailOrderFromCheckout({
      orderId: 'ord_1',
      shopId: 'shop_1',
      sessionId: 'cs_1',
      paymentIntentId: 'pi_1',
      amountTotal: 1200,
      customerEmail: 'client@example.com',
      paidAt: new Date('2026-08-01T12:00:00.000Z'),
    });

    expect(result).toEqual({ outcome: 'confirmed', orderId: 'ord_1' });
    expect(lockShopCustomerIdentity).toHaveBeenCalledWith(
      expect.anything(),
      'shop_1',
      'client@example.com',
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ord_1', shopId: 'shop_1', status: 'PENDING_PAYMENT' },
      data: expect.objectContaining({
        status: 'PAID',
        customerEmail: 'client@example.com',
        stripeSessionId: 'cs_1',
        stripePaymentIntentId: 'pi_1',
      }),
    });
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith('out_1');
  });

  it('preserves anonymised @example.invalid email after Client erasure', async () => {
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        order: {
          findFirst: vi.fn().mockResolvedValue({
            customerEmail: 'erased+ord_1@example.invalid',
            status: 'PENDING_PAYMENT',
          }),
          updateMany: (...args: unknown[]) => updateMany(...args),
        },
      }),
    );

    const result = await finalizeRetailOrderFromCheckout({
      orderId: 'ord_1',
      shopId: 'shop_1',
      sessionId: 'cs_1',
      paymentIntentId: 'pi_1',
      amountTotal: 1200,
      customerEmail: 'client@example.com',
      paidAt: new Date('2026-08-01T12:00:00.000Z'),
    });

    expect(result).toEqual({ outcome: 'confirmed', orderId: 'ord_1' });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PAID',
          customerEmail: 'erased+ord_1@example.invalid',
        }),
      }),
    );
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('returns duplicate when order is already paid', async () => {
    findFirst.mockResolvedValueOnce({
      id: 'ord_1',
      status: 'PAID',
      totalPence: 1200,
      customerEmail: 'client@example.com',
      reference: 'KRV-ABC123',
      shop: { name: 'Fade Room' },
      items: [],
    });

    const result = await finalizeRetailOrderFromCheckout({
      orderId: 'ord_1',
      shopId: 'shop_1',
      sessionId: 'cs_1',
      paymentIntentId: 'pi_1',
      amountTotal: 1200,
      customerEmail: 'client@example.com',
      paidAt: new Date(),
    });

    expect(result).toEqual({ outcome: 'duplicate', orderId: 'ord_1' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('alerts ops and rejects amount mismatches', async () => {
    const result = await finalizeRetailOrderFromCheckout({
      orderId: 'ord_1',
      shopId: 'shop_1',
      sessionId: 'cs_1',
      paymentIntentId: 'pi_1',
      amountTotal: 9999,
      customerEmail: 'client@example.com',
      paidAt: new Date(),
    });

    expect(result).toEqual({ outcome: 'amount_mismatch' });
    expect(captureOpsMessage).toHaveBeenCalledWith(
      'Retail order amount mismatch',
      expect.objectContaining({
        level: 'error',
        shopId: 'shop_1',
        tags: expect.objectContaining({ orderId: 'ord_1', sessionId: 'cs_1' }),
      }),
    );
    expect(JSON.stringify(captureOpsMessage.mock.calls)).not.toMatch(/@|client@example/);
    expect(transaction).not.toHaveBeenCalled();
  });
});
