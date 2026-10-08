import {
  NEARCUT_ALTERNATIVE_DESCRIPTION,
  NEARCUT_ALTERNATIVE_LAST_UPDATED_ISO,
  NEARCUT_ALTERNATIVE_PAGE_PATH,
  NEARCUT_ALTERNATIVE_TITLE,
} from './nearcutAlternativeFaq';
import {
  getKersivoOrganizationId,
  getKersivoWebsiteId,
} from '@/lib/seo/barberDemoJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export function buildNearcutAlternativeWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${NEARCUT_ALTERNATIVE_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: NEARCUT_ALTERNATIVE_TITLE,
    description: NEARCUT_ALTERNATIVE_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: NEARCUT_ALTERNATIVE_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
  };
}

/** Mirrors the visible Home / Nearcut alternative navigation in NearcutHero. */
export function buildNearcutAlternativeBreadcrumbJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${NEARCUT_ALTERNATIVE_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Nearcut alternative', item: pageUrl },
    ],
  };
}
