import type { KersivoProductState } from '../shop/kersivoAccess';
import {
  resolvePublicBookingDestination,
  type StoredFullBookingDestination,
} from '../shop/publicBookingDestination';

export type QrDestination =
  | {
      kind: 'redirect';
      path: string;
      source: 'free_booking_slug' | 'full_kersivo_hosted_fallback';
    }
  | {
      /** Only ever the OPS-verified live Full destination of the scanned shop. */
      kind: 'external_redirect';
      url: string;
      source: 'full_verified_own_domain';
    }
  | { kind: 'unavailable' };

/**
 * The single place that decides where a physical QR code sends a scanner. Resolved at scan time
 * from CURRENT product state and the shop's authoritative booking destination — QR rows never
 * store a destination, so the same printed code follows Starter ↔ Full transitions.
 */
export function resolveQrDestination(params: {
  state: KersivoProductState;
  shop: { id: string; bookingSlug: string | null };
  fullDestination?: StoredFullBookingDestination | null;
}): QrDestination {
  const destination = resolvePublicBookingDestination(params);
  switch (destination.kind) {
    case 'hosted':
      return {
        kind: 'redirect',
        path: destination.path,
        source:
          destination.source === 'starter_hosted' ? 'free_booking_slug' : 'full_kersivo_hosted_fallback',
      };
    case 'own_domain':
      return { kind: 'external_redirect', url: destination.url, source: destination.source };
    default:
      return { kind: 'unavailable' };
  }
}

/** Location header value for a resolved redirect (relative KERSIVO path or verified HTTPS URL). */
export function qrRedirectLocation(destination: QrDestination): string | null {
  if (destination.kind === 'redirect') return destination.path;
  if (destination.kind === 'external_redirect') return destination.url;
  return null;
}
