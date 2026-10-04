/** Canonical public booking URL for a shop with a stable bookingSlug. */
export function publicBookingPathFromSlug(bookingSlug: string): string {
  return `/book/${encodeURIComponent(bookingSlug)}`;
}

/**
 * Legacy raw-ID booking URL. Only for shops without a bookingSlug (e.g. older Full shops);
 * /book/{shopId} permanently redirects to the slug URL once a slug exists.
 */
export function legacyPublicBookingPathFromShopId(shopId: string): string {
  return `/book/${encodeURIComponent(shopId)}`;
}

/** Preferred public booking path: slug when allocated, legacy raw-ID path otherwise. */
export function preferredPublicBookingPath(shop: { id: string; bookingSlug: string | null }): string {
  return shop.bookingSlug
    ? publicBookingPathFromSlug(shop.bookingSlug)
    : legacyPublicBookingPathFromShopId(shop.id);
}
