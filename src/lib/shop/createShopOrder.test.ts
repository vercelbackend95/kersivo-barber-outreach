import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailOutboundPurpose } from '@prisma/client';

const transaction = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();
const buildShopOrderConfirmationEmail = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/email/sender', () => ({
  buildShopOrderConfirmationEmail: (...args: unknown[]) => buildShopOrderConfirmationEmail(...args),
}));

vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
}));

import { createShopOrder } from './createShopOrder';

describe('createShopOrder email outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildShopOrderConfirmationEmail.mockReturnValue({
      subject: 'Order confirmed — pick up in store',
      html: '<p>thanks</p>',
    });
    enqueueEmail.mockResolvedValue({ id: 'out_order_1' });
    tryDeliverOutboxEmail.mockResolvedValue(undefined);
  });

  it('enqueues confirmation in the same transaction and does not throw when deliver fails', async () => {
    const order = {
      id: 'ord_1',
      shopId: 'shop_1',
      customerEmail: 'buyer@example.com',
      status: 'PAID' as const,
      totalPence: 1500,
      isTestOrder: false,
      paidAt: new Date(),
      items: [
        {
          productId: 'p1',
          nameSnapshot: 'Pomade',
          unitPricePenceSnapshot: 1500,
          quantity: 1,
          lineTotalPence: 1500,
        },
      ],
    };

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        order: {
          create: vi.fn().mockResolvedValue(order),
        },
      };
      return fn(tx);
    });

    const result = await createShopOrder({
      shopId: 'shop_1',
      customerEmail: 'buyer@example.com',
      totalPence: 1500,
      cart: [
        {
          productId: 'p1',
          name: 'Pomade',
          unitPricePence: 1500,
          quantity: 1,
          lineTotalPence: 1500,
        },
      ],
    });

    expect(result.id).toBe('ord_1');
    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        shopId: 'shop_1',
        purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
        to: 'buyer@example.com',
      }),
    );
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith('out_order_1');
  });

  it('skips email enqueue for test orders', async () => {
    const order = {
      id: 'ord_test',
      shopId: 'shop_1',
      customerEmail: 'buyer@example.com',
      status: 'PAID' as const,
      totalPence: 1500,
      isTestOrder: true,
      paidAt: new Date(),
      items: [],
    };
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { order: { create: vi.fn().mockResolvedValue(order) } };
      return fn(tx);
    });

    await createShopOrder({
      shopId: 'shop_1',
      customerEmail: 'buyer@example.com',
      totalPence: 1500,
      isTestOrder: true,
      cart: [
        {
          productId: 'p1',
          name: 'Pomade',
          unitPricePence: 1500,
          quantity: 1,
          lineTotalPence: 1500,
        },
      ],
    });

    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith(null);
  });
});
