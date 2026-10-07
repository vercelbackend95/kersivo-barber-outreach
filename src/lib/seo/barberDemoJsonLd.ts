import { SAAS_MONTHLY_GBP } from './defaults';
import {
  KERSIVO_BRAND_SCHEMA_NAME,
  buildKersivoOrganizationNode,
  buildKersivoWebsiteNode,
  getKersivoOrganizationId,
  getKersivoWebsiteId,
} from './kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export { getKersivoOrganizationId, getKersivoWebsiteId };

const SOFTWARE_DESCRIPTION =
  'Barbershop booking and management software for independent UK barbershops.';

/** Real features visible on the homepage / commercial offer — not marketing inventions. */
export const KERSIVO_SOFTWARE_FEATURE_LIST = [
  'Online bookings',
  'Booking deposits',
  'Client management',
  'Barber and service management',
  'Appointment reminders',
  'Retail pickup (Full KERSIVO)',
  'Branded barbershop website (Full KERSIVO)',
  'Own domain (Full KERSIVO)',
] as const;

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
  const softwareId = getKersivoSoftwareId(siteUrl);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      buildKersivoOrganizationNode(siteUrl),
      buildKersivoWebsiteNode(siteUrl),
      {
        '@type': 'SoftwareApplication',
        '@id': softwareId,
        name: KERSIVO_BRAND_SCHEMA_NAME,
        url: `${siteUrl}/`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: SOFTWARE_DESCRIPTION,
        provider: { '@id': organizationId },
        featureList: [...KERSIVO_SOFTWARE_FEATURE_LIST],
        offers: [
          {
            '@type': 'Offer',
            name: 'KERSIVO Starter',
            price: '0',
            priceCurrency: 'GBP',
            url: `${siteUrl}/starter`,
          },
          {
            '@type': 'Offer',
            name: 'Full KERSIVO',
            price: String(SAAS_MONTHLY_GBP),
            priceCurrency: 'GBP',
            url: `${siteUrl}/`,
          },
        ],
      },
    ],
  };
}
