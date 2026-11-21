import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminPermissionAndCapability = vi.fn();
const orderFindFirst = vi.fn();
const orderUpdateMany = vi.fn();
const shopFindUnique = vi.fn();
const shopUpdate = vi.fn();

vi.mock('@/lib/admin/productCapability', () => ({
  requireAdminPermissionAndCapability: (...args: unknown[]) => requireAdminPermissionAndCapability(...args),
}));

vi.mock('../../../../../../lib/db/client', () => ({
  prisma: {
    order: {
      findFirst: (...args: unknown[]) => orderFindFirst(...args),
      updateMany: (...args: unknown[]) => orderUpdateMany(...args),
    },
    shopSettings: {
      findUnique: (...args: unknown[]) => shopFindUnique(...args),
      update: (...args: unknown[]) => shopUpdate(...args),
    },
  },
}));

import { POST } from './collect';

function call(body?: unknown) {
  return POST({
    params: { id: 'ord_1' },
    request: new Request('http://localhost/api/admin/shop/orders/ord_1/collect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  } as never);
}

describe('POST /api/admin/shop/orders/[id]/collect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermissionAndCapability.mockResolvedValue({ shopId: 'shop_1' });
    orderUpdateMany.mockResolvedValue({ count: 1 });
    shopFindUnique.mockResolvedValue({ retailTestOrderId: null, retailPickupWalkthroughCompletedAt: null });
  });

  function orderWithStatus(status: string) {
    orderFindFirst
      .mockResolvedValueOnce({ id: 'ord_1', status, isTestOrder: false })
      .mockResolvedValueOnce({ id: 'ord_1', status: 'COLLECTED', isTestOrder: false });
  }

  it('collects a paid order without touching paidAt', async () => {
    orderWithStatus('PAID');
    const res = await call();
    expect(res.status).toBe(200);
    const update = orderUpdateMany.mock.calls[0]![0];
    expect(update.where).toEqual({ id: 'ord_1', shopId: 'shop_1', status: 'PAID' });
    expect(update.data.status).toBe('COLLECTED');
    expect(update.data).not.toHaveProperty('paidAt');
  });

  it('refuses to hand over an unpaid reservation unless payment was taken in the shop', async () => {
    orderFindFirst.mockResolvedValueOnce({ id: 'ord_1', status: 'RESERVED_UNPAID', isTestOrder: false });
    const res = await call({});
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('payment_not_taken');
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it('marks an unpaid reservation paid and collected so Sales counts it from now', async () => {
    orderWithStatus('RESERVED_UNPAID');
    const res = await call({ paymentTakenInShop: true });
    expect(res.status).toBe(200);
    expect((await res.json()).paymentTakenInShop).toBe(true);
    const update = orderUpdateMany.mock.calls[0]![0];
    expect(update.where).toEqual({ id: 'ord_1', shopId: 'shop_1', status: 'RESERVED_UNPAID' });
    expect(update.data.status).toBe('COLLECTED');
    expect(update.data.paidAt).toBeInstanceOf(Date);
    expect(update.data.collectedAt).toEqual(update.data.paidAt);
  });

  it('never collects an abandoned Stripe checkout', async () => {
    orderFindFirst.mockResolvedValueOnce({ id: 'ord_1', status: 'PENDING_PAYMENT', isTestOrder: false });
    const res = await call({ paymentTakenInShop: true });
    expect(res.status).toBe(400);
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it('returns 409 when the order changed between read and write', async () => {
    orderFindFirst.mockResolvedValueOnce({ id: 'ord_1', status: 'RESERVED_UNPAID', isTestOrder: false });
    orderUpdateMany.mockResolvedValueOnce({ count: 0 });
    const res = await call({ paymentTakenInShop: true });
    expect(res.status).toBe(409);
  });

  it('returns 404 for an order from another shop', async () => {
    orderFindFirst.mockResolvedValueOnce(null);
    const res = await call();
    expect(res.status).toBe(404);
  });
});
