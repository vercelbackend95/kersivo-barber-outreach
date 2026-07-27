import { formatInTimeZone } from 'date-fns-tz';
import { prisma } from '@/lib/db/client';

export const SHOP_PUBLIC_ACTIVITY_PAUSED_MESSAGE =
  'This barbershop is temporarily closed. Bookings and retail are unavailable.';

export const SHOP_PAUSE_REASON_MIN_LENGTH = 8;

export class ShopPublicActivityPausedError extends Error {
  readonly status = 422;
  readonly code = 'SHOP_PUBLIC_ACTIVITY_PAUSED';

  constructor(message = SHOP_PUBLIC_ACTIVITY_PAUSED_MESSAGE) {
    super(message);
    this.name = 'ShopPublicActivityPausedError';
  }
}

export type ShopPauseFields = {
  publicActivityPaused: boolean;
  publicActivityPauseFrom?: Date | null;
  publicActivityPauseUntil?: Date | null;
  publicActivityPauseReason?: string | null;
  timezone?: string | null;
};

const PAUSE_SELECT = {
  publicActivityPaused: true,
  publicActivityPauseFrom: true,
  publicActivityPauseUntil: true,
  publicActivityPauseReason: true,
  timezone: true,
} as const;

/** Store calendar dates at UTC noon to keep YYYY-MM-DD stable across TZ edges. */
export function isoDateToStoredPauseDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function storedPauseDateToIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function todayIsoInTimezone(timezone = 'Europe/London', now = new Date()): string {
  return formatInTimeZone(now, timezone || 'Europe/London', 'yyyy-MM-dd');
}

export function pauseReasonMessage(shop: ShopPauseFields): string {
  const reason = shop.publicActivityPauseReason?.trim();
  return reason || SHOP_PUBLIC_ACTIVITY_PAUSED_MESSAGE;
}

/**
 * Armed pause active on a calendar date.
 * Legacy rows (armed, no from/until) block every date.
 */
export function isPauseActiveOnIsoDate(shop: ShopPauseFields, isoDate: string): boolean {
  if (!shop.publicActivityPaused) return false;
  if (!shop.publicActivityPauseFrom || !shop.publicActivityPauseUntil) return true;
  const from = storedPauseDateToIso(shop.publicActivityPauseFrom);
  const until = storedPauseDateToIso(shop.publicActivityPauseUntil);
  return isoDate >= from && isoDate <= until;
}

export function isPauseActiveNow(shop: ShopPauseFields, now = new Date()): boolean {
  return isPauseActiveOnIsoDate(shop, todayIsoInTimezone(shop.timezone ?? 'Europe/London', now));
}

async function loadShopPause(shopId: string): Promise<ShopPauseFields | null> {
  return prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: PAUSE_SELECT,
  });
}

/** @deprecated Prefer isShopPublicActivityPausedNow — kept as “paused now” for callers. */
export async function isShopPublicActivityPaused(shopId: string): Promise<boolean> {
  return isShopPublicActivityPausedNow(shopId);
}

export async function isShopPublicActivityPausedNow(shopId: string, now = new Date()): Promise<boolean> {
  const shop = await loadShopPause(shopId);
  if (!shop) return false;
  return isPauseActiveNow(shop, now);
}

export async function getShopPublicActivityPauseOnDate(
  shopId: string,
  isoDate: string,
): Promise<{ paused: boolean; reason: string | null }> {
  const shop = await loadShopPause(shopId);
  if (!shop || !isPauseActiveOnIsoDate(shop, isoDate)) {
    return { paused: false, reason: null };
  }
  return { paused: true, reason: pauseReasonMessage(shop) };
}

export async function isShopPublicActivityPausedOnDate(shopId: string, isoDate: string): Promise<boolean> {
  const { paused } = await getShopPublicActivityPauseOnDate(shopId, isoDate);
  return paused;
}

/** Throws when the shop has paused public activity for “now” (retail / general gates). */
export async function assertShopAcceptingPublicActivity(shopId: string): Promise<void> {
  const shop = await loadShopPause(shopId);
  if (!shop || !isPauseActiveNow(shop)) return;
  throw new ShopPublicActivityPausedError(pauseReasonMessage(shop));
}

/** Throws when the shop has paused public bookings for a specific booking date. */
export async function assertShopAcceptingPublicBookingsOnDate(
  shopId: string,
  isoDate: string,
): Promise<void> {
  const shop = await loadShopPause(shopId);
  if (!shop || !isPauseActiveOnIsoDate(shop, isoDate)) return;
  throw new ShopPublicActivityPausedError(pauseReasonMessage(shop));
}
