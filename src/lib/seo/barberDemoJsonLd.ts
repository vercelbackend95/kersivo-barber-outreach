import {
  DEFAULT_DESCRIPTION,
  SAAS_MONTHLY_GBP,
  SITE_NAME,
} from './defaults';
import { getSocialProfileUrls } from './socialProfiles';
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
            name: 'Monthly subscription',
            price: SAAS_MONTHLY_GBP.toFixed(2),
            priceCurrency: 'GBP',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: SAAS_MONTHLY_GBP.toFixed(2),
              priceCurrency: 'GBP',
              unitText: 'MONTH',
            },
            description:
              'Standard branded website, booking, admin, pickup shop, hosting, support, platform updates, and scoped monthly tweaks. No setup fee.',
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
