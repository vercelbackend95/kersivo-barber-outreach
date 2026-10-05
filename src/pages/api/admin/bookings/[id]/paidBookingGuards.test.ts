import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

/**
 * Phase 4C: no admin endpoint may cancel / no-show a paid booking while bypassing the payment
 * settlement policy, and FULL bookings may only switch to a same-price service.
 */

const requireAdminContext = vi.fn();
const bookingFindFirst = vi.fn();
const bookingUpdate = vi.fn();
const shopSettingsFindUniqueOrThrow = vi.fn();
const barberServiceFindUnique = vi.fn();
const transaction = vi.fn();
const findShopService = vi.fn();
const findShopBarber = vi.fn();
const markNoShowWithPaymentSettlement = vi.fn();
const forfeitBookingDeposit = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: () => null,
  accessCan: (access: { role: string }) => access.role !== 'BARBER',
}));

vi.mock('@/lib/admin/rbac/scope', () => ({
  assertBookingAccessible: async () => null,
}));

vi.mock('@/lib/admin/shopScoped', () => ({
  bookingWhereForShop: (id: string, shopId: string) => ({ id, barber: { shopId } }),
  findShopService: (...args: unknown[]) => findShopService(...args),
  findShopBarber: (...args: unknown[]) => findShopBarber(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    booking: {
      findFirst: (...args: unknown[]) => bookingFindFirst(...args),
      update: (...args: unknown[]) => bookingUpdate(...args),
    },
    shopSettings: {
      findUniqueOrThrow: (...args: unknown[]) => shopSettingsFindUniqueOrThrow(...args),
    },
    barberService: {
      findUnique: (...args: unknown[]) => barberServiceFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/booking/depositMoney', () => ({
  markNoShowWithPaymentSettlement: (...args: unknown[]) => markNoShowWithPaymentSettlement(...args),
  forfeitBookingDeposit: (...args: unknown[]) => forfeitBookingDeposit(...args),
}));

import { PATCH as patchStatus } from './status';
import { POST as forceReschedule } from './force-reschedule';
import { PATCH as patchService } from './service';

const MIN = 60 * 1000;

function access(role: 'OWNER' | 'MANAGER' | 'BARBER' = 'OWNER') {
  return { shopId: 'shop_1', userId: 'u1', role, via: 'session', emailVerified: true };
}

function paidFull(overrides: Record<string, unknown> = {}) {
  return {
    id: 'book_1',
    status: BookingStatus.BOOKED,
    // Ended yesterday → history correction path.
    startAt: new Date(Date.now() - 25 * 60 * MIN),
    endAt: new Date(Date.now() - 24 * 60 * MIN),
    paymentRequired: true,
    paymentStatus: 'PAID',
    bookingPaymentType: 'FULL',
    paymentAmountPence: 3000,
    depositRefund: null,
    ...overrides,
  };
}

/** Started 10 minutes ago, ends in 20 → day-of actions. */
const dayOf = () => ({
  startAt: new Date(Date.now() - 10 * MIN),
  endAt: new Date(Date.now() + 20 * MIN),
});

function statusCtx(status: string) {
  return {
    params: { id: 'book_1' },
    request: new Request('https://kersivo.test/api/admin/bookings/book_1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  } as never;
}

function jsonCtx(path: string, method: string, body: unknown) {
  return {
    params: { id: 'book_1' },
    request: new Request(`https://kersivo.test/api/admin/bookings/book_1/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminContext.mockResolvedValue(access());
  bookingUpdate.mockImplementation(async ({ data }: { data: { status: string } }) => ({
    id: 'book_1',
    status: data.status,
    updatedAt: new Date(),
  }));
  markNoShowWithPaymentSettlement.mockImplementation(
    async ({ markNoShow }: { markNoShow: () => Promise<void> }) => {
      await markNoShow();
      return { outcome: 'pending' };
    },
  );
});

describe('status endpoint — NO_SHOW always goes through the settlement helper', () => {
  it('AN / AP: history NO_SHOW on a paid FULL booking uses the settlement policy (never retains £30)', async () => {
    bookingFindFirst.mockResolvedValue(paidFull());

    const res = await patchStatus(statusCtx('NO_SHOW'));

    expect(res.status).toBe(200);
    expect(markNoShowWithPaymentSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'book_1' }),
    );
    expect(bookingUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'NO_SHOW' } }));
    expect(forfeitBookingDeposit).not.toHaveBeenCalled();
  });

  it('AN: day-of NO_SHOW (owner and barber) also uses the settlement helper', async () => {
    for (const role of ['OWNER', 'BARBER'] as const) {
      vi.clearAllMocks();
      requireAdminContext.mockResolvedValue(access(role));
      bookingUpdate.mockResolvedValue({ id: 'book_1', status: 'NO_SHOW', updatedAt: new Date() });
      markNoShowWithPaymentSettlement.mockImplementation(
        async ({ markNoShow }: { markNoShow: () => Promise<void> }) => {
          await markNoShow();
          return { outcome: 'pending' };
        },
      );
      bookingFindFirst.mockResolvedValue(paidFull(dayOf()));

      const res = await patchStatus(statusCtx('NO_SHOW'));

      expect(res.status).toBe(200);
      expect(markNoShowWithPaymentSettlement).toHaveBeenCalledTimes(1);
      expect(forfeitBookingDeposit).not.toHaveBeenCalled();
    }
  });

  it('a paid booking that was already refunded or has a refund ledger cannot be re-settled as a no-show', async () => {
    for (const overrides of [
      { status: BookingStatus.CANCELLED_BY_CLIENT, paymentStatus: 'REFUNDED' },
      { status: BookingStatus.CANCELLED_BY_CLIENT, paymentStatus: 'PARTIALLY_REFUNDED' },
      { status: BookingStatus.CANCELLED_BY_SHOP, depositRefund: { id: 'ref_1' } },
    ]) {
      bookingFindFirst.mockResolvedValue(paidFull(overrides));
      const res = await patchStatus(statusCtx('NO_SHOW'));
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe('PAID_BOOKING_STATUS_CHANGE_REQUIRES_PAYMENT_ACTION');
    }
    expect(markNoShowWithPaymentSettlement).not.toHaveBeenCalled();
    expect(bookingUpdate).not.toHaveBeenCalled();
  });

  it('unpaid bookings keep the plain NO_SHOW behaviour', async () => {
    bookingFindFirst.mockResolvedValue(
      paidFull({ paymentRequired: false, paymentStatus: null, bookingPaymentType: 'NONE', paymentAmountPence: 0 }),
    );
    const res = await patchStatus(statusCtx('NO_SHOW'));
    expect(res.status).toBe(200);
    expect(bookingUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'NO_SHOW' } }));
  });
});

describe('status endpoint — cancel corrections never bypass settlement', () => {
  it('AO: history CANCELLED_BY_CLIENT / CANCELLED_BY_SHOP on a paid booking is rejected with a stable code', async () => {
    for (const target of ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_SHOP']) {
      for (const paymentStatus of ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED']) {
        bookingFindFirst.mockResolvedValue(paidFull({ paymentStatus }));
        const res = await patchStatus(statusCtx(target));
        expect(res.status).toBe(409);
        expect((await res.json()).code).toBe('PAID_BOOKING_STATUS_CHANGE_REQUIRES_PAYMENT_ACTION');
      }
    }
    expect(bookingUpdate).not.toHaveBeenCalled();
  });

  it('AO: day-of CANCELLED_BY_SHOP on a paid booking is rejected (use Cancel booking)', async () => {
    bookingFindFirst.mockResolvedValue(
      paidFull({ startAt: new Date(Date.now() + 3 * 60 * MIN), endAt: new Date(Date.now() + 4 * 60 * MIN) }),
    );
    const res = await patchStatus(statusCtx('CANCELLED_BY_SHOP'));
    expect(res.status).toBe(409);
    expect(bookingUpdate).not.toHaveBeenCalled();
  });

  it('cancel corrections on unpaid bookings still work', async () => {
    bookingFindFirst.mockResolvedValue(
      paidFull({ paymentRequired: false, paymentStatus: null, bookingPaymentType: 'NONE', paymentAmountPence: 0 }),
    );
    const res = await patchStatus(statusCtx('CANCELLED_BY_CLIENT'));
    expect(res.status).toBe(200);
    expect(bookingUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CANCELLED_BY_CLIENT' } }));
  });
});

describe('admin force-reschedule — FULL same-price rule', () => {
  const futureBooking = (overrides: Record<string, unknown> = {}) =>
    paidFull({
      startAt: new Date(Date.now() + 48 * 60 * MIN),
      endAt: new Date(Date.now() + 49 * 60 * MIN),
      originalStartAt: null,
      originalEndAt: null,
      barber: { id: 'barber_1' },
      service: { id: 'svc_1' },
      ...overrides,
    });
  const body = { serviceId: 'svc_2', barberId: 'barber_1', date: '2026-12-10', time: '10:00' };

  beforeEach(() => {
    shopSettingsFindUniqueOrThrow.mockResolvedValue({ id: 'shop_1', defaultBufferMinutes: 0 });
    findShopBarber.mockResolvedValue({ id: 'barber_1' });
    transaction.mockResolvedValue({ id: 'book_1', startAt: new Date(), status: BookingStatus.BOOKED });
  });

  it('AL: different price is rejected with FULL_PAYMENT_SERVICE_PRICE_CHANGE_NOT_SUPPORTED', async () => {
    for (const pricePence of [3500, 2500]) {
      bookingFindFirst.mockResolvedValue(futureBooking());
      findShopService.mockResolvedValue({ id: 'svc_2', pricePence, durationMinutes: 30, bufferMinutes: 0, name: 'X' });

      const res = await forceReschedule(jsonCtx('force-reschedule', 'POST', body));

      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe('FULL_PAYMENT_SERVICE_PRICE_CHANGE_NOT_SUPPORTED');
    }
    expect(transaction).not.toHaveBeenCalled();
  });

  it('AL: same price (and DEPOSIT bookings) may be force-rescheduled', async () => {
    bookingFindFirst.mockResolvedValue(futureBooking());
    findShopService.mockResolvedValue({ id: 'svc_2', pricePence: 3000, durationMinutes: 30, bufferMinutes: 0, name: 'X' });
    expect((await forceReschedule(jsonCtx('force-reschedule', 'POST', body))).status).toBe(200);

    bookingFindFirst.mockResolvedValue(futureBooking({ bookingPaymentType: 'DEPOSIT', paymentAmountPence: 500 }));
    findShopService.mockResolvedValue({ id: 'svc_2', pricePence: 3500, durationMinutes: 30, bufferMinutes: 0, name: 'X' });
    expect((await forceReschedule(jsonCtx('force-reschedule', 'POST', body))).status).toBe(200);
  });
});

describe('admin change-service — FULL same-price rule', () => {
  it('a paid FULL booking cannot switch to a different-price service', async () => {
    bookingFindFirst.mockResolvedValue({
      id: 'book_1',
      barberId: 'barber_1',
      startAt: new Date(Date.now() + 48 * 60 * MIN),
      endAt: new Date(Date.now() + 49 * 60 * MIN),
      status: BookingStatus.BOOKED,
      bookingPaymentType: 'FULL',
      paymentAmountPence: 3000,
      paymentStatus: 'PAID',
    });
    findShopService.mockResolvedValue({ id: 'svc_2', pricePence: 3500, durationMinutes: 30, bufferMinutes: 0, isActive: true });
    shopSettingsFindUniqueOrThrow.mockResolvedValue({ defaultBufferMinutes: 0 });

    const res = await patchService(jsonCtx('service', 'PATCH', { serviceId: 'svc_2' }));

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('FULL_PAYMENT_SERVICE_PRICE_CHANGE_NOT_SUPPORTED');
    expect(transaction).not.toHaveBeenCalled();
  });
});
