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

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'Kersivo',
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: orgLogoUrl,
        },
        sameAs: [],
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'hello@kersivo.co.uk',
          contactType: 'customer support',
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: siteUrl,
        name: 'Kersivo',
        publisher: { '@id': organizationId },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': softwareId,
        name: 'Kersivo Barber Management System',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'Booking, admin and retail under your UK barbershop domain with 0% commission from Kersivo.',
        url: siteUrl,
        author: { '@id': organizationId },
        publisher: { '@id': organizationId },
        provider: { '@id': organizationId },
        browserRequirements: 'Requires JavaScript. Requires HTML5.',
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
