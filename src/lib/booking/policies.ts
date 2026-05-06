/** Barber/admin cancel: allowed only when more than this many minutes remain before `startAt`. */
export const SHOP_ADMIN_CANCEL_MIN_LEAD_MS = 60 * 60 * 1000;

export function canShopAdminCancelByLeadTime(startAt: Date, nowMs: number): boolean {
  return startAt.getTime() - nowMs > SHOP_ADMIN_CANCEL_MIN_LEAD_MS;
}

export function canCancelOrReschedule(startAt: Date, windowHours: number): boolean {
  const diff = startAt.getTime() - Date.now();
  return diff >= windowHours * 60 * 60000;
}
