import type { GoogleBookingLinkStatus } from '@prisma/client';
import { preferredPublicBookingPath } from '../booking/publicBookingPath';
import { getPublicSiteUrl } from '../setup/siteUrl';
import type { KersivoProductState } from './kersivoAccess';

export const GOOGLE_BUSINESS_PROFILE_MANAGE_URL = 'https://business.google.com/';

export type GoogleBookingDestination =
  | {
      available: true;
      url: string;
      source: 'starter_hosted' | 'full_hosted_fallback';
    }
  | {
      available: false;
      url: null;
      source: 'setup_unavailable';
    };

/**
 * Authoritative V1 Google booking destination.
 *
 * Starter always uses the stable KERSIVO-hosted /book/{slug} destination.
 * Full currently uses the same stable booking route until a separately verified live Full
 * own-domain booking destination exists. Do not infer that destination from preview URLs,
 * customer-entered domain text or social links.
 */
export function resolveGoogleBookingDestination(params: {
  state: KersivoProductState;
  shop: { id: string; bookingSlug: string | null };
  publicSiteUrl?: string;
}): GoogleBookingDestination {
  if (params.state === 'SETUP') {
    return { available: false, url: null, source: 'setup_unavailable' };
  }

  const base = (params.publicSiteUrl ?? getPublicSiteUrl()).replace(/\/$/, '');
  const url = `${base}${preferredPublicBookingPath(params.shop)}`;

  return {
    available: true,
    url,
    source:
      params.state === 'FREE_BOOKING'
        ? 'starter_hosted'
        : 'full_hosted_fallback',
  };
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
