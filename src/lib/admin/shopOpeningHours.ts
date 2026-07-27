import { prisma } from '@/lib/db/client';
import { minutesToTimeString, timeStringToMinutes } from '@/lib/admin/timeStrings';
import { ALL_WEEKDAYS } from '@/lib/booking/weekdays';

export type OnboardingWeeklyRule = {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
};

export const DEFAULT_ONBOARDING_HOURS: OnboardingWeeklyRule[] = [
  { dayOfWeek: 1, active: true, startTime: '09:00', endTime: '18:00' }, // Monday
  { dayOfWeek: 2, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 3, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 4, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 5, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 6, active: true, startTime: '09:00', endTime: '16:00' }, // Saturday
  { dayOfWeek: 7, active: false, startTime: '09:00', endTime: '18:00' }, // Sunday
];

export type ShopHoursDay = {
  dayOfWeek: number;
  active: boolean;
  startMinutes: number;
  endMinutes: number;
};

export async function serializeShopOpeningHours(shopId: string): Promise<OnboardingWeeklyRule[]> {
  const rows = await prisma.shopOpeningHours.findMany({
    where: { shopId },
    orderBy: [{ dayOfWeek: 'asc' }],
    select: { dayOfWeek: true, active: true, startMinutes: true, endMinutes: true },
  });

  // First visit: no rows yet → defaults for the shop-hours step UI.
  if (rows.length === 0) {
    return DEFAULT_ONBOARDING_HOURS.map((row) => ({ ...row }));
  }

  const byDay = new Map(rows.map((row) => [row.dayOfWeek, row]));
  const defaultsByDay = new Map(DEFAULT_ONBOARDING_HOURS.map((row) => [row.dayOfWeek, row]));
  return ALL_WEEKDAYS.map((dayOfWeek) => {
    const row = byDay.get(dayOfWeek);
    const defaults = defaultsByDay.get(dayOfWeek)!;
    // After save we only persist active days — missing days are closed.
    if (!row) {
      return {
        dayOfWeek,
        active: false,
        startTime: defaults.startTime,
        endTime: defaults.endTime,
      };
    }
    return {
      dayOfWeek,
      active: row.active,
      startTime: minutesToTimeString(row.startMinutes),
      endTime: minutesToTimeString(row.endMinutes),
    };
  });
}

export async function loadShopOpeningHoursDays(shopId: string): Promise<ShopHoursDay[]> {
  const rows = await prisma.shopOpeningHours.findMany({
    where: { shopId, active: true },
    select: { dayOfWeek: true, active: true, startMinutes: true, endMinutes: true },
  });
  return rows.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    active: row.active,
    startMinutes: row.startMinutes,
    endMinutes: row.endMinutes,
  }));
}

export async function replaceShopOpeningHours(shopId: string, rules: OnboardingWeeklyRule[]) {
  await prisma.$transaction(async (tx) => {
    await tx.shopOpeningHours.deleteMany({ where: { shopId } });
    const activeRules = rules.filter((rule) => rule.active);
    if (activeRules.length === 0) return;

    await tx.shopOpeningHours.createMany({
      data: activeRules.map((rule) => ({
        shopId,
        dayOfWeek: rule.dayOfWeek,
        active: true,
        startMinutes: timeStringToMinutes(rule.startTime),
        endMinutes: timeStringToMinutes(rule.endTime),
      })),
    });
  });
}

/**
 * Barber hours must sit inside shop opening hours for each weekday.
 * Shop closed ⇒ barber must be closed that day.
 */
export function assertBarberMinutesWithinShop(
  shopDays: ShopHoursDay[],
  barberRules: Array<{
    dayOfWeek: number;
    active: boolean;
    startMinutes: number;
    endMinutes: number;
  }>,
): string | null {
  const shopByDay = new Map(shopDays.map((r) => [r.dayOfWeek, r]));

  for (const barber of barberRules) {
    if (!barber.active) continue;
    const shop = shopByDay.get(barber.dayOfWeek);
    if (!shop?.active) {
      return `Day ${barber.dayOfWeek}: the shop is closed — barbers cannot work that day.`;
    }
    if (barber.startMinutes < shop.startMinutes || barber.endMinutes > shop.endMinutes) {
      return `Day ${barber.dayOfWeek}: barber hours must be within shop opening hours (${minutesToTimeString(shop.startMinutes)}–${minutesToTimeString(shop.endMinutes)}).`;
    }
  }
  return null;
}

export function assertBarberHoursWithinShop(
  shopHours: OnboardingWeeklyRule[],
  barberHours: OnboardingWeeklyRule[],
): string | null {
  const shopDays: ShopHoursDay[] = shopHours
    .filter((r) => r.active)
    .map((r) => ({
      dayOfWeek: r.dayOfWeek,
      active: true,
      startMinutes: timeStringToMinutes(r.startTime),
      endMinutes: timeStringToMinutes(r.endTime),
    }));

  return assertBarberMinutesWithinShop(
    shopDays,
    barberHours.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      active: r.active,
      startMinutes: timeStringToMinutes(r.startTime),
      endMinutes: timeStringToMinutes(r.endTime),
    })),
  );
}

/** Intersect a barber window with shop hours for one weekday. Null if closed/empty. */
export function intersectMinutesWithShopDay(
  shopDay: ShopHoursDay | undefined,
  startMinutes: number,
  endMinutes: number,
): { startMinutes: number; endMinutes: number } | null {
  if (!shopDay?.active) return null;
  const start = Math.max(startMinutes, shopDay.startMinutes);
  const end = Math.min(endMinutes, shopDay.endMinutes);
  if (start >= end) return null;
  return { startMinutes: start, endMinutes: end };
}

/**
 * When the shop has configured opening hours, barber working hours must sit inside them.
 * Shops with no shop-hours rows yet skip the check (legacy / pre-onboarding).
 */
export async function assertWorkingHoursWithinShopHours(
  shopId: string,
  hours: Array<{
    dayOfWeek: number;
    active: boolean;
    startMinutes: number;
    endMinutes: number;
  }>,
): Promise<string | null> {
  const shopDays = await loadShopOpeningHoursDays(shopId);
  if (shopDays.length === 0) return null;
  return assertBarberMinutesWithinShop(shopDays, hours);
}
