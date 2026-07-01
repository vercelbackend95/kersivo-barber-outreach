import {
  DEFAULT_DESCRIPTION,
  ONGOING_CARE_MONTHLY_GBP,
  SITE_NAME,
} from './defaults';
import { getSocialProfileUrls } from './socialProfiles';
import { SETUP_PLANS } from '@/lib/setup/plans';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

/** Stable @id for schema.org cross-references (brand site). */
export function getKersivoOrganizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`;
}

export function buildBarberDemoJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const organizationId = getKersivoOrganizationId(siteUrl);
  const orgLogoUrl = `${siteUrl}/images/logo_nobg.png`;
  const softwareId = `${siteUrl}/#software/kersivo-barber-management`;
  const serviceId = `${siteUrl}/#service/barber-booking`;
  const websiteId = `${siteUrl}/#website`;
  const launchPlan = SETUP_PLANS.launch;
  const socialProfiles = getSocialProfileUrls();

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: SITE_NAME,
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: orgLogoUrl,
        },
        sameAs: socialProfiles,
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'hello@kersivo.co.uk',
          contactType: 'customer support',
          areaServed: 'GB',
          availableLanguage: 'English',
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: siteUrl,
        name: SITE_NAME,
        publisher: { '@id': organizationId },
        inLanguage: 'en-GB',
      },
      {
        '@type': 'SoftwareApplication',
        '@id': softwareId,
        name: 'Kersivo Barber Management System',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: DEFAULT_DESCRIPTION,
        url: siteUrl,
        author: { '@id': organizationId },
        publisher: { '@id': organizationId },
        provider: { '@id': organizationId },
        browserRequirements: 'Requires JavaScript. Requires HTML5.',
        offers: [
          {
            '@type': 'Offer',
            name: `${launchPlan.name} setup`,
            price: (launchPlan.setupTotalPence / 100).toFixed(2),
            priceCurrency: 'GBP',
            description: `One-time setup from £${launchPlan.setupTotalPence / 100}. 50% deposit to start, 50% on go-live.`,
            url: `${siteUrl}/#pricing`,
            availability: 'https://schema.org/InStock',
          },
          {
            '@type': 'Offer',
            name: 'Ongoing Care',
            price: ONGOING_CARE_MONTHLY_GBP.toFixed(2),
            priceCurrency: 'GBP',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: ONGOING_CARE_MONTHLY_GBP.toFixed(2),
              priceCurrency: 'GBP',
              unitText: 'MONTH',
            },
            description:
              'Hosting, SMS, support, platform updates, and scoped monthly tweaks.',
            url: `${siteUrl}/#pricing`,
            availability: 'https://schema.org/InStock',
          },
        ],
      },
      {
        '@type': 'Service',
        '@id': serviceId,
        name: 'Barber Booking Software',
        serviceType: 'Barber Booking Software',
        provider: { '@id': organizationId },
        areaServed: {
          '@type': 'Country',
          name: 'United Kingdom',
          identifier: 'GB',
        },
      },
    ],
  };
}
