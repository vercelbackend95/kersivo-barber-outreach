/**
 * Loads everything the config checks need for one shop, once per run, so checks never re-query.
 * Read-only.
 */
import { prisma } from '@/lib/db/client';
import { loadKersivoAccess } from '@/lib/shop/kersivoAccess';
import { loadPublicBookingIntakeStatus } from '@/lib/setup/shopPublicBookingGate';
import { resolvePublicBookingDestination } from '@/lib/shop/publicBookingDestination';
import type { KersivoAccess } from '@/lib/shop/kersivoAccess';
import type { HealthShop, ShopHealthContext, ShopHealthMode } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const STUCK_PAYMENT_GRACE_MS = 30 * 60 * 1000;
export const EMAIL_STUCK_MS = 30 * 60 * 1000;

const SHOP_SELECT = {
  id: true,
  name: true,
  bookingSlug: true,
  timezone: true,
  shopPaidAt: true,
  smsRemindersEnabled: true,
  goLiveAt: true,
  sitePreviewUrl: true,
  depositsEnabled: true,
  bookingPaymentMode: true,
  retailEnabled: true,
  retailTestOrderCompletedAt: true,
  stripeConnectAccountId: true,
  stripeConnectAccountType: true,
  stripeConnectChargesEnabled: true,
  stripeConnectDetailsSubmitted: true,
  stripeConnectDisconnectedAt: true,
  pendingConfirmationMins: true,
  publicActivityPaused: true,
  publicActivityPausedAt: true,
  publicActivityPauseFrom: true,
  publicActivityPauseUntil: true,
  publicActivityPauseReason: true,
} as const;

/**
 * LIVE when the shop holds a product state (Full or Starter), or was launched (goLiveAt) and has not left
 * KERSIVO. Everything else (draft preview shops) is PRELAUNCH.
 */
export function naturalHealthMode(access: KersivoAccess, shop: Pick<HealthShop, 'goLiveAt'>): ShopHealthMode {
  if (access.state !== 'SETUP') return 'LIVE';
  if (shop.goLiveAt && !access.departure) return 'LIVE';
  return 'PRELAUNCH';
}

export class ShopNotFoundError extends Error {
  constructor(shopId: string) {
    super(`Shop ${shopId} not found`);
    this.name = 'ShopNotFoundError';
  }
}

export async function loadShopHealthContext(
  shopId: string,
  options: { now?: Date; mode?: ShopHealthMode } = {},
): Promise<ShopHealthContext> {
  const now = options.now ?? new Date();
  const shopRow = await prisma.shopSettings.findUnique({ where: { id: shopId }, select: SHOP_SELECT });
  if (!shopRow) throw new ShopNotFoundError(shopId);
  const shop: HealthShop = { ...shopRow, bookingPaymentMode: String(shopRow.bookingPaymentMode), stripeConnectAccountType: shopRow.stripeConnectAccountType ? String(shopRow.stripeConnectAccountType) : null };
  const since = new Date(now.getTime() - 7 * DAY_MS);

  const [access, intake, hours, services, barbers, products, profile, fullDestination, stuckPendingPayments, smsRows, emailFailed7d, emailStuck7d] =
    await Promise.all([
      loadKersivoAccess(shopId, now),
      loadPublicBookingIntakeStatus(shopId),
      prisma.shopOpeningHours.findMany({ where: { shopId, active: true }, select: { startMinutes: true, endMinutes: true } }),
      prisma.service.findMany({
        where: { shopId, isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          pricePence: true,
          durationMinutes: true,
          barberServices: { where: { barber: { active: true } }, select: { barberId: true } },
        },
      }),
      prisma.barber.findMany({
        where: { shopId, active: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          barberServices: { where: { service: { isActive: true } }, select: { serviceId: true } },
          _count: { select: { rules: { where: { active: true } } } },
        },
      }),
      prisma.product.findMany({
        where: { shopId, active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, pricePence: true, imageUrl: true, description: true },
      }),
      prisma.shopPublicProfile.findUnique({ where: { shopId }, select: { addressLine1: true, postcode: true, phone: true } }),
      prisma.fullBookingDestination.findUnique({ where: { shopId }, select: { shopId: true, status: true, url: true } }),
      prisma.booking.count({
        where: {
          barber: { shopId },
          status: 'PENDING_PAYMENT',
          paymentExpiresAt: { lt: new Date(now.getTime() - STUCK_PAYMENT_GRACE_MS) },
        },
      }),
      prisma.smsOutbound.findMany({
        where: { shopId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { status: true },
      }),
      prisma.emailOutbound.count({ where: { shopId, createdAt: { gte: since }, status: 'FAILED' } }),
      prisma.emailOutbound.count({
        where: { shopId, createdAt: { gte: since, lt: new Date(now.getTime() - EMAIL_STUCK_MS) }, status: 'QUEUED' },
      }),
    ]);

  const destination = resolvePublicBookingDestination({
    state: access.state,
    shop: { id: shop.id, bookingSlug: shop.bookingSlug },
    fullDestination: fullDestination ? { ...fullDestination, status: String(fullDestination.status) } : null,
  });

  return {
    now,
    mode: options.mode ?? naturalHealthMode(access, shop),
    shop,
    access,
    intake,
    destination,
    verifiedDestinationUrl:
      fullDestination && String(fullDestination.status) === 'VERIFIED_LIVE' ? fullDestination.url : null,
    openDays: hours.filter((row) => row.endMinutes > row.startMinutes).length,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      pricePence: s.pricePence,
      durationMinutes: s.durationMinutes,
      barberIds: s.barberServices.map((link) => link.barberId),
    })),
    barbers: barbers.map((b) => ({
      id: b.id,
      name: b.name,
      serviceIds: b.barberServices.map((link) => link.serviceId),
      activeRuleCount: b._count.rules,
    })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      pricePence: p.pricePence,
      hasImage: Boolean(p.imageUrl?.trim()),
      hasDescription: Boolean(p.description?.trim()),
    })),
    profile: profile
      ? {
          hasAddressOrPostcode: Boolean(profile.addressLine1?.trim() || profile.postcode?.trim()),
          hasPhone: Boolean(profile.phone?.trim()),
        }
      : null,
    stuckPendingPayments,
    messaging: {
      smsRecent: smsRows.map((row) => String(row.status) as 'QUEUED' | 'SENT' | 'FAILED'),
      emailFailed7d,
      emailStuck7d,
    },
  };
}
