import {
  BARBER_COST_CALCULATOR_BREADCRUMB_NAME,
  BARBER_COST_CALCULATOR_DESCRIPTION,
  BARBER_COST_CALCULATOR_LAST_UPDATED_ISO,
  BARBER_COST_CALCULATOR_PAGE_PATH,
  BARBER_COST_CALCULATOR_TITLE,
} from '@/lib/seo/barberCostCalculatorPage';
import { buildBarberCostCalculatorFaqJsonLd } from '@/lib/seo/barberCostCalculatorFaq';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export function buildBarberCostCalculatorWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBER_COST_CALCULATOR_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BARBER_COST_CALCULATOR_TITLE,
    description: BARBER_COST_CALCULATOR_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: BARBER_COST_CALCULATOR_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
    mainEntity: { '@id': `${pageUrl}#calculator` },
  };
}

export const BARBER_COST_CALCULATOR_APP_NAME = 'Barber Booking Software Cost Calculator';

export const BARBER_COST_CALCULATOR_APP_DESCRIPTION =
  'Interactive calculator that estimates monthly, 12-month and 3-year booking software costs for a UK barbershop on Booksy, Fresha and KERSIVO, using each provider’s published UK pricing and the shop’s own inputs.';

/** Static description of the tool only: never scenario values, ratings, offers or install claims. */
export function buildBarberCostCalculatorWebApplicationJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBER_COST_CALCULATOR_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${pageUrl}#calculator`,
    name: BARBER_COST_CALCULATOR_APP_NAME,
    url: pageUrl,
    description: BARBER_COST_CALCULATOR_APP_DESCRIPTION,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    inLanguage: 'en-GB',
    isPartOf: { '@id': `${pageUrl}#webpage` },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
  };
}

export function buildBarberCostCalculatorBreadcrumbJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBER_COST_CALCULATOR_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: BARBER_COST_CALCULATOR_BREADCRUMB_NAME,
        item: pageUrl,
      },
    ],
  };
}

export function buildBarberCostCalculatorJsonLd(): Record<string, unknown>[] {
  return [
    buildBarberCostCalculatorWebPageJsonLd(),
    buildBarberCostCalculatorWebApplicationJsonLd(),
    buildBarberCostCalculatorBreadcrumbJsonLd(),
    buildBarberCostCalculatorFaqJsonLd(),
  ];
}
