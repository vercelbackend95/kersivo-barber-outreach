import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const { requireOperatorAccess, bookingFindMany } = vi.hoisted(() => ({
  requireOperatorAccess: vi.fn(),
  bookingFindMany: vi.fn(),
}));

vi.mock('@/lib/ops/operatorAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ops/operatorAuth')>();
  return { ...actual, requireOperatorAccess: (...args: unknown[]) => requireOperatorAccess(...args) };
});

vi.mock('@/lib/db/client', () => ({
  prisma: { booking: { findMany: (...args: unknown[]) => bookingFindMany(...args) } },
}));

import { BLACKLINE_SHOP_ID } from '@/lib/demo/products';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { GET } from './payment-analytics';

function get(query = ''): APIContext {
  const url = new URL(`https://kersivo.test/api/ops/payment-analytics${query}`);
  return { request: new Request(url), url } as unknown as APIContext;
}

const paidAt = new Date('2026-10-01T10:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  requireOperatorAccess.mockResolvedValue({ userId: 'op-1', email: 'ops@kersivo.co.uk' });
  bookingFindMany.mockResolvedValue([
    { kersivoProductStateAtBooking: 'FREE_BOOKING', bookingPaymentType: 'DEPOSIT', paymentAmountPence: 500, paidAt },
    { kersivoProductStateAtBooking: 'FREE_BOOKING', bookingPaymentType: 'FULL', paymentAmountPence: 2500, paidAt },
    { kersivoProductStateAtBooking: 'FULL_KERSIVO', bookingPaymentType: 'FULL', paymentAmountPence: 3000, paidAt },
    { kersivoProductStateAtBooking: null, bookingPaymentType: 'DEPOSIT', paymentAmountPence: 1000, paidAt },
  ]);
});

describe('GET /api/ops/payment-analytics', () => {
  it('refuses non-operators without querying bookings', async () => {
    requireOperatorAccess.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: 'FORBIDDEN' } }), { status: 403 }),
    );
    expect((await GET(get())).status).toBe(403);
    expect(bookingFindMany).not.toHaveBeenCalled();
  });

  it('summarizes paid booking volume; historical null-state rows count only globally', async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      windowDays: 30,
      metric: 'gross_online_card_payment_volume',
      globalOnlineCardVolumePence: 7000,
      starterOnlineCardVolumePence: 3000,
      fullOnlineCardVolumePence: 3000,
      starterMinimumPaymentFloorVolumePence: 1000,
      starterDepositBookingCount: 1,
      starterDepositVolumePence: 500,
      starterFullPaymentBookingCount: 1,
      starterFullPaymentVolumePence: 2500,
      starterFullPaymentTakeRate: 0.5,
    });
    expect(JSON.stringify(body)).not.toMatch(/revenue/i);
  });

  it('queries only captured Connect payments, excludes demo shops and selects no personal data', async () => {
    await GET(get('?days=90'));
    const [args] = bookingFindMany.mock.calls[0] as [{ where: Record<string, unknown>; select: Record<string, true> }];
    expect(args.where).toMatchObject({
      paidAt: { gte: expect.any(Date) },
      stripeConnectAccountIdAtPayment: { not: null },
      barber: { shopId: { notIn: [DEMO_SHOP_ID, BLACKLINE_SHOP_ID] } },
    });
    expect(Object.keys(args.select).sort()).toEqual(
      ['bookingPaymentType', 'kersivoProductStateAtBooking', 'paidAt', 'paymentAmountPence'].sort(),
    );
  });

  it('rejects an invalid window', async () => {
    expect((await GET(get('?days=0'))).status).toBe(400);
    expect((await GET(get('?days=abc'))).status).toBe(400);
  });
});
