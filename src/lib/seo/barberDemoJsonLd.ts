import { SAAS_MONTHLY_GBP } from './defaults';
import { getFooterSocialLinks } from './footerSocialLinks';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

const BRAND_SCHEMA_NAME = 'KERSIVO';

const ORGANIZATION_DESCRIPTION =
  'Booking and management software for independent UK barbershops.';

const SOFTWARE_DESCRIPTION =
  'Booking and management software built specifically for independent UK barbershops.';

/** Real features visible on the homepage / commercial offer — not marketing inventions. */
export const KERSIVO_SOFTWARE_FEATURE_LIST = [
  'Online bookings',
  'Booking deposits',
  'Client management',
  'Barber and service management',
  'Appointment reminders',
  'Retail pickup',
  'Branded barbershop website',
  'Own domain',
] as const;

/** Stable @id for schema.org cross-references (brand site). */
export function getKersivoOrganizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`;
}

export function getKersivoWebsiteId(siteUrl: string): string {
  return `${siteUrl}/#website`;
}

export function getKersivoSoftwareId(siteUrl: string): string {
  return `${siteUrl}/#software`;
}

/**
 * Marketing homepage @graph: Organization + WebSite + SoftwareApplication.
 * Keep FAQPage as a separate JSON-LD block on the homepage.
 */
export function buildBarberDemoJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const organizationId = getKersivoOrganizationId(siteUrl);
  const websiteId = getKersivoWebsiteId(siteUrl);
  const softwareId = getKersivoSoftwareId(siteUrl);
  const orgLogoUrl = `${siteUrl}/images/logo.jpg`;
  const sameAs = getFooterSocialLinks().map((link) => link.href);

  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': organizationId,
    name: BRAND_SCHEMA_NAME,
    url: `${siteUrl}/`,
    description: ORGANIZATION_DESCRIPTION,
    logo: {
      '@type': 'ImageObject',
      url: orgLogoUrl,
    },
  };
  if (sameAs.length > 0) {
    organization.sameAs = sameAs;
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: `${siteUrl}/`,
        name: BRAND_SCHEMA_NAME,
        publisher: { '@id': organizationId },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': softwareId,
        name: BRAND_SCHEMA_NAME,
        url: `${siteUrl}/`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: SOFTWARE_DESCRIPTION,
        provider: { '@id': organizationId },
        featureList: [...KERSIVO_SOFTWARE_FEATURE_LIST],
        offers: {
          '@type': 'Offer',
          price: String(SAAS_MONTHLY_GBP),
          priceCurrency: 'GBP',
          url: `${siteUrl}/`,
        },
      },
    ],
  };
}
