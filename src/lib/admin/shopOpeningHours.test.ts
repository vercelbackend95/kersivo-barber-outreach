import { describe, expect, it } from 'vitest';
import {
  assertBarberHoursWithinShop,
  DEFAULT_ONBOARDING_HOURS,
  intersectMinutesWithShopDay,
  type OnboardingWeeklyRule,
  type ShopHoursDay,
} from './shopOpeningHours';
import { ALL_WEEKDAYS } from '@/lib/booking/weekdays';

function day(
  dayOfWeek: number,
  active: boolean,
  startTime = '09:00',
  endTime = '18:00',
): OnboardingWeeklyRule {
  return { dayOfWeek, active, startTime, endTime };
}

describe('assertBarberHoursWithinShop', () => {
  const shopMonFri = DEFAULT_ONBOARDING_HOURS.map((row) => ({ ...row }));

  it('allows barber hours fully inside shop hours', () => {
    const barber = shopMonFri.map((row) =>
      row.active
        ? {
            ...row,
            startTime: '10:00',
            // Saturday (6) closes at 16:00 in defaults
            endTime: row.dayOfWeek === 6 ? '15:00' : '17:00',
          }
        : { ...row },
    );
    expect(assertBarberHoursWithinShop(shopMonFri, barber)).toBeNull();
  });

  it('rejects barber open on a shop-closed day', () => {
    // Sunday = 7 is closed in defaults (Mon=1…Sun=7)
    const barber = ALL_WEEKDAYS.map((dayOfWeek) => day(dayOfWeek, dayOfWeek === 7, '10:00', '14:00'));
    expect(assertBarberHoursWithinShop(shopMonFri, barber)).toMatch(/Day 7/);
  });

  it('rejects barber start before shop open', () => {
    const barber = shopMonFri.map((row) =>
      row.dayOfWeek === 2 ? { ...row, startTime: '08:00', endTime: '17:00' } : { ...row, active: false },
    );
    expect(assertBarberHoursWithinShop(shopMonFri, barber)).toMatch(/Day 2/);
  });

  it('rejects barber end after shop close', () => {
    const barber = shopMonFri.map((row) =>
      row.dayOfWeek === 2 ? { ...row, startTime: '09:00', endTime: '19:00' } : { ...row, active: false },
    );
    expect(assertBarberHoursWithinShop(shopMonFri, barber)).toMatch(/Day 2/);
  });

  it('allows inactive barber days even when shop is closed', () => {
    const barber = ALL_WEEKDAYS.map((dayOfWeek) => day(dayOfWeek, false));
    expect(assertBarberHoursWithinShop(shopMonFri, barber)).toBeNull();
  });
});

describe('intersectMinutesWithShopDay', () => {
  const shop: ShopHoursDay = {
    dayOfWeek: 2,
    active: true,
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  };

  it('returns null when shop is closed', () => {
    expect(intersectMinutesWithShopDay(undefined, 9 * 60, 17 * 60)).toBeNull();
    expect(
      intersectMinutesWithShopDay({ ...shop, active: false }, 9 * 60, 17 * 60),
    ).toBeNull();
  });

  it('clips barber window to shop hours', () => {
    expect(intersectMinutesWithShopDay(shop, 8 * 60, 18 * 60)).toEqual({
      startMinutes: 9 * 60,
      endMinutes: 17 * 60,
    });
  });

  it('returns null when barber window is entirely outside shop hours', () => {
    expect(intersectMinutesWithShopDay(shop, 17 * 60, 18 * 60)).toBeNull();
    expect(intersectMinutesWithShopDay(shop, 7 * 60, 8 * 60)).toBeNull();
  });
});

describe('DEFAULT_ONBOARDING_HOURS vs booking weekday', () => {
  it('uses Mon=1…Sun=7 matching londonDayOfWeekFromIsoDate', async () => {
    const { londonDayOfWeekFromIsoDate } = await import('@/lib/booking/time');

    expect(londonDayOfWeekFromIsoDate('2026-03-02')).toBe(1); // Monday
    expect(DEFAULT_ONBOARDING_HOURS.find((r) => r.dayOfWeek === 1)?.active).toBe(true);

    expect(londonDayOfWeekFromIsoDate('2026-03-01')).toBe(7); // Sunday
    expect(DEFAULT_ONBOARDING_HOURS.find((r) => r.dayOfWeek === 7)?.active).toBe(false);

    expect(londonDayOfWeekFromIsoDate('2026-02-28')).toBe(6); // Saturday
    expect(DEFAULT_ONBOARDING_HOURS.find((r) => r.dayOfWeek === 6)?.active).toBe(true);
    expect(DEFAULT_ONBOARDING_HOURS.find((r) => r.dayOfWeek === 6)?.endTime).toBe('16:00');
  });
});
