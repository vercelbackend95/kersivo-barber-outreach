import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailOutboundPurpose, Prisma } from '@prisma/client';

const transaction = vi.fn();
const orderCreate = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();
const lockShopCustomerIdentity = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/db/customerIdentityLock', () => ({
  lockShopCustomerIdentity: (...args: unknown[]) => lockShopCustomerIdentity(...args),
}));

vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
}));

import { createRetailReservation } from './createRetailReservation';

const input = {
  shopId: 'shop_1',
  shopName: 'Fade Room',
  contact: {
    customerName: 'Sam <b>Client</b>',
    customerEmail: 'sam@example.com',
    customerPhone: '07700 900123',
  },
  cart: [
    { productId: 'prod_1', name: 'Clay', unitPricePence: 1500, quantity: 2, lineTotalPence: 3000 },
  ],
  totalPence: 3000,
};

describe('createRetailReservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ order: { create: (...args: unknown[]) => orderCreate(...args) } }),
    );
    orderCreate.mockImplementation(async (args: { data: { reference: string } }) => ({
      id: 'ord_res',
      reference: args.data.reference,
      customerEmail: 'sam@example.com',
      totalPence: 3000,
    }));
    enqueueEmail.mockResolvedValue({ id: 'out_1' });
    tryDeliverOutboxEmail.mockResolvedValue(undefined);
    lockShopCustomerIdentity.mockResolvedValue(undefined);
  });

  it('creates an unpaid reservation with contact details and no Stripe or Connect data', async () => {
    const result = await createRetailReservation(input);

    expect(result.id).toBe('ord_res');
    expect(result.reference).toMatch(/^KRV-[A-Z0-9]{6}$/);
    expect(lockShopCustomerIdentity).toHaveBeenCalledWith(expect.anything(), 'shop_1', 'sam@example.com');

    const data = orderCreate.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      shopId: 'shop_1',
      customerEmail: 'sam@example.com',
      customerName: 'Sam <b>Client</b>',
      customerPhone: '07700 900123',
      status: 'RESERVED_UNPAID',
      totalPence: 3000,
      paidAt: null,
      isTestOrder: false,
    });
    expect(data).not.toHaveProperty('stripeSessionId');
    expect(data).not.toHaveProperty('stripeConnectAccountId');
    expect(data.items.create).toEqual([
      {
        productId: 'prod_1',
        nameSnapshot: 'Clay',
        unitPricePenceSnapshot: 1500,
        quantity: 2,
        lineTotalPence: 3000,
      },
    ]);
  });

  it('enqueues the reservation email in the transaction, escaped, then delivers it', async () => {
    await createRetailReservation(input);

    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        shopId: 'shop_1',
        bookingId: null,
        purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
        to: 'sam@example.com',
        subject: expect.stringContaining('pay when you collect at Fade Room'),
      }),
    );
    const html = enqueueEmail.mock.calls[0]![1].html as string;
    expect(html).toContain('Nothing has been paid yet');
    expect(html).toContain('Sam &lt;b&gt;Client&lt;/b&gt;');
    expect(html).not.toContain('<b>Client</b>');
    expect(html).toContain('Total to pay on collection:</strong> £30.00');
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith('out_1');
  });

  it('retries with a new reference when the reference collides', async () => {
    const collision = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['reference'] },
    });
    orderCreate.mockRejectedValueOnce(collision);

    const result = await createRetailReservation(input);

    expect(orderCreate).toHaveBeenCalledTimes(2);
    expect(result.id).toBe('ord_res');
  });

  it('does not swallow other database errors', async () => {
    orderCreate.mockRejectedValueOnce(new Error('db down'));
    await expect(createRetailReservation(input)).rejects.toThrow('db down');
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();
  });
});
