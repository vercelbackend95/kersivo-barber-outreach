import { preferredPublicBookingPath } from '../booking/publicBookingPath';
import { normalizeFullBookingDestinationUrl } from './fullBookingDestinationUrl';
import type { KersivoProductState } from './kersivoAccess';

/** The stored authoritative record (FullBookingDestination) as seen by the resolver. */
export type StoredFullBookingDestination = {
  shopId: string;
  status: string;
  url: string;
};

export type PublicBookingDestination =
  | { kind: 'hosted'; path: string; source: 'starter_hosted' | 'full_hosted_fallback' }
  | { kind: 'own_domain'; url: string; source: 'full_verified_own_domain' }
  | { kind: 'unavailable'; source: 'setup_unavailable' };

/**
 * The single decision for where a shop's public booking lives; QR and Google both derive from it.
 *
 * - KERSIVO Starter → KERSIVO-hosted /book/{slug}.
 * - Full KERSIVO + an OPS-verified live destination for THIS shop → that exact own-domain URL.
 * - Full KERSIVO otherwise (paid, site/domain not verified live, or invalidated) → hosted fallback.
 * - SETUP (incl. every departed shop) → unavailable; a stored Full destination never revives it.
 *
 * Site preview / launch approval / onboarding domain fields are deliberately not inputs.
 */
export function resolvePublicBookingDestination(params: {
  state: KersivoProductState;
  shop: { id: string; bookingSlug: string | null };
  fullDestination?: StoredFullBookingDestination | null;
}): PublicBookingDestination {
  switch (params.state) {
    case 'FREE_BOOKING':
      return { kind: 'hosted', path: preferredPublicBookingPath(params.shop), source: 'starter_hosted' };
    case 'FULL_KERSIVO': {
      const verified = verifiedOwnDomainUrl(params.shop.id, params.fullDestination);
      if (verified) return { kind: 'own_domain', url: verified, source: 'full_verified_own_domain' };
      return {
        kind: 'hosted',
        path: preferredPublicBookingPath(params.shop),
        source: 'full_hosted_fallback',
      };
    }
    case 'SETUP':
    default:
      return { kind: 'unavailable', source: 'setup_unavailable' };
  }
}

function verifiedOwnDomainUrl(
  shopId: string,
  record: StoredFullBookingDestination | null | undefined,
): string | null {
  if (!record || record.shopId !== shopId || String(record.status) !== 'VERIFIED_LIVE') return null;
  const normalized = normalizeFullBookingDestinationUrl(record.url);
  return normalized.ok && normalized.url === record.url ? normalized.url : null;
}
