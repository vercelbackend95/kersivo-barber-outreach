import { prisma } from '@/lib/db/client';
import { FREE_PREVIEW_BOOKING_SYSTEMS, labelFor } from './intake';

export type PreviewOnboardingPrefill = {
  shopName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  publicEmail: string;
  publicPhone: string;
  addressLine1: string;
  townCity: string;
  postcode: string;
  domainMode: 'EXISTING' | 'KERSIVO_REGISTER' | null;
  existingDomain: string;
  preferredDomain1: string;
  migrationRequested: boolean | null;
  currentBookingSystemLabel: string | null;
  submitted: boolean;
  stripeConnected: boolean;
};

function hostnameOf(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Shortened onboarding after a free preview purchase (spec §7): only Stripe Connect, the domain and a
 * confirmation of details are asked for. Everything known from the request, the draft shop and the
 * prefilled ClientOnboarding row is offered back. Returns null when the shop did not come from a preview.
 */
export async function loadPreviewOnboarding(shopId: string): Promise<PreviewOnboardingPrefill | null> {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      name: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
      stripeConnectDisconnectedAt: true,
      previewRequest: {
        select: {
          firstName: true,
          email: true,
          townCity: true,
          websiteUrl: true,
          hasOwnDomain: true,
          currentBookingSystem: true,
        },
      },
      clientOnboarding: true,
    },
  });
  const request = shop?.previewRequest;
  if (!shop || !request) return null;

  const onboarding = shop.clientOnboarding;
  const knownDomain = onboarding?.existingDomain || hostnameOf(request.websiteUrl);
  const savedMode = onboarding?.domainMode;
  const domainMode =
    savedMode === 'EXISTING' || savedMode === 'KERSIVO_REGISTER'
      ? savedMode
      : request.hasOwnDomain === 'yes'
        ? 'EXISTING'
        : request.hasOwnDomain === 'no'
          ? 'KERSIVO_REGISTER'
          : null;
  const system = request.currentBookingSystem;

  return {
    shopName: shop.name,
    primaryContactName: onboarding?.primaryContactName || request.firstName || '',
    primaryContactEmail: onboarding?.primaryContactEmail || request.email,
    publicEmail: onboarding?.publicEmail || request.email,
    publicPhone: onboarding?.publicPhone || '',
    addressLine1: onboarding?.addressLine1 || '',
    townCity: onboarding?.townCity || request.townCity,
    postcode: onboarding?.postcode || '',
    domainMode,
    existingDomain: knownDomain,
    preferredDomain1: onboarding?.preferredDomain1 || '',
    migrationRequested: onboarding?.migrationRequested ?? null,
    currentBookingSystemLabel: system && system !== 'none' ? labelFor(FREE_PREVIEW_BOOKING_SYSTEMS, system) : null,
    submitted: onboarding?.status === 'SUBMITTED' || onboarding?.status === 'READY_FOR_BUILD',
    stripeConnected: Boolean(
      shop.stripeConnectAccountId && shop.stripeConnectChargesEnabled && !shop.stripeConnectDisconnectedAt,
    ),
  };
}
