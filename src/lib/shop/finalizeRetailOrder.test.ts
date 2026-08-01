import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
const updateMany = vi.fn();
const transaction = vi.fn();
const notifyOpsDurable = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    order: { findFirst: (...args: unknown[]) => findFirst(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/ops/stripeWebhookLedger', () => ({
  notifyOpsDurable: (...args: unknown[]) => notifyOpsDurable(...args),
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
        order: { updateMany: (...args: unknown[]) => updateMany(...args) },
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
    expect(notifyOpsDurable).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'critical',
        dedupeKey: 'retail_amount_mismatch:ord_1',
      }),
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
