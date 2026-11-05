/**
 * Server-side loader for the site data contract (docs/site-data-contract.md).
 *
 * Reads ONLY canonical records (ShopSettings, ShopPublicProfile, ShopOpeningHours,
 * ShopOpeningException, Barber, Service, Product) — the same rows the Starter hub and the paid
 * dashboard write — and applies plan gating at the output (`planFeatures`, `products`), never by
 * reading different data per plan.
 */
import { prisma } from '@/lib/db/client';
import { isDemoShopId, canSellRetail } from '@/lib/shop/cardPaymentsGate';
import { hasKersivoCapability, loadKersivoAccess, type KersivoProductState } from '@/lib/shop/kersivoAccess';
import { resolvePublicBookingDestination } from '@/lib/shop/publicBookingDestination';
import { shopAcceptsPublicBookings } from '@/lib/setup/shopPublicBookingGate';
import { preferredPublicBookingPath } from '@/lib/booking/publicBookingPath';
import { resolvePublicBookingIdentifier } from '@/lib/booking/resolvePublicBookingIdentifier';
import { buildSiteData, type SiteDataSource } from './build';
import type { SiteData, SitePlan } from './types';

export type SiteDataMode = 'public' | 'preview';

export function siteAppOrigin(): string {
  const configured = (import.meta.env?.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? '').trim();
  return (configured || 'https://kersivo.co.uk').replace(/\/$/, '');
}

function planFor(state: KersivoProductState): SitePlan | null {
  if (state === 'FULL_KERSIVO') return 'full';
  if (state === 'FREE_BOOKING') return 'starter';
  return null;
}

/**
 * Resolve a public identifier to a shop id: a verified own-domain host ("sharpcuts.co.uk"),
 * a bookingSlug, or a legacy shop id. Unverified domains never resolve.
 */
export async function resolveSiteShopId(shopSlugOrDomain: string): Promise<string | null> {
  const raw = shopSlugOrDomain.trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('.')) {
    const host = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    if (!/^[a-z0-9.-]+$/.test(host)) return null;
    const rows = await prisma.fullBookingDestination.findMany({
      where: {
        status: 'VERIFIED_LIVE',
        OR: [
          { url: { startsWith: `https://${host}/` } },
          { url: `https://${host}` },
          { url: { startsWith: `https://www.${host}/` } },
          { url: `https://www.${host}` },
        ],
      },
      select: { shopId: true },
      take: 2,
    });
    return rows.length === 1 ? rows[0].shopId : null;
  }
  const resolution = await resolvePublicBookingIdentifier(shopSlugOrDomain.trim());
  if (resolution.kind === 'shop') return resolution.shopId;
  if (resolution.kind === 'redirect') {
    const slug = resolution.location.split('?')[0].split('/').pop() ?? '';
    const again = await resolvePublicBookingIdentifier(slug);
    return again.kind === 'shop' ? again.shopId : null;
  }
  return null;
}

/** Load and normalise one shop's site data. Null when the shop does not exist or is being purged. */
export async function loadSiteDataForShop(
  shopId: string,
  options: { mode?: SiteDataMode; now?: Date } = {},
): Promise<SiteData | null> {
  const mode = options.mode ?? 'public';
  const now = options.now ?? new Date();
  if (isDemoShopId(shopId)) return null;

  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      name: true,
      townCity: true,
      logoUrl: true,
      timezone: true,
      bookingSlug: true,
      purgeStartedAt: true,
      publicActivityPaused: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      retailEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
      publicProfile: true,
      fullBookingDestination: { select: { shopId: true, status: true, url: true } },
    },
  });
  if (!shop || shop.purgeStartedAt) return null;

  const [hours, exceptions, barbers, services, products] = await Promise.all([
    prisma.shopOpeningHours.findMany({
      where: { shopId },
      select: { dayOfWeek: true, active: true, startMinutes: true, endMinutes: true },
    }),
    prisma.shopOpeningException.findMany({
      where: { shopId },
      select: { date: true, closed: true, startMinutes: true, endMinutes: true, label: true },
      orderBy: { date: 'asc' },
    }),
    prisma.barber.findMany({
      where: { shopId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        title: true,
        bio: true,
        avatarUrl: true,
        active: true,
        showOnWebsite: true,
        barberServices: { select: { serviceId: true } },
      },
    }),
    prisma.service.findMany({
      where: { shopId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        durationMinutes: true,
        pricePence: true,
        priceFrom: true,
        isActive: true,
        featured: true,
      },
    }),
    prisma.product.findMany({
      where: { shopId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        pricePence: true,
        inStock: true,
        active: true,
      },
    }),
  ]);

  const origin = siteAppOrigin();
  const hostedBookingUrl = `${origin}${preferredPublicBookingPath(shop)}`;

  let plan: SitePlan;
  let features: SiteDataSource['features'];
  let bookingUrl: string | null = null;
  let bookingHostedUrl: string | null = null;
  let websiteUrl: string | null = null;

  if (mode === 'preview') {
    // The private preview shows what the Full KERSIVO site will look like. No live booking or retail.
    plan = 'preview';
    features = { brandedSite: true, onlineBooking: false, retail: false };
  } else {
    const access = await loadKersivoAccess(shopId, now);
    const resolvedPlan = planFor(access.state);
    if (!resolvedPlan) {
      plan = 'starter';
      features = { brandedSite: false, onlineBooking: false, retail: false };
    } else {
      plan = resolvedPlan;
      const destination = resolvePublicBookingDestination({
        state: access.state,
        shop,
        fullDestination: shop.fullBookingDestination,
      });
      if (destination.kind === 'own_domain') {
        bookingUrl = destination.url;
        websiteUrl = new URL(destination.url).origin;
        // The own-domain /book redirects to the hosted flow (docs/site-data-contract.md).
        bookingHostedUrl = hostedBookingUrl;
      } else if (destination.kind === 'hosted') {
        bookingUrl = `${origin}${destination.path}`;
        bookingHostedUrl = bookingUrl;
      }
      features = {
        brandedSite: hasKersivoCapability(access, 'BRANDED_SITE'),
        onlineBooking: bookingUrl !== null && (await shopAcceptsPublicBookings(shopId)),
        retail:
          hasKersivoCapability(access, 'RETAIL') && canSellRetail(shop) && !shop.publicActivityPaused,
      };
    }
  }

  return buildSiteData({
    shop,
    profile: shop.publicProfile,
    hours,
    exceptions,
    barbers: barbers.map((b) => ({ ...b, serviceIds: b.barberServices.map((s) => s.serviceId) })),
    services,
    products,
    plan,
    features,
    bookingUrl,
    hostedBookingUrl: bookingHostedUrl,
    websiteUrl,
    fallbackCanonicalUrl: hostedBookingUrl,
    appOrigin: origin,
    now,
  });
}

/**
 * The public entry point: `getSiteData("sharp-cuts")`, `getSiteData("sharpcuts.co.uk")`.
 * `locationId` is accepted for forward compatibility; today a shop has one location whose id is
 * the shop id, so any other value returns null.
 */
export async function getSiteData(
  shopSlugOrDomain: string,
  locationId?: string,
  options: { now?: Date } = {},
): Promise<SiteData | null> {
  const shopId = await resolveSiteShopId(shopSlugOrDomain);
  if (!shopId) return null;
  if (locationId && locationId !== shopId) return null;
  return loadSiteDataForShop(shopId, { mode: 'public', now: options.now });
}

/** A site is publicly served only when the plan includes the branded website. */
export function isSitePublished(site: SiteData): boolean {
  return site.planFeatures.brandedSite && site.planFeatures.plan !== 'preview';
}
