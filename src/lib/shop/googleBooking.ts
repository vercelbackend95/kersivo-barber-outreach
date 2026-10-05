import type { GoogleBookingLinkStatus } from '@prisma/client';
import { getPublicSiteUrl } from '../setup/siteUrl';
import type { KersivoProductState } from './kersivoAccess';
import {
  resolvePublicBookingDestination,
  type StoredFullBookingDestination,
} from './publicBookingDestination';

export const GOOGLE_BUSINESS_PROFILE_MANAGE_URL = 'https://business.google.com/';

export type GoogleBookingDestination =
  | {
      available: true;
      url: string;
      source: 'starter_hosted' | 'full_hosted_fallback' | 'full_verified_own_domain';
    }
  | {
      available: false;
      url: null;
      source: 'setup_unavailable';
    };

/**
 * Authoritative V1 Google booking destination (merchant pastes it into Google Business Profile).
 * Derived from the shared public booking destination, so it always matches the QR:
 * Starter → KERSIVO-hosted /book/{slug}; Full → the OPS-verified live own-domain URL, or the
 * hosted route until one exists. Never a /q/{code} QR URL.
 */
export function resolveGoogleBookingDestination(params: {
  state: KersivoProductState;
  shop: { id: string; bookingSlug: string | null };
  fullDestination?: StoredFullBookingDestination | null;
  publicSiteUrl?: string;
}): GoogleBookingDestination {
  const destination = resolvePublicBookingDestination(params);
  if (destination.kind === 'unavailable') {
    return { available: false, url: null, source: 'setup_unavailable' };
  }
  if (destination.kind === 'own_domain') {
    return { available: true, url: destination.url, source: destination.source };
  }
  const base = (params.publicSiteUrl ?? getPublicSiteUrl()).replace(/\/$/, '');
  return { available: true, url: `${base}${destination.path}`, source: destination.source };
}

export type GoogleBookingSetupViewStatus =
  | 'NOT_SET'
  | 'SETUP_STARTED'
  | 'MERCHANT_CONFIRMED'
  | 'UPDATE_REQUIRED';

export function resolveGoogleBookingSetupView(params: {
  status: GoogleBookingLinkStatus | string;
  confirmedUrl: string | null;
  authoritativeUrl: string;
}): {
  status: GoogleBookingSetupViewStatus;
  requiresUpdate: boolean;
} {
  const stored = String(params.status);
  if (stored === 'MERCHANT_CONFIRMED') {
    const requiresUpdate = params.confirmedUrl !== params.authoritativeUrl;
    return {
      status: requiresUpdate ? 'UPDATE_REQUIRED' : 'MERCHANT_CONFIRMED',
      requiresUpdate,
    };
  }
  if (stored === 'SETUP_STARTED') {
    return { status: 'SETUP_STARTED', requiresUpdate: false };
  }
  return { status: 'NOT_SET', requiresUpdate: false };
}
