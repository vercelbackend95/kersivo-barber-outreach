import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminContext = vi.fn();
const requireAnyPermission = vi.fn();
const assertBookingAccessible = vi.fn();
const retryDepositRefundForOperator = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: (...args: unknown[]) => requireAnyPermission(...args),
}));

vi.mock('@/lib/admin/rbac/scope', () => ({
  assertBookingAccessible: (...args: unknown[]) => assertBookingAccessible(...args),
}));

vi.mock('@/lib/booking/depositMoney', () => ({
  retryDepositRefundForOperator: (...args: unknown[]) => retryDepositRefundForOperator(...args),
}));

import { POST } from './refund-retry';

function ctx(bookingId = 'book_1') {
  return {
    params: { id: bookingId },
    request: new Request('https://kersivo.test/api/admin/bookings/book_1/refund-retry', {
      method: 'POST',
    }),
  } as never;
}

describe('POST /api/admin/bookings/[id]/refund-retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue({
      shopId: 'shop_1',
      role: 'OWNER',
      permissions: ['bookings.manage'],
    });
    requireAnyPermission.mockReturnValue(null);
    assertBookingAccessible.mockResolvedValue({ id: 'book_1' });
    retryDepositRefundForOperator.mockResolvedValue({
      outcome: 'refunded',
      refund: {
        id: 'ref_1',
        status: 'REFUNDED',
        amountPence: 500,
        stripeRefundId: 're_1',
        attempts: 1,
        lastError: null,
      },
    });
  });

  it('allows owner/manager with bookings.manage', async () => {
    const response = await POST(ctx());
    expect(response.status).toBe(200);
    expect(requireAnyPermission).toHaveBeenCalledWith(
      expect.anything(),
      ['bookings.manage'],
    );
    expect(retryDepositRefundForOperator).toHaveBeenCalledWith('book_1');
  });

  it('blocks barber (bookings.self only) with 403', async () => {
    requireAnyPermission.mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    );

    const response = await POST(ctx());
    expect(response.status).toBe(403);
    expect(retryDepositRefundForOperator).not.toHaveBeenCalled();
  });

  it('blocks cross-shop booking via assertBookingAccessible', async () => {
    assertBookingAccessible.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
    );

    const response = await POST(ctx('book_other'));
    expect(response.status).toBe(404);
    expect(retryDepositRefundForOperator).not.toHaveBeenCalled();
  });
});
