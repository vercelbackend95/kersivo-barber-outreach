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

/** WebApplication must only be added here once the interactive calculator ships. */
export function buildBarberCostCalculatorJsonLd(): Record<string, unknown>[] {
  return [
    buildBarberCostCalculatorWebPageJsonLd(),
    buildBarberCostCalculatorBreadcrumbJsonLd(),
    buildBarberCostCalculatorFaqJsonLd(),
  ];
}
