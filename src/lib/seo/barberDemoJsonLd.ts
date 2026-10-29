import {
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_TITLE,
  HOMEPAGE_DESCRIPTION,
  HOMEPAGE_LAST_UPDATED_ISO,
  KERSIVO_BOOKING_DEPOSIT_GBP,
  SAAS_MONTHLY_GBP,
} from './defaults';
import {
  KERSIVO_BRAND_SCHEMA_NAME,
  buildKersivoOrganizationNode,
  buildKersivoWebsiteNode,
  getKersivoOrganizationId,
  getKersivoWebsiteId,
} from './kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { buildBarbershopBookingFaqJsonLd } from '@/lib/seo/barbershopBookingFaq';

export { getKersivoOrganizationId, getKersivoWebsiteId };

const SOFTWARE_DESCRIPTION =
  'Branded barbershop websites, online booking and client management for independent UK barbershops. 0% KERSIVO commission; standard Stripe processing fees apply to online payments.';

/** Real features visible on the homepage / commercial offer — not marketing inventions. */
export const KERSIVO_SOFTWARE_FEATURE_LIST = [
  'Branded barbershop website on your own standard domain (Full KERSIVO)',
  `Online booking with Pay at shop, £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment (Full KERSIVO)`,
  'SMS appointment reminders within a monthly allowance (Full KERSIVO)',
  'Email confirmations and appointment reminders',
  'Client records, reports and retail pickup (Full KERSIVO)',
  `Hosted booking page with £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment (KERSIVO Starter)`,
] as const;

export function getKersivoSoftwareId(siteUrl: string): string {
  return `${siteUrl}/#software`;
}

export function getKersivoHomepageId(siteUrl: string): string {
  return `${siteUrl}/#webpage`;
}

/**
 * Marketing homepage @graph: Organization + WebSite + WebPage + SoftwareApplication.
 * The homepage WebPage links directly to the software and to the separately rendered FAQPage.
 * Keep FAQ questions in their visible homepage source rather than duplicating FAQ contents here.
 */
/** Homepage JSON-LD: the main @graph plus the FAQPage node (#faq), as one block. */
export function buildHomepageJsonLd(): Record<string, unknown> {
  const graph = buildBarberDemoJsonLd();
  const { '@context': _context, ...faq } = buildBarbershopBookingFaqJsonLd();
  return { ...graph, '@graph': [...(graph['@graph'] as Record<string, unknown>[]), faq] };
}

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
        '@type': 'WebPage',
        '@id': getKersivoHomepageId(siteUrl),
        url: `${siteUrl}/`,
        name: DEFAULT_TITLE,
        description: HOMEPAGE_DESCRIPTION,
        inLanguage: 'en-GB',
        dateModified: HOMEPAGE_LAST_UPDATED_ISO,
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: `${siteUrl}${DEFAULT_OG_IMAGE_PATH}`,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
        },
        isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
        publisher: { '@id': organizationId },
        mainEntity: { '@id': softwareId },
        hasPart: { '@id': `${siteUrl}/#faq` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': softwareId,
        name: KERSIVO_BRAND_SCHEMA_NAME,
        url: `${siteUrl}/`,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Barbershop booking software and websites',
        operatingSystem: 'Web browser',
        inLanguage: 'en-GB',
        description: SOFTWARE_DESCRIPTION,
        provider: { '@id': organizationId },
        featureList: [...KERSIVO_SOFTWARE_FEATURE_LIST],
        offers: [
          {
            '@type': 'Offer',
            '@id': `${siteUrl}/#offer-full`,
            name: 'Full KERSIVO',
            description:
              'Per physical location: branded website and standard domain, online booking with payment control, clients, reports, retail pickup and SMS reminders within a monthly allowance. No setup fee. Billed monthly from purchase. Cancel anytime.',
            url: `${siteUrl}/pricing`,
            price: SAAS_MONTHLY_GBP.toFixed(2),
            priceCurrency: 'GBP',
            availability: 'https://schema.org/InStock',
            eligibleRegion: { '@type': 'Country', name: 'United Kingdom' },
            seller: { '@id': organizationId },
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: SAAS_MONTHLY_GBP.toFixed(2),
              priceCurrency: 'GBP',
              billingDuration: 'P1M',
              unitText: 'per location per month',
            },
          },
          {
            '@type': 'Offer',
            '@id': `${siteUrl}/#offer-starter`,
            name: 'KERSIVO Starter',
            description: `£0/month for one location and up to 4 bookable barbers. Public bookings require a connected Stripe account and are paid by a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or in full; Stripe fees apply.`,
            url: `${siteUrl}/starter`,
            price: '0',
            priceCurrency: 'GBP',
            availability: 'https://schema.org/InStock',
            eligibleRegion: { '@type': 'Country', name: 'United Kingdom' },
            seller: { '@id': organizationId },
          },
        ],
      },
    ],
  };
}
