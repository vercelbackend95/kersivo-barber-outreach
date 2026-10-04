import type { KersivoProductState } from '../shop/kersivoAccess';
import { preferredPublicBookingPath } from '../booking/publicBookingPath';

export type QrDestination =
  | {
      kind: 'redirect';
      path: string;
      source: 'free_booking_slug' | 'full_kersivo_temporary_slug_fallback';
    }
  | { kind: 'unavailable' };

/**
 * The single place that decides where a physical QR code sends a scanner. Resolved at scan time
 * from CURRENT product state — QR rows never store a destination.
 *
 * FULL_KERSIVO: TEMPORARY FALLBACK to the KERSIVO booking slug route. There is no authoritative
 * "live Full branded booking URL" in the schema yet (sitePreviewUrl, onboarding domains and other
 * user-entered URLs are NOT trustworthy destinations). Before physical QR kits ship, a later phase
 * must connect this branch to a verified live Full booking destination.
 */
export function resolveQrDestination(params: {
  state: KersivoProductState;
  shop: { id: string; bookingSlug: string | null };
}): QrDestination {
  switch (params.state) {
    case 'FREE_BOOKING':
      return {
        kind: 'redirect',
        path: preferredPublicBookingPath(params.shop),
        source: 'free_booking_slug',
      };
    case 'FULL_KERSIVO':
      return {
        kind: 'redirect',
        path: preferredPublicBookingPath(params.shop),
        source: 'full_kersivo_temporary_slug_fallback',
      };
    case 'SETUP':
    default:
      return { kind: 'unavailable' };
  }
}
