import { BookingStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rescheduleByToken } from './service';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    booking: { findFirst: vi.fn() },
    shopSettings: { findFirstOrThrow: vi.fn() },
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
    barber: { id: 'barber-1', name: 'Barber' },
    service: { id: 'svc-1', name: 'Cut' },
    ...overrides
  };
}

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
    prismaMock.shopSettings.findFirstOrThrow.mockResolvedValue({
      id: 'shop-1',
      name: 'Shop',
      rescheduleWindowHours: 24,
      cancellationWindowHours: 2,
      defaultBufferMinutes: 0,
      slotIntervalMinutes: 15,
      timezone: 'Europe/London'
    } as never);

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

    expect(prismaMock.service.findUniqueOrThrow).not.toHaveBeenCalled();
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
    prismaMock.shopSettings.findFirstOrThrow.mockResolvedValue({
      id: 'shop-1',
      name: 'Shop',
      rescheduleWindowHours: 2,
      cancellationWindowHours: 2,
      defaultBufferMinutes: 0,
      slotIntervalMinutes: 15,
      timezone: 'Europe/London'
    } as never);
    prismaMock.service.findUniqueOrThrow.mockResolvedValue({
      id: 'svc-1',
      name: 'Cut',
      isActive: false,
      durationMinutes: 30,
      bufferMinutes: 0,
      pricePence: 2000
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
