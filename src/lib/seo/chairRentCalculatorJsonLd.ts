import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { buildChairRentFaqJsonLd } from './chairRentCalculatorFaq';
import {
  CHAIR_RENT_CALCULATOR_APP_NAME,
  CHAIR_RENT_CALCULATOR_BREADCRUMB_NAME,
  CHAIR_RENT_CALCULATOR_DESCRIPTION,
  CHAIR_RENT_CALCULATOR_LAST_UPDATED_ISO,
  CHAIR_RENT_CALCULATOR_PAGE_PATH,
  CHAIR_RENT_CALCULATOR_TITLE,
} from './chairRentCalculatorPage';

const pageUrlFor = (siteUrl: string) => `${siteUrl}${CHAIR_RENT_CALCULATOR_PAGE_PATH}`;

export function buildChairRentWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = pageUrlFor(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: CHAIR_RENT_CALCULATOR_TITLE,
    description: CHAIR_RENT_CALCULATOR_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: CHAIR_RENT_CALCULATOR_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
    mainEntity: { '@id': `${pageUrl}#calculator` },
  };
}

/** Static description of the tool only: no scenario values, ratings or reviews. */
export function buildChairRentWebApplicationJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = pageUrlFor(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${pageUrl}#calculator`,
    name: CHAIR_RENT_CALCULATOR_APP_NAME,
    url: pageUrl,
    description:
      'Free calculator comparing what a UK barbershop keeps from one chair worked by an employed barber on commission or rented to a self-employed barber, including minimum wage top-ups, holiday pay, employer’s National Insurance, pension and VAT.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    inLanguage: 'en-GB',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    provider: { '@id': getKersivoOrganizationId(siteUrl) },
    isPartOf: { '@id': `${pageUrl}#webpage` },
  };
}

export function buildChairRentBreadcrumbJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = pageUrlFor(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: CHAIR_RENT_CALCULATOR_BREADCRUMB_NAME, item: pageUrl },
    ],
  };
}

export function buildChairRentCalculatorJsonLd(): Record<string, unknown>[] {
  return [
    buildChairRentWebPageJsonLd(),
    buildChairRentWebApplicationJsonLd(),
    buildChairRentBreadcrumbJsonLd(),
    buildChairRentFaqJsonLd(),
  ];
}
