import {
  BOOKSY_ALTERNATIVE_DESCRIPTION,
  BOOKSY_ALTERNATIVE_PAGE_PATH,
  BOOKSY_ALTERNATIVE_TITLE,
} from '@/lib/seo/booksyAlternativeFaq';
import {
  getKersivoOrganizationId,
  getKersivoWebsiteId,
} from '@/lib/seo/barberDemoJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export function buildBooksyAlternativeWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BOOKSY_ALTERNATIVE_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BOOKSY_ALTERNATIVE_TITLE,
    description: BOOKSY_ALTERNATIVE_DESCRIPTION,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
  };
}
