import type { ShopSettings } from '@prisma/client';

export function canCancelOrReschedule(startAt: Date, windowHours: number): boolean {
  const diff = startAt.getTime() - Date.now();
  return diff >= windowHours * 60 * 60000;
}

export function pendingExpiryDate(settings: Pick<ShopSettings, 'pendingConfirmationMins'>): Date {
  return new Date(Date.now() + settings.pendingConfirmationMins * 60000);
}
