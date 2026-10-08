import {
  TIMELY_ALTERNATIVE_DESCRIPTION,
  TIMELY_ALTERNATIVE_LAST_UPDATED_ISO,
  TIMELY_ALTERNATIVE_PAGE_PATH,
  TIMELY_ALTERNATIVE_TITLE,
} from './timelyAlternativeFaq';
import {
  getKersivoOrganizationId,
  getKersivoWebsiteId,
} from '@/lib/seo/barberDemoJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export function buildTimelyAlternativeWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${TIMELY_ALTERNATIVE_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: TIMELY_ALTERNATIVE_TITLE,
    description: TIMELY_ALTERNATIVE_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: TIMELY_ALTERNATIVE_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
  };
}

/** Mirrors the visible Home / Timely alternative navigation in TimelyHero. */
export function buildTimelyAlternativeBreadcrumbJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${TIMELY_ALTERNATIVE_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Timely alternative', item: pageUrl },
    ],
  };
}
