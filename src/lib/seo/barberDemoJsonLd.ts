/** Stable @id for schema.org cross-references (brand site). */
export const KERSIVO_ORGANIZATION_ID = 'https://kersivo.co.uk/#organization';

const KERSIVO_SITE = 'https://kersivo.co.uk';
/** Canonical public demo origin (BarberDemo). */
const BARBERDEMO_CANONICAL = 'https://barberdemo.kersivo.co.uk';
const ORG_LOGO_URL = `${KERSIVO_SITE}/images/logo-kersivo.png`;

const SOFTWARE_ID = `${BARBERDEMO_CANONICAL}/#software/kersivo-barber-management`;
const SERVICE_ID = `${BARBERDEMO_CANONICAL}/#service/barber-booking`;
const SOFTWARE_PAGE_URL = `${BARBERDEMO_CANONICAL}/`;

export function buildBarberDemoJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': KERSIVO_ORGANIZATION_ID,
        name: 'Kersivo',
        url: KERSIVO_SITE,
        logo: {
          '@type': 'ImageObject',
          url: ORG_LOGO_URL,
        },
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'hello@kersivo.co.uk',
          contactType: 'customer support',
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': SOFTWARE_ID,
        name: 'Kersivo Barber Management System',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'An all-in-one booking and management system tailored for modern barbershops in the UK.',
        url: SOFTWARE_PAGE_URL,
        author: { '@id': KERSIVO_ORGANIZATION_ID },
        publisher: { '@id': KERSIVO_ORGANIZATION_ID },
        provider: { '@id': KERSIVO_ORGANIZATION_ID },
        browserRequirements: 'Requires JavaScript. Requires HTML5.',
      },
      {
        '@type': 'Service',
        '@id': SERVICE_ID,
        name: 'Barber Booking Software',
        serviceType: 'Barber Booking Software',
        provider: { '@id': KERSIVO_ORGANIZATION_ID },
        areaServed: {
          '@type': 'Country',
          name: 'United Kingdom',
          identifier: 'GB',
        },
      },
    ],
  };
}
