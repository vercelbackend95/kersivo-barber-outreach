import { BookingStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rescheduleByToken } from './service';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    booking: { findFirst: vi.fn() },
    shopSettings: { findUniqueOrThrow: vi.fn() },
    service: { findUniqueOrThrow: vi.fn() },
    $transaction: vi.fn()
  }
}));

vi.mock('../db/client', () => ({
  prisma: prismaMock
}));

vi.mock('../email/sender', () => ({
  sendRescheduledBookingEmail: vi.fn().mockResolvedValue(undefined),
  sendInstantBookingConfirmationEmail: vi.fn(),
  sendShopCancelledBookingEmail: vi.fn()
}));

function baseBooking(overrides: { startAt: Date }) {
  return {
    id: 'booking-1',
    status: BookingStatus.BOOKED,
    email: 'c@example.com',
    fullName: 'Client',
    originalStartAt: null,
    originalEndAt: null,
    clientRescheduleCount: 0,
    barber: { id: 'barber-1', name: 'Barber', shopId: 'shop-1' },
    service: { id: 'svc-1', name: 'Cut' },
    ...overrides
  };
}

const activeService = {
  id: 'svc-1',
  shopId: 'shop-1',
  name: 'Cut',
  isActive: true,
  durationMinutes: 30,
  bufferMinutes: 0,
  pricePence: 2000
};

const shopSettings = {
  id: 'shop-1',
  name: 'Shop',
  rescheduleWindowHours: 24,
  cancellationWindowHours: 2,
  defaultBufferMinutes: 0,
  slotIntervalMinutes: 15,
  timezone: 'Europe/London'
};

describe('rescheduleByToken', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('throws BookingActionError when reschedule window has passed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));

    prismaMock.booking.findFirst.mockResolvedValue(
      baseBooking({
        startAt: new Date('2026-04-08T14:00:00.000Z')
      })
    );
    prismaMock.service.findUniqueOrThrow.mockResolvedValue(activeService as never);
    prismaMock.shopSettings.findUniqueOrThrow.mockResolvedValue(shopSettings as never);

    await expect(
      rescheduleByToken({
        token: 'test-token',
        serviceId: 'svc-1',
        barberId: 'barber-1',
        date: '2026-04-10',
        time: '10:00'
      })
    ).rejects.toMatchObject({
      name: 'BookingActionError',
      message: 'Reschedule window has passed.',
      statusCode: 409
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('throws when selected service is inactive', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));

    prismaMock.booking.findFirst.mockResolvedValue(
      baseBooking({
        startAt: new Date('2026-04-15T14:00:00.000Z')
      })
    );
    prismaMock.service.findUniqueOrThrow.mockResolvedValue({
      ...activeService,
      isActive: false
    } as never);
    prismaMock.shopSettings.findUniqueOrThrow.mockResolvedValue({
      ...shopSettings,
      rescheduleWindowHours: 2
    } as never);

    await expect(
      rescheduleByToken({
        token: 'test-token',
        serviceId: 'svc-1',
        barberId: 'barber-1',
        date: '2026-04-10',
        time: '10:00'
      })
    ).rejects.toThrow('Selected service is unavailable for new bookings.');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
