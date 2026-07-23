import { prisma } from '@/lib/db/client';

export type OnlineBookingSetupMissing = 'services' | 'workingHours';

export type SetOnlineBookingsEnabledResult =
  | { ok: true; active: boolean }
  | {
      ok: false;
      status: 404 | 422;
      code: string;
      error: string;
      missing?: OnlineBookingSetupMissing[];
    };

export function isValidWorkingHoursRule(row: {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  active: boolean;
}): boolean {
  if (!row.active) return false;
  if (!Number.isInteger(row.dayOfWeek) || row.dayOfWeek < 0 || row.dayOfWeek > 6) return false;
  if (!Number.isFinite(row.startMinutes) || !Number.isFinite(row.endMinutes)) return false;
  return row.startMinutes < row.endMinutes;
}

/**
 * Canonical Online bookings toggle: Barber.active only.
 * Never touches userId, ShopMember, services, hours, or creates profiles.
 */
export async function setOnlineBookingsEnabled(params: {
  shopId: string;
  barberId: string;
  enabled: boolean;
}): Promise<SetOnlineBookingsEnabledResult> {
  const { shopId, barberId, enabled } = params;

  const barber = await prisma.barber.findFirst({
    where: { id: barberId, shopId },
    select: { id: true, active: true },
  });
  if (!barber) {
    return {
      ok: false,
      status: 404,
      code: 'BARBER_NOT_FOUND',
      error: 'Booking profile not found.',
    };
  }

  if (enabled) {
    const [serviceLinks, rules] = await Promise.all([
      prisma.barberService.findMany({
        where: {
          barberId,
          service: { shopId, isActive: true },
        },
        select: { serviceId: true },
      }),
      prisma.availabilityRule.findMany({
        where: { barberId },
        select: {
          dayOfWeek: true,
          startMinutes: true,
          endMinutes: true,
          active: true,
        },
      }),
    ]);

    const missing: OnlineBookingSetupMissing[] = [];
    if (serviceLinks.length === 0) missing.push('services');
    if (!rules.some(isValidWorkingHoursRule)) missing.push('workingHours');

    if (missing.length > 0) {
      const error =
        missing.includes('services') && missing.includes('workingHours')
          ? 'Online booking setup incomplete.'
          : missing.includes('services')
            ? 'Assign at least one service before enabling online bookings.'
            : 'Add working hours before enabling online bookings.';

      return {
        ok: false,
        status: 422,
        code: 'ONLINE_BOOKING_SETUP_INCOMPLETE',
        error,
        missing,
      };
    }
  }

  if (barber.active === enabled) {
    return { ok: true, active: enabled };
  }

  await prisma.barber.update({
    where: { id: barberId },
    data: { active: enabled },
  });

  return { ok: true, active: enabled };
}
