import { Prisma, type ShopSettings } from '@prisma/client';

export const PUBLIC_BOOKING_UNAVAILABLE_MESSAGE =
  'Online booking is temporarily unavailable. Please try again in a few minutes.';

export const PUBLIC_SHOP_UNAVAILABLE_MESSAGE =
  'The shop is temporarily unavailable. Please try again in a few minutes.';

export const PUBLIC_FALLBACK_SHOP_SETTINGS: Pick<
  ShopSettings,
  | 'id'
  | 'name'
  | 'timezone'
  | 'cancellationWindowHours'
  | 'rescheduleWindowHours'
  | 'pendingConfirmationMins'
  | 'slotIntervalMinutes'
  | 'defaultBufferMinutes'
> = {
  id: 'demo-shop',
  name: 'Demo Barbershop',
  timezone: 'Europe/London',
  cancellationWindowHours: 2,
  rescheduleWindowHours: 2,
  pendingConfirmationMins: 15,
  slotIntervalMinutes: 15,
  defaultBufferMinutes: 0
};

export function isPrismaQuotaExceededError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');

  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && message.includes('exceeded the data transfer quota'))
    || message.includes('Your project has exceeded the data transfer quota')
  );
}

export function logPrismaQuotaFallback(scope: string, error: unknown) {
  console.warn(`[db] Falling back because Prisma quota was exceeded in ${scope}.`, {
    error: error instanceof Error ? error.message : error
  });
}

export async function withPrismaQuotaFallback<T>(scope: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (!isPrismaQuotaExceededError(error)) {
      throw error;
    }

    logPrismaQuotaFallback(scope, error);
    return fallback;
  }
}
