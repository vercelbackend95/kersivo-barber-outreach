/** Temporary canonical public booking route until shop slugs exist. */
export function publicBookingPath(shopId: string): string {
  return `/book/${encodeURIComponent(shopId)}`;
}
