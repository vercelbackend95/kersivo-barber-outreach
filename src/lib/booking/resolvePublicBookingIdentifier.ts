import { prisma } from '../db/client';
import { DEMO_SHOP_ID } from '../db/shopScope';
import { isDemoShopId } from '../shop/cardPaymentsGate';
import { preferredPublicBookingPath, publicBookingPathFromSlug } from './publicBookingPath';

/**
 * /book/{identifier} resolution. The public identifier is a bookingSlug or, for backward
 * compatibility, a raw ShopSettings.id. Callers must only use `shopId` from a `shop` result
 * for internal APIs — never the raw identifier.
 */
export type PublicBookingIdentifierResolution =
  | { kind: 'demo' }
  | { kind: 'not_found' }
  | { kind: 'redirect'; location: string; status: 308 }
  | { kind: 'shop'; shopId: string; bookingSlug: string | null; resolvedBy: 'slug' | 'id' };

export async function resolvePublicBookingIdentifier(
  rawIdentifier: string,
  search = '',
  db: Pick<typeof prisma, 'shopSettings'> = prisma,
): Promise<PublicBookingIdentifierResolution> {
  const identifier = rawIdentifier.trim();
  if (!identifier) return { kind: 'not_found' };
  // Demo routing never resolves to (or redirects into) a real tenant.
  if (identifier === DEMO_SHOP_ID || isDemoShopId(identifier)) return { kind: 'demo' };

  const bySlug = await db.shopSettings.findUnique({
    where: { bookingSlug: identifier },
    select: { id: true, bookingSlug: true },
  });
  if (bySlug) {
    return { kind: 'shop', shopId: bySlug.id, bookingSlug: bySlug.bookingSlug, resolvedBy: 'slug' };
  }

  const byId = await db.shopSettings.findUnique({
    where: { id: identifier },
    select: { id: true, bookingSlug: true },
  });
  if (!byId) return { kind: 'not_found' };

  if (byId.bookingSlug) {
    return {
      kind: 'redirect',
      location: `${publicBookingPathFromSlug(byId.bookingSlug)}${search}`,
      status: 308,
    };
  }
  return { kind: 'shop', shopId: byId.id, bookingSlug: null, resolvedBy: 'id' };
}

/** SEO for a resolved booking page: always noindex (crawlable for the directive), canonical slug. */
export function publicBookingPageSeo(shop: { id: string; bookingSlug: string | null }) {
  return {
    canonicalPath: preferredPublicBookingPath(shop),
    noindex: true as const,
    robotsFollow: true as const,
  };
}
